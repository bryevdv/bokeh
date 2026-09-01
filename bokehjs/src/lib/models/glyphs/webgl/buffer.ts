import type {ReglWrapper} from "./regl_wrap"
import {cap_lookup, hatch_pattern_to_index, join_lookup} from "./webgl_utils"
import type {LineCap, LineJoin} from "core/enums"
import type {HatchPattern} from "core/property_mixins"
import type {uint32, Arrayable} from "core/types"
import type {Uniform, ColorUniformVector} from "core/uniforms"
import {assert} from "core/util/assert"
import {color2rgba, byte} from "core/util/color"
import type {AttributeConfig, Buffer} from "regl"
import type {StreamDelta} from "core/patching"

type WrappedArrayType = Float32Array | Uint8Array

export type BufferUploadStats = Readonly<{
  full_uploads: number
  partial_uploads: number
  bytes: number
}>

// Arrays are sent to GPU using ReGL Buffer objects.  CPU-side arrays used to
// update the Buffers are also kept for reuse to avoid unnecessary reallocation.
export abstract class WrappedBuffer<ArrayType extends WrappedArrayType> {
  protected regl_wrapper: ReglWrapper
  protected buffer?: Buffer
  protected array?: ArrayType
  protected is_scalar: boolean
  private _revision = 0
  private _uploaded_revision = 0
  private _uploaded_byte_length = 0
  private _full_uploads = 0
  private _partial_uploads = 0
  private _uploaded_bytes = 0
  private _circular_offset = 0

  // Number of buffer elements per rendered primitive, e.g. for RGBA buffers this is 4
  // as a single color is 4 x uint8 = 32-bit in total.
  protected elements_per_primitive: number

  constructor(regl_wrapper: ReglWrapper, elements_per_primitive: number = 1) {
    this.regl_wrapper = regl_wrapper
    this.is_scalar = true
    this.elements_per_primitive = elements_per_primitive
  }

  protected abstract bytes_per_element(): number

  // Return array if already know it exists and is the correct length.
  get_array(): ArrayType {
    assert(this.array != null, "WrappedBuffer not yet initialised")
    return this.array
  }

  // Return array of correct size, creating it if necessary.
  // Must call update() when finished setting the array values.
  get_sized_array(length: number): ArrayType {
    if (this.array == null || this.array.length != length) {
      this.array = this.new_array(length)
    }

    return this.array
  }

  protected is_normalized(): boolean {
    return false
  }

  get length(): number {
    return this.array != null ? this.array.length : 0
  }

  get is_scalar_value(): boolean {
    return this.is_scalar
  }

  get revision(): number {
    return this._revision
  }

  get uploaded_revision(): number {
    return this._uploaded_revision
  }

  /** Physical primitive containing logical item zero. */
  get circular_offset(): number {
    return this._circular_offset
  }

  get upload_stats(): BufferUploadStats {
    return {
      full_uploads: this._full_uploads,
      partial_uploads: this._partial_uploads,
      bytes: this._uploaded_bytes,
    }
  }

  reset_upload_stats(): void {
    this._full_uploads = 0
    this._partial_uploads = 0
    this._uploaded_bytes = 0
  }

  protected abstract new_array(len: number): ArrayType

  physical_index(logical_index: number, circular_offset: number = this._circular_offset): number {
    const nitems = this.length/this.elements_per_primitive
    return nitems == 0 ? 0 : (circular_offset + logical_index) % nitems
  }

  get_logical_array(): ArrayType {
    const {array, elements_per_primitive, _circular_offset} = this
    assert(array != null, "WrappedBuffer not yet initialised")
    if (_circular_offset == 0 || this.is_scalar) {
      return array.slice() as ArrayType
    }

    const logical = this.new_array(array.length)
    const physical_offset = _circular_offset*elements_per_primitive
    const split = array.length - physical_offset
    logical.set(array.subarray(physical_offset), 0)
    logical.set(array.subarray(0, physical_offset), split)
    return logical
  }

