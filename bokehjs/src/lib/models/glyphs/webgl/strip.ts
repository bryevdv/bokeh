import type {DataMapping} from "./data_mapping"
import {
  create_axis_data_mapping, create_data_mapping_from_axes, create_frame_axis_mapping,
  data_mapping_is_precise, with_data_origin,
} from "./data_mapping"
import {QuadGL} from "./quad"
import type {ReglWrapper} from "./regl_wrap"
import type {MarkerDataMapping} from "./types"
import type {HStripView} from "../hstrip"
import type {VStripView} from "../vstrip"

export class HStripGL extends QuadGL {
  constructor(regl_wrapper: ReglWrapper, override readonly glyph: HStripView) {
    super(regl_wrapper, glyph)
  }

  override maps_coordinate(_attr: string): boolean {
    return false
  }

  protected override get data_mapping_mode(): MarkerDataMapping {
    return this.data_mapping == null ? "none" : "hstrip"
  }

  override get data_mapping(): DataMapping | null {
    const y = create_axis_data_mapping(this.glyph.renderer.coordinates.y_scale)
    if (y == null) {
      return null
    }
    const {left, right} = this.glyph.renderer.plot_view.frame.bbox
    const x = create_frame_axis_mapping(left, right)
    const mapping = create_data_mapping_from_axes(x, y, `frame:${y.kind}`)
    if (!data_mapping_is_precise(mapping, this._data_error)) {
      return null
    }
    return with_data_origin(mapping, this._data_origin)
  }
}

export class VStripGL extends QuadGL {
  constructor(regl_wrapper: ReglWrapper, override readonly glyph: VStripView) {
    super(regl_wrapper, glyph)
  }

  override maps_coordinate(_attr: string): boolean {
    return false
  }

  protected override get data_mapping_mode(): MarkerDataMapping {
    return this.data_mapping == null ? "none" : "vstrip"
  }

  override get data_mapping(): DataMapping | null {
    const x = create_axis_data_mapping(this.glyph.renderer.coordinates.x_scale)
    if (x == null) {
      return null
    }
    const {top, bottom} = this.glyph.renderer.plot_view.frame.bbox
    const y = create_frame_axis_mapping(top, bottom)
    const mapping = create_data_mapping_from_axes(x, y, `${x.kind}:frame`)
    if (!data_mapping_is_precise(mapping, this._data_error)) {
      return null
    }
    return with_data_origin(mapping, this._data_origin)
  }
}
