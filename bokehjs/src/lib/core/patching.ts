import type {Arrayable, Data, Dict} from "core/types"
import {isTypedArray, isArray, isNumber} from "core/util/types"
import type {NDArray} from "core/util/ndarray"
import {dict} from "core/util/object"
import {union} from "core/util/set"
import type {Slice} from "core/util/slice"
import * as typed_array from "core/util/typed_array"

export type StreamRange = {
  readonly start: number
  readonly end: number
}

/**
 * Describes how a columnar source changed after a streaming update.
 *
 * `new_rows` counts rows from the streamed data that remain after rollover,
 * while `removed_rows` counts rows removed from the previous source data.
 * Affected ranges use half-open indices in the resulting source.
 */
export type StreamDelta = {
  readonly old_length: number
  readonly new_length: number
  readonly new_rows: number
  readonly removed_rows: number
  readonly affected_ranges: readonly StreamRange[]
}

// exported for testing
export function stream_to_column(col: Arrayable, new_col: Arrayable, rollover?: number): Arrayable {
  if (isArray(col) && isArray(new_col)) {
    const total_len = col.length + new_col.length
    if (rollover != null && total_len > rollover) {
      const nnew = Math.min(new_col.length, rollover)
      const nold = rollover - nnew
      const result = nold == 0 ? [] : col.slice(-nold)
      const offset = new_col.length - nnew
      for (let i = offset; i < new_col.length; i++) {
        result.push(new_col[i])
      }
      return result
    }
    return col.concat(new_col)
  }

  const total_len = col.length + new_col.length

  // handle rollover case for typed arrays
  if (rollover != null && total_len > rollover) {
    const ctor = (() => {
      if (isTypedArray(col)) {
        return col.constructor
      } else if (isTypedArray(new_col)) {
        return new_col.constructor
      } else {
        throw new Error("unsupported array types")
      }
    })()

    const result = isTypedArray(col) && col.length == rollover ? col : new ctor(rollover)
    const nnew = Math.min(new_col.length, rollover)
    const nold = rollover - nnew

    if (nold != 0) {
      if (result === col) {
        result.copyWithin(0, col.length - nold)
      } else {
        result.set(col.slice(col.length - nold), 0)
      }
    }

    const offset = new_col.length - nnew
    result.set(offset == 0 ? new_col : new_col.slice(offset), nold)

    return result
  } else {
    const col_ = (() => {
      if (isTypedArray(col)) {
        return col
      } else if (isTypedArray(new_col)) {
        return new new_col.constructor(col)
      } else {
        throw new Error("unsupported array types")
      }
    })()
    return typed_array.concat(col_, new_col)
  }
}

// exported for testing
export function slice(ind: number | Slice, length: number): [number, number, number] {
  let start: number, step: number, stop: number

  if (isNumber(ind)) {
    start = ind
    stop  = ind + 1
    step  = 1
  } else {
    start = ind.start != null ? ind.start : 0
    stop  = ind.stop  != null ? ind.stop  : length
    step  = ind.step  != null ? ind.step  : 1
  }

  return [start, stop, step]
}

export type Patch<T> = [number, T] | [[number, number | Slice] | [number, number | Slice, number | Slice], T[]] | [Slice, T[]]

export type PatchSet<T> = Dict<Patch<T>[]>

// exported for testing
export function patch_to_column<T>(col: NDArray | NDArray[], patch: Patch<T>[]): Set<number> {
  const patched: Set<number> = new Set()
  let patched_range = false

  for (const [ind, val] of patch) {
    // make the single index case look like the length-3 multi-index case
    let shape: number[]
    let item: Arrayable
    let index: [number, number | Slice, number | Slice]
    let value: unknown[]
    if (isArray(ind)) {
      const [i] = ind
      patched.add(i)
      shape = (col[i] as NDArray).shape
      item = col[i] as NDArray
      value = val as unknown[]

      // this is basically like NumPy's "newaxis", inserting an empty dimension
      // makes length 2 and 3 multi-index cases uniform, so that the same code
      // can handle both
      if (ind.length === 2) {
        shape = [1, shape[0]]
        index = [ind[0], 0, ind[1]]
      } else {
        index = ind
      }
    } else {
      if (isNumber(ind)) {
        value = [val]
        patched.add(ind)
      } else {
        value = val as unknown[]
        patched_range = true
      }

      index = [0, 0, ind]
      shape = [1, col.length]
      item = col
    }

    // now this one nested loop handles all cases
    let flat_index = 0
    const [istart, istop, istep] = slice(index[1], shape[0])
    const [jstart, jstop, jstep] = slice(index[2], shape[1])

    for (let i = istart; i < istop; i += istep) {
      for (let j = jstart; j < jstop; j += jstep) {
        if (patched_range) {
          patched.add(j)
        }
        item[i*shape[1] + j] = value[flat_index]
        flat_index++
      }
    }
  }

  return patched
}

function columnar_data_length(data: Data): number {
  for (const [, column] of dict(data)) {
    return column.length
  }
  return 0
}

export function stream_to_columns(old_data: Data, new_data: Data, rollover?: number): StreamDelta {
  const old_length = columnar_data_length(old_data)
  const streamed_length = columnar_data_length(new_data)
  const data = dict(old_data)
  for (const [name, new_column] of dict(new_data)) {
    const old_column = data.get(name) ?? []
    data.set(name, stream_to_column(old_column, new_column, rollover))
  }

  const new_length = columnar_data_length(old_data)
  const new_rows = Math.min(streamed_length, new_length)
  const removed_rows = Math.max(0, old_length + new_rows - new_length)
  const affected_ranges = (() => {
    if (new_length == 0) {
      return []
    } else if (removed_rows != 0) {
      return [{start: 0, end: new_length}]
    } else if (new_rows != 0) {
      return [{start: new_length - new_rows, end: new_length}]
    } else {
      return []
    }
  })()

  return {old_length, new_length, new_rows, removed_rows, affected_ranges}
}

export function patch_to_columns(old_data: Data, patches: PatchSet<unknown>): Set<number> {
  const data = dict(old_data)
  let patched: Set<number> = new Set()
  for (const [name, patch] of dict(patches)) {
    const old_column = data.get(name) ?? []
    patched = union(patched, patch_to_column(old_column as any, patch)) // XXX: any
  }
  return patched
}