  private _fixed_rollover(nitems: number, delta: StreamDelta): boolean {
    return delta.old_length == delta.new_length &&
      delta.new_rows == delta.removed_rows &&
      delta.new_rows > 0 &&
      nitems == delta.new_length &&
      !this.is_scalar &&
      this.array != null &&
      this.array.length == nitems*this.elements_per_primitive
  }

  can_update_circular_stream(nitems: number, delta: StreamDelta): boolean {
    return this._fixed_rollover(nitems, delta)
  }

  next_circular_offset(delta: StreamDelta): number {
    return delta.new_length == 0 ? 0 :
      (this._circular_offset + delta.removed_rows) % delta.new_length
  }

  commit_circular_stream(nitems: number, delta: StreamDelta, circular_offset: number): void {
    assert(this._fixed_rollover(nitems, delta), "invalid circular buffer stream")
    assert(circular_offset == this.next_circular_offset(delta), "inconsistent circular buffer offset")
    this._circular_offset = circular_offset

    const first_primitive = this.physical_index(nitems - delta.new_rows)
    const first_length = Math.min(delta.new_rows, nitems - first_primitive)
    const second_length = delta.new_rows - first_length
    this.update_range(
      first_primitive*this.elements_per_primitive,
      first_length*this.elements_per_primitive,
    )
    if (second_length != 0) {
      this.update_range(0, second_length*this.elements_per_primitive)
    }
  }

  protected update_from_stream(
    nitems: number,
    delta: StreamDelta,
    write: (array: ArrayType, logical_index: number, physical_index: number) => void,
    circular_offset?: number,
  ): boolean {
    const {array, elements_per_primitive} = this
    if (!this._fixed_rollover(nitems, delta) || array == null) {
      return false
    }

    if (circular_offset != null) {
      if (circular_offset != this.next_circular_offset(delta)) {
        return false
      }
      const start = nitems - delta.new_rows
      for (let i = start; i < nitems; i++) {
        write(array, i, this.physical_index(i, circular_offset))
      }
      this.commit_circular_stream(nitems, delta, circular_offset)
      return true
    }

    const shift = delta.removed_rows*elements_per_primitive
    array.copyWithin(0, shift)
    const start = nitems - delta.new_rows
    for (let i = start; i < nitems; i++) {
      write(array, i, i)
    }
    this.update(false)
    return true
  }

  set_from_function(
    nitems: number,
    write: (array: ArrayType, logical_index: number, physical_index: number) => void,
    delta?: StreamDelta,
    circular_offset?: number,
  ): void {
    if (delta != null && this.update_from_stream(nitems, delta, write, circular_offset)) {
      return
    }

    const array = this.get_sized_array(nitems*this.elements_per_primitive)
    const offset = circular_offset ?? 0
    for (let i = 0; i < nitems; i++) {
      write(array, i, this.physical_index(i, offset))
    }
    this.update(false, offset)
  }

  set_from_array(numbers: Arrayable<number>): void {
    const len = numbers.length
    const array = this.get_sized_array(len)

    for (let i = 0; i < len; i++) {
      array[i] = numbers[i]
    }

    this.update()
  }

  set_from_prop(prop: Uniform<number>, delta?: StreamDelta, circular_offset?: number): void {
    const len = prop.is_Scalar() ? 1 : prop.length
    if (delta != null && !prop.is_Scalar() &&
        this.update_from_stream(
          len, delta,
          (array, logical_index, physical_index) => array[physical_index] = prop.get(logical_index),
          circular_offset,
        )) {
      return
    }
    const array = this.get_sized_array(len)

    const offset = prop.is_Scalar() ? 0 : circular_offset ?? 0
    for (let i = 0; i < len; i++) {
      array[this.physical_index(i, offset)] = prop.get(i)
    }

    this.update(prop.is_Scalar(), offset)
  }

  set_from_scalar(scalar: number): void {
    this.get_sized_array(1).fill(scalar)
    this.update(true)
  }

  // Return a ReGL AttributeConfig that corresponds to one value for each glyph
  // or the same value for a number of glyphs.  A buffer passed to ReGL for
  // instanced rendering can be used for multiple rendering calls and the
  // important attributes for this are the offset (in bytes) into the buffer
  // and the divisor, which is the number of instances rendered before the
  // offset is advanced to the next buffer element.

