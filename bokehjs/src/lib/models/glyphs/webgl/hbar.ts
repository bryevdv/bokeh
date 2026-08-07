import type {Vec2} from "regl"
import type {DataMapping} from "./data_mapping"
import {
  create_data_mapping,
  data_mapping_is_precise,
  missing_data_value,
  transform_data_value,
  with_data_origin,
} from "./data_mapping"
import {LRTBGL} from "./lrtb"
import type {ReglWrapper} from "./regl_wrap"
import type {MarkerDataMapping} from "./types"
import type {HBarView} from "../hbar"

export class HBarGL extends LRTBGL {
  protected _data_origin: Vec2 = [0, 0]
  protected _data_error: Vec2 = [0, 0]

  constructor(regl_wrapper: ReglWrapper, override readonly glyph: HBarView) {
    super(regl_wrapper, glyph)
  }

  override set_data_changed(): void {
    if (this.stream_delta == null) {
      this._data_error = [0, 0]
    }
    super.set_data_changed()
  }

  override get data_mapping(): DataMapping | null {
    if (this.glyph.model.properties.height.units != "data") {
      return null
    }
    const {x_scale, y_scale} = this.glyph.renderer.coordinates
    const mapping = create_data_mapping(x_scale, y_scale)
    if (mapping == null || !data_mapping_is_precise(mapping, this._data_error)) {
      return null
    }
    return with_data_origin(mapping, this._data_origin)
  }

  override maps_coordinate(attr: string): boolean {
    return attr == "left" || attr == "right" || attr == "y"
  }

  protected override get data_mapping_mode(): MarkerDataMapping {
    return this.data_mapping == null ? "none" : "rect"
  }

  protected override get circular_streaming(): boolean {
    return this.data_mapping != null
  }

  protected override get uniform_only_mapping(): boolean {
    return true
  }

  private _write_item(
    i: number,
    mapping: DataMapping,
    centers: Float32Array,
    second_x: Float32Array,
    second_y: Float32Array,
    origin: Vec2,
    physical_i: number = i,
  ): Vec2 {
    const {left, right, y, height} = this.glyph
    const half_height = height.get(i)/2
    const tx0 = transform_data_value(left[i], mapping.x.kind)
    const ty0 = transform_data_value(y[i] + half_height, mapping.y.kind)
    const tx1 = transform_data_value(right[i], mapping.x.kind)
    const ty1 = transform_data_value(y[i] - half_height, mapping.y.kind)
    const j = 2*physical_i
    if (tx0 == missing_data_value || ty0 == missing_data_value ||
        tx1 == missing_data_value || ty1 == missing_data_value) {
      centers[j] = missing_data_value
      centers[j + 1] = missing_data_value
      second_x[physical_i] = missing_data_value
      second_y[physical_i] = missing_data_value
      return [0, 0]
    }

    const dx0 = Math.fround(tx0 - origin[0])
    const dy0 = Math.fround(ty0 - origin[1])
    const dx1 = Math.fround(tx1 - origin[0])
    const dy1 = Math.fround(ty1 - origin[1])
    if (!isFinite(dx0 + dy0 + dx1 + dy1)) {
      centers[j] = missing_data_value
      centers[j + 1] = missing_data_value
      second_x[physical_i] = missing_data_value
      second_y[physical_i] = missing_data_value
      return [0, 0]
    }

    centers[j] = dx0
    centers[j + 1] = dy0
    second_x[physical_i] = dx1
    second_y[physical_i] = dy1
    return [
      Math.max(Math.abs((origin[0] + dx0) - tx0), Math.abs((origin[0] + dx1) - tx1)),
      Math.max(Math.abs((origin[1] + dy0) - ty0), Math.abs((origin[1] + dy1) - ty1)),
    ]
  }

  private _find_origin(mapping: DataMapping): Vec2 {
    const {left, right, y, height} = this.glyph
    let origin_x = 0
    let origin_y = 0
    for (let i = 0; i < this.nvertices; i++) {
      const tx0 = transform_data_value(left[i], mapping.x.kind)
      const tx1 = transform_data_value(right[i], mapping.x.kind)
      if (tx0 != missing_data_value && tx1 != missing_data_value) {
        origin_x = tx0
        break
      }
    }
    for (let i = 0; i < this.nvertices; i++) {
      const half_height = height.get(i)/2
      const ty0 = transform_data_value(y[i] + half_height, mapping.y.kind)
      const ty1 = transform_data_value(y[i] - half_height, mapping.y.kind)
      if (ty0 != missing_data_value && ty1 != missing_data_value) {
        origin_y = ty0
        break
      }
    }
    return [origin_x, origin_y]
  }

  private _stream_data_geometry(mapping: DataMapping): boolean {
    const delta = this.stream_delta
    const nmarkers = this.nvertices
    if (delta == null || !this.can_stream_geometry(delta, nmarkers)) {
      return false
    }

    const buffers = [this._centers, this._widths, this._heights]
    if (!buffers.every((buffer) => buffer.can_update_circular_stream(nmarkers, delta))) {
      return false
    }
    const circular_offset = this._centers.next_circular_offset(delta)
    if (!buffers.every((buffer) => buffer.next_circular_offset(delta) == circular_offset)) {
      return false
    }

    const centers = this._centers.get_array()
    const second_x = this._widths.get_array()
    const second_y = this._heights.get_array()

    let [error_x, error_y] = this._data_error
    const start = nmarkers - delta.new_rows
    for (let i = start; i < nmarkers; i++) {
      const physical_i = this._centers.physical_index(i, circular_offset)
      const [x_error, y_error] = this._write_item(
        i, mapping, centers, second_x, second_y, this._data_origin, physical_i,
      )
      error_x = Math.max(error_x, x_error)
      error_y = Math.max(error_y, y_error)
    }

    const error: Vec2 = [error_x, error_y]
    if (!data_mapping_is_precise(mapping, error)) {
      return false
    }

    this._data_error = error
    for (const buffer of buffers) {
      buffer.commit_circular_stream(nmarkers, delta, circular_offset)
    }
    return true
  }

  protected override _set_data(): void {
    const {data_mapping} = this
    if (data_mapping == null) {
      this.glyph.ensure_screen_data()
      super._set_data()
      return
    }
    if (this._stream_data_geometry(data_mapping)) {
      return
    }

    const nmarkers = this.nvertices
    const centers = this._centers.get_sized_array(2*nmarkers)
    const second_x = this._widths.get_sized_array(nmarkers)
    const second_y = this._heights.get_sized_array(nmarkers)
    const origin = this._find_origin(data_mapping)
    let error_x = 0
    let error_y = 0
    for (let i = 0; i < nmarkers; i++) {
      const [x_error, y_error] = this._write_item(i, data_mapping, centers, second_x, second_y, origin)
      error_x = Math.max(error_x, x_error)
      error_y = Math.max(error_y, y_error)
    }

    const error: Vec2 = [error_x, error_y]
    this._data_origin = origin
    this._data_error = error
    if (!data_mapping_is_precise(data_mapping, error)) {
      this.glyph.ensure_screen_data()
      super._set_data()
      return
    }

    this._centers.update()
    this._widths.update()
    this._heights.update()
    this._angles.set_from_scalar(0)
    this.set_border_radius()
  }
}
