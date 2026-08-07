import type {StreamDelta} from "core/patching"
import type {Rect} from "core/types"
import {Indices} from "core/types"
import {empty} from "core/util/bbox"
import {SpatialIndex} from "core/util/spatial"

const chunk_size = 256

type RectAt = (index: number) => Rect
type LaneAt = (index: number) => number

type Chunk = {
  readonly slots: Uint32Array
  start: number
  length: number
  bbox: Rect
}

type Lane = {
  readonly chunks: Chunk[]
  bbox: Rect
}

function normalized(rect: Rect): Rect {
  let {x0, y0, x1, y1} = rect
  if (!isFinite(x0 + y0 + x1 + y1)) {
    return empty()
  }
  if (x0 > x1) {
    [x0, x1] = [x1, x0]
  }
  if (y0 > y1) {
    [y0, y1] = [y1, y0]
  }
  return {x0, y0, x1, y1}
}

function normalized_query(rect: Rect): Rect {
  let {x0, y0, x1, y1} = rect
  if (x0 > x1 && isFinite(x0 + x1)) {
    [x0, x1] = [x1, x0]
  }
  if (y0 > y1 && isFinite(y0 + y1)) {
    [y0, y1] = [y1, y0]
  }
  return {x0, y0, x1, y1}
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x0 <= b.x1 && a.y0 <= b.y1 && a.x1 >= b.x0 && a.y1 >= b.y0
}

function include(target: Rect, rect: Rect): void {
  target.x0 = Math.min(target.x0, rect.x0)
  target.y0 = Math.min(target.y0, rect.y0)
  target.x1 = Math.max(target.x1, rect.x1)
  target.y1 = Math.max(target.y1, rect.y1)
}

/**
 * Incremental HBar index for fixed-rollover streams.
 *
 * Entries are grouped first by lane and then into arrival-ordered chunks.
 * Rollover removes physical slots from the lane heads and appends replacements
 * to the tails, so only the touched chunks need their bounds recomputed.
 */
export class HBarStreamIndex extends SpatialIndex {
  private readonly _capacity: number
  private readonly _rect_at: RectAt
  private readonly _lane_at: LaneAt
  private readonly _slot_lanes: Float64Array
  private readonly _lanes = new Map<number, Lane>()
  private _offset = 0
  private _count = 0
  private _bbox = empty()
  private _stream_updates = 0

  constructor(capacity: number, rect_at: RectAt, lane_at: LaneAt) {
    super(0)
    this._capacity = capacity
    this._rect_at = rect_at
    this._lane_at = lane_at
    this._slot_lanes = new Float64Array(capacity)

    for (let i = 0; i < capacity; i++) {
      this._append(i)
    }
    this._recompute_bbox()
  }

  get diagnostics(): {lanes: number, chunks: number, stream_updates: number} {
    let chunks = 0
    for (const lane of this._lanes.values()) {
      chunks += lane.chunks.length
    }
    return {lanes: this._lanes.size, chunks, stream_updates: this._stream_updates}
  }

  override get bbox(): Rect {
    return {...this._bbox}
  }

  private _physical_index(logical_index: number): number {
    return this._capacity == 0 ? 0 : (this._offset + logical_index) % this._capacity
  }

  private _logical_index(physical_index: number): number {
    return this._capacity == 0 ? 0 :
      (physical_index - this._offset + this._capacity) % this._capacity
  }

  private _rect_at_physical(physical_index: number): Rect {
    return normalized(this._rect_at(this._logical_index(physical_index)))
  }

  private _append(logical_index: number): void {
    const physical_index = this._physical_index(logical_index)
    const lane_key = this._lane_at(logical_index)
    this._slot_lanes[physical_index] = lane_key

    let lane = this._lanes.get(lane_key)
    if (lane == null) {
      lane = {chunks: [], bbox: empty()}
      this._lanes.set(lane_key, lane)
    }

    if (lane.chunks.length == 0 ||
        lane.chunks[lane.chunks.length - 1].start + lane.chunks[lane.chunks.length - 1].length == chunk_size) {
      lane.chunks.push({slots: new Uint32Array(chunk_size), start: 0, length: 0, bbox: empty()})
    }
    const chunk = lane.chunks[lane.chunks.length - 1]
    chunk.slots[chunk.start + chunk.length] = physical_index
    chunk.length++

    const rect = this._rect_at_physical(physical_index)
    include(chunk.bbox, rect)
    include(lane.bbox, rect)
    this._count++
  }