  // For non-instanced (polygon/elements) rendering where all attributes
  // must have divisor 0 and data is expanded to per-vertex.
  to_per_vertex_config(): AttributeConfig {
    return {
      buffer: this.buffer,
      divisor: 0,
      normalized: this.is_normalized(),
      offset: 0,
    }
  }

  // to_attribute_config() is used for the common case of a single render call
  // per buffer with visual properties that are either scalar or vector.
  // Visual properties of scatter markers are an good example, and scalar_divisor
  // would be the number of markers rendered.
  to_attribute_config(offset: number = 0, scalar_divisor: number = 1): AttributeConfig {
    return {
      buffer: this.buffer,
      divisor: this.is_scalar ? scalar_divisor : 1,
      normalized: this.is_normalized(),
      offset: offset*this.bytes_per_element(),
    }
  }

  to_attribute_config_primitive(offset: number = 0, scalar_divisor: number = 1): AttributeConfig {
    return this.to_attribute_config(
      this.is_scalar ? 0 : offset*this.elements_per_primitive,
      scalar_divisor,
    )
  }

  // to_attribute_config_nested() is used for the more complicated case in
  // which the vectorisation is nested, such as rendering multi_lines where
  // each visual property has a single buffer that is used multiple times, once
  // for each of the constituent lines.  Vector properties are therefore
  // constant for each constituent line (composed of multiple rendered
  // instances) but change between lines.
  to_attribute_config_nested(offset_vector: number = 0, divisor: number = 1): AttributeConfig {
    return {
      buffer: this.buffer,
      divisor: divisor*this.elements_per_primitive,
      normalized: this.is_normalized(),
      offset: this.is_scalar ? 0 : offset_vector*this.bytes_per_element()*this.elements_per_primitive,
    }
  }

  // Extract the ith item (of `components` elements) from this buffer into `dst`,
  // marking `dst` as scalar.  If this buffer is already scalar, returns `this`
  // unchanged and `dst` is not touched.
  extract_at<T extends WrappedBuffer<ArrayType>>(this: T, i: number, components: number, dst: T): T {
    if (this.is_scalar) {
      return this
    }
    const src_arr = this.get_array()
    const dst_arr = dst.get_sized_array(components)
    const off = i * components
    for (let c = 0; c < components; c++) {
      dst_arr[c] = src_arr[off + c]
    }
    dst.update(true)
    return dst
  }

  // Update ReGL buffer with data contained in array in preparation for passing
  // it to the GPU.  This function must be called after get_sized_array().
  update(is_scalar: boolean = false, circular_offset: number = 0): void {
    this._revision++
    // Update buffer with data contained in array.
    if (this.buffer == null) {
      // Create new buffer.
      this.buffer = this.regl_wrapper.buffer({
        usage: "dynamic",
        data: this.array,
      })
    } else {
      // Reuse existing buffer.
      this.regl_wrapper.flush_resource(this)
      this.buffer({data: this.array})
    }

    this.is_scalar = is_scalar
    this._circular_offset = is_scalar ? 0 : circular_offset
    this._uploaded_byte_length = this.array?.byteLength ?? 0
    this._full_uploads++
    this._uploaded_bytes += this._uploaded_byte_length
    this._uploaded_revision = this._revision
  }

  /** Upload a changed element range without reallocating or transferring the
   * rest of the CPU-side array. Offsets and lengths are in array elements. */
  update_range(offset: number, length: number): void {
    const {array, buffer} = this
    assert(array != null, "WrappedBuffer not yet initialised")
    assert(offset >= 0 && length >= 0 && offset + length <= array.length, "invalid buffer update range")
    if (length == 0) {
      return
    }
    if (buffer == null || this._uploaded_byte_length != array.byteLength) {
      this.update(this.is_scalar, this._circular_offset)
      return
    }
    this._revision++
    this.regl_wrapper.flush_resource(this)
    buffer.subdata(array.subarray(offset, offset + length), offset*this.bytes_per_element())
    this._partial_uploads++
    this._uploaded_bytes += length*this.bytes_per_element()
    this._uploaded_revision = this._revision
  }

