import type {ReglWrapper} from "./regl_wrap"
import type {SingleMarkerGlyphView} from "./single_marker"
import {SingleMarkerGL} from "./single_marker"
import {interleave} from "./webgl_utils"
import type {Arrayable} from "core/types"
import type {DataMapping} from "./data_mapping"
import {create_data_mapping, data_mapping_is_precise, pack_data_points, with_data_origin} from "./data_mapping"
import type {Vec2} from "regl"

// NOTE: this is not equivalent to XYGlyphView
export type SXSYGlyphView = SingleMarkerGlyphView & {
  x: Arrayable<number>
  y: Arrayable<number>
  sx: Arrayable<number>
  sy: Arrayable<number>
}

export abstract class SXSYGlyphGL extends SingleMarkerGL {
  private _center_mapping_signature: string | null | undefined
  private _data_origin: Vec2 = [0, 0]
  private _data_error: Vec2 = [0, 0]

  constructor(regl_wrapper: ReglWrapper, override readonly glyph: SXSYGlyphView) {
    super(regl_wrapper, glyph)
  }

  override set_data_changed(): void {
    this._data_error = [0, 0]
    super.set_data_changed()
  }

  override get data_mapping(): DataMapping | null {
    const {x_scale, y_scale} = this.glyph.renderer.coordinates
    const mapping = create_data_mapping(x_scale, y_scale)
    if (mapping == null || !data_mapping_is_precise(mapping, this._data_error)) {
      return null
    }
    return with_data_origin(mapping, this._data_origin)
  }

  protected override _set_data(): void {
    const nmarkers = this.nvertices
    const centers_array = this._centers.get_sized_array(2*nmarkers)
    const {data_mapping} = this
    if (data_mapping != null) {
      if (this.data_changed || this._center_mapping_signature != data_mapping.signature) {
        const {origin, error} = pack_data_points(centers_array, this.glyph.x, this.glyph.y, data_mapping)
        this._data_origin = origin
        this._data_error = error
        if (!data_mapping_is_precise(data_mapping, error)) {
          this.glyph.ensure_screen_data()
          interleave(this.glyph.sx, this.glyph.sy, nmarkers, SingleMarkerGL.missing_point, centers_array)
          this._center_mapping_signature = null
        } else {
          this._center_mapping_signature = data_mapping.signature
        }
        this._centers.update()
      }
    } else {
      this.glyph.ensure_screen_data()
      interleave(this.glyph.sx, this.glyph.sy, nmarkers, SingleMarkerGL.missing_point, centers_array)
      this._centers.update()
      this._center_mapping_signature = null
    }
  }
}
