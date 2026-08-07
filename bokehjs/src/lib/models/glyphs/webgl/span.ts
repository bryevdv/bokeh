import type {DataMapping} from "./data_mapping"
import {
  create_axis_data_mapping, create_data_mapping_from_axes, create_frame_axis_mapping,
  data_mapping_is_precise, with_data_origin,
} from "./data_mapping"
import type {ReglWrapper} from "./regl_wrap"
import {SegmentGL} from "./segment"
import type {CoordinateRounding} from "./types"
import type {HSpanView} from "../hspan"
import type {VSpanView} from "../vspan"

export class HSpanGL extends SegmentGL {
  constructor(regl_wrapper: ReglWrapper, override readonly glyph: HSpanView) {
    super(regl_wrapper, glyph)
  }

  override maps_coordinate(_attr: string): boolean {
    return false
  }

  protected override get coordinate_rounding(): CoordinateRounding {
    return "y"
  }

  override get data_mapping(): DataMapping | null {
    if (!this._all_render_variants_are_solid()) {
      return null
    }
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

export class VSpanGL extends SegmentGL {
  constructor(regl_wrapper: ReglWrapper, override readonly glyph: VSpanView) {
    super(regl_wrapper, glyph)
  }

  override maps_coordinate(_attr: string): boolean {
    return false
  }

  protected override get coordinate_rounding(): CoordinateRounding {
    return "x"
  }

  override get data_mapping(): DataMapping | null {
    if (!this._all_render_variants_are_solid()) {
      return null
    }
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