  /** Upload sparse changed elements as coalesced contiguous ranges. */
  update_ranges(indices: readonly number[]): void {
    const {array, buffer} = this
    assert(array != null, "WrappedBuffer not yet initialised")
    if (indices.length == 0) {
      return
    }
    if (buffer == null || this._uploaded_byte_length != array.byteLength) {
      this.update(this.is_scalar, this._circular_offset)
      return
    }

    const sorted = [...new Set(indices)].sort((a, b) => a - b)
    assert(sorted[0] >= 0 && sorted[sorted.length - 1] < array.length, "invalid sparse buffer update")
    this.regl_wrapper.flush_resource(this)
    this._revision++
    let start = sorted[0]
    let end = start + 1
    const upload = () => {
      buffer.subdata(array.subarray(start, end), start*this.bytes_per_element())
      this._partial_uploads++
      this._uploaded_bytes += (end - start)*this.bytes_per_element()
    }
    for (let i = 1; i < sorted.length; i++) {
      const index = sorted[i]
      if (index == end) {
        end++
      } else {
        upload()
        start = index
        end = index + 1
      }
    }
    upload()
    this._uploaded_revision = this._revision
  }

  destroy(): void {
    this.regl_wrapper.flush_resource(this)
    this.buffer?.destroy()
    this.buffer = undefined
    this.array = undefined
    this._uploaded_byte_length = 0
    this._circular_offset = 0
    this._revision++
  }
}

export class Float32Buffer extends WrappedBuffer<Float32Array> {
  protected bytes_per_element(): number {
    return Float32Array.BYTES_PER_ELEMENT
  }

  protected new_array(len: number): Float32Array {
    return new Float32Array(len)
  }
}

export class Uint8Buffer extends WrappedBuffer<Uint8Array> {
  protected bytes_per_element(): number {
    return Uint8Array.BYTES_PER_ELEMENT
  }

  protected new_array(len: number): Uint8Array {
    return new Uint8Array(len)
  }

  private _alpha_byte(alpha: number): number {
    const value = byte(alpha)
    // Normalized colors are ultimately blended into an RGBA8 target. Preserve
    // positive alpha at that target's minimum representable value instead of
    // allowing it to round to full transparency.
    return this.is_normalized() && alpha > 0 && value == 0 ? 1 : value
  }

  set_from_color(
    color_prop: Uniform<uint32>,
    alpha_prop: Uniform<number>,
    delta?: StreamDelta,
    circular_offset?: number,
  ): void {
    const is_scalar_colors = color_prop.is_Scalar()
    const is_scalar = is_scalar_colors && alpha_prop.is_Scalar()
    const ncolors = is_scalar ? 1 : color_prop.length

    if (delta != null && !is_scalar &&
        this.update_from_stream(ncolors, delta, (array, logical_index, physical_index) => {
          const [r, g, b, a] = color2rgba(color_prop.get(logical_index))
          array[4*physical_index  ] = r
          array[4*physical_index+1] = g
          array[4*physical_index+2] = b
          array[4*physical_index+3] = this._alpha_byte(alpha_prop.get(logical_index)*a)
        }, circular_offset)) {
      return
    }

    if (!is_scalar_colors && circular_offset == null) {
      const color_v = color_prop as ColorUniformVector
      const array = new Uint8Array(color_v.copy_buffer())
      for (let i = 0; i < ncolors; i++) {
        const alpha = alpha_prop.get(i)*array[4*i+3]
        array[4*i+3] = this._alpha_byte(alpha)
      }
      this.array = array
      this.update(is_scalar)
      return
    }

    const array = this.get_sized_array(4*ncolors)

    const offset = is_scalar ? 0 : circular_offset ?? 0
    for (let logical_index = 0; logical_index < ncolors; logical_index++) {
      const physical_index = this.physical_index(logical_index, offset)
      const [r, g, b, a] = color2rgba(color_prop.get(logical_index))
      array[4*physical_index  ] = r
      array[4*physical_index+1] = g
      array[4*physical_index+2] = b
      array[4*physical_index+3] = this._alpha_byte(alpha_prop.get(logical_index)*a)
    }

    this.update(is_scalar, offset)
  }