  private _remove(physical_index: number, dirty_lanes: Set<number>): boolean {
    const lane_key = this._slot_lanes[physical_index]
    const lane = this._lanes.get(lane_key)
    const chunk = lane?.chunks[0]
    if (lane == null || chunk == null || chunk.slots[chunk.start] != physical_index) {
      return false
    }

    chunk.start++
    chunk.length--
    if (chunk.length == 0) {
      lane.chunks.shift()
    }
    if (lane.chunks.length == 0) {
      this._lanes.delete(lane_key)
    } else {
      dirty_lanes.add(lane_key)
    }
    this._count--
    return true
  }

  private _recompute_chunk(chunk: Chunk): void {
    const bbox = empty()
    for (let i = 0; i < chunk.length; i++) {
      include(bbox, this._rect_at_physical(chunk.slots[chunk.start + i]))
    }
    chunk.bbox = bbox
  }

  private _recompute_lane(lane: Lane, recompute_head: boolean): void {
    if (recompute_head && lane.chunks.length != 0) {
      this._recompute_chunk(lane.chunks[0])
    }
    const bbox = empty()
    for (const chunk of lane.chunks) {
      include(bbox, chunk.bbox)
    }
    lane.bbox = bbox
  }

  private _recompute_bbox(): void {
    const bbox = empty()
    for (const lane of this._lanes.values()) {
      include(bbox, lane.bbox)
    }
    this._bbox = bbox
  }

  stream(delta: StreamDelta): boolean {
    const fixed_rollover =
      delta.old_length == this._capacity &&
      delta.new_length == this._capacity &&
      delta.new_rows == delta.removed_rows &&
      delta.new_rows > 0 &&
      this._count == this._capacity
    if (!fixed_rollover) {
      return false
    }

    const dirty_lanes = new Set<number>()
    for (let i = 0; i < delta.removed_rows; i++) {
      const physical_index = (this._offset + i) % this._capacity
      if (!this._remove(physical_index, dirty_lanes)) {
        return false
      }
    }

    this._offset = (this._offset + delta.removed_rows) % this._capacity
    for (const lane_key of dirty_lanes) {
      const lane = this._lanes.get(lane_key)
      if (lane != null) {
        this._recompute_lane(lane, true)
      }
    }

    const start = this._capacity - delta.new_rows
    for (let i = start; i < this._capacity; i++) {
      this._append(i)
    }

    this._recompute_bbox()
    this._stream_updates++
    return this._count == this._capacity
  }

  private _for_each_intersection(rect: Rect, fn: (logical_index: number, bbox: Rect) => void): void {
    const query = normalized_query(rect)
    for (const lane of this._lanes.values()) {
      if (!intersects(lane.bbox, query)) {
        continue
      }
      for (const chunk of lane.chunks) {
        if (!intersects(chunk.bbox, query)) {
          continue
        }
        for (let i = 0; i < chunk.length; i++) {
          const physical_index = chunk.slots[chunk.start + i]
          const bbox = this._rect_at_physical(physical_index)
          if (intersects(bbox, query)) {
            fn(this._logical_index(physical_index), bbox)
          }
        }
      }
    }
  }

  override indices(rect: Rect): Indices {
    const result = new Indices(this._capacity)
    this._for_each_intersection(rect, (index) => result.set_unchecked(index))
    return result
  }

  override bounds(rect: Rect): Rect {
    const query = normalized_query(rect)
    const result = empty()
    this._for_each_intersection(query, (_index, bbox) => {
      if (bbox.x0 >= query.x0 && bbox.x0 < result.x0) {
        result.x0 = bbox.x0
      }
      if (bbox.x1 <= query.x1 && bbox.x1 > result.x1) {
        result.x1 = bbox.x1
      }
      if (bbox.y0 >= query.y0 && bbox.y0 < result.y0) {
        result.y0 = bbox.y0
      }
      if (bbox.y1 <= query.y1 && bbox.y1 > result.y1) {
        result.y1 = bbox.y1
      }
    })
    return result
  }
}