  set_from_hatch_pattern(
    hatch_pattern_prop: Uniform<HatchPattern>,
    delta?: StreamDelta,
    circular_offset?: number,
  ): void {
    const len = hatch_pattern_prop.is_Scalar() ? 1 : hatch_pattern_prop.length
    if (delta != null && !hatch_pattern_prop.is_Scalar() &&
        this.update_from_stream(len, delta, (array, logical_index, physical_index) => {
          array[physical_index] = hatch_pattern_to_index(hatch_pattern_prop.get(logical_index))
        }, circular_offset)) {
      return
    }
    const array = this.get_sized_array(len)

    const offset = hatch_pattern_prop.is_Scalar() ? 0 : circular_offset ?? 0
    for (let logical_index = 0; logical_index < len; logical_index++) {
      array[this.physical_index(logical_index, offset)] = hatch_pattern_to_index(hatch_pattern_prop.get(logical_index))
    }

    this.update(hatch_pattern_prop.is_Scalar(), offset)
  }

  set_from_line_cap(line_cap_prop: Uniform<LineCap>, delta?: StreamDelta, circular_offset?: number): void {
    const len = line_cap_prop.is_Scalar() ? 1 : line_cap_prop.length
    if (delta != null && !line_cap_prop.is_Scalar() &&
        this.update_from_stream(len, delta, (array, logical_index, physical_index) => {
          array[physical_index] = cap_lookup[line_cap_prop.get(logical_index)]
        }, circular_offset)) {
      return
    }
    const array = this.get_sized_array(len)

    const offset = line_cap_prop.is_Scalar() ? 0 : circular_offset ?? 0
    for (let logical_index = 0; logical_index < len; logical_index++) {
      array[this.physical_index(logical_index, offset)] = cap_lookup[line_cap_prop.get(logical_index)]
    }

    this.update(line_cap_prop.is_Scalar(), offset)
  }

  set_from_line_join(line_join_prop: Uniform<LineJoin>, delta?: StreamDelta, circular_offset?: number): void {
    const len = line_join_prop.is_Scalar() ? 1 : line_join_prop.length
    if (delta != null && !line_join_prop.is_Scalar() &&
        this.update_from_stream(len, delta, (array, logical_index, physical_index) => {
          array[physical_index] = join_lookup[line_join_prop.get(logical_index)]
        }, circular_offset)) {
      return
    }
    const array = this.get_sized_array(len)

    const offset = line_join_prop.is_Scalar() ? 0 : circular_offset ?? 0
    for (let logical_index = 0; logical_index < len; logical_index++) {
      array[this.physical_index(logical_index, offset)] = join_lookup[line_join_prop.get(logical_index)]
    }

    this.update(line_join_prop.is_Scalar(), offset)
  }
}

// Normalized refers to optional WebGL behaviour of automatically converting
// Uint8 values that are passed to shaders into floats in the range 0 to 1.
export class NormalizedUint8Buffer extends Uint8Buffer {
  protected override is_normalized(): boolean {
    return true
  }
}

// Expand a scalar or per-item source buffer to per-vertex in the destination buffer.
// Used for non-instanced polygon rendering where all attributes need divisor 0.
// components is the number of elements per item (e.g. 4 for RGBA).
export function expand_to_per_vertex(
  src: {get_array(): ArrayLike<number>, is_scalar_value: boolean},
  dst: {get_sized_array(n: number): ArrayLike<number> & {[i: number]: number}, update(): void},
  vertex_counts: number[],
  components: number,
): void {
  const src_arr = src.get_array()
  let total = 0
  for (const c of vertex_counts) {
    total += c
  }
  const dst_arr = dst.get_sized_array(total * components)
  let offset = 0
  for (let i = 0; i < vertex_counts.length; i++) {
    const src_offset = src.is_scalar_value ? 0 : i * components
    for (let j = 0; j < vertex_counts[i]; j++) {
      for (let c = 0; c < components; c++) {
        dst_arr[offset++] = src_arr[src_offset + c]
      }
    }
  }
  dst.update()
}
