import type {Vec2} from "regl"
import type {Transform} from "./base"
import {Float32Buffer, Uint8Buffer} from "./buffer"
import type {DataMapping} from "./data_mapping"
import {
  create_data_mapping, data_mapping_is_precise, is_valid_data_point, pack_data_rects, with_data_origin,
} from "./data_mapping"
import {normalize_dash_pattern} from "./dash_cache"
import {PathGL} from "./path"
import type {PathGlyphView} from "./path"
import type {ReglWrapper} from "./regl_wrap"
import type {CoordinateRounding, SegmentGlyphProps} from "./types"
import {interleave} from "./webgl_utils"
import {resolve_line_dash} from "core/visuals/line"
import type {Arrayable} from "core/types"

export type SegmentLikeView = PathGlyphView & {
  glglyph?: SegmentGL
  x0: Arrayable<number>
  y0: Arrayable<number>
  x1: Arrayable<number>
  y1: Arrayable<number>
  sx0: Arrayable<number>
  sy0: Arrayable<number>
  sx1: Arrayable<number>
  sy1: Arrayable<number>
}

export class SegmentGL extends PathGL {
  private readonly _start = this.own(new Float32Buffer(this.regl_wrapper, 2))
  private readonly _end = this.own(new Float32Buffer(this.regl_wrapper, 2))
  private readonly _valid = this.own(new Uint8Buffer(this.regl_wrapper))
  private readonly _hidden = this.own(new Uint8Buffer(this.regl_wrapper))
  private readonly _selection_show = this.own(new Uint8Buffer(this.regl_wrapper))
  private _mapping_signature: string | null | undefined
  protected _data_origin: Vec2 = [0, 0]
  protected _data_error: Vec2 = [0, 0]
  private _variants_are_solid?: boolean
  private _data_revision = 0
  private _show_data_revision = -1

  constructor(regl_wrapper: ReglWrapper, override readonly glyph: SegmentLikeView) {
    super(regl_wrapper, glyph)
    this._hidden.set_from_scalar(0)
  }

  override set_data_changed(): void {
    this._data_error = [0, 0]
    super.set_data_changed()
  }

  override set_visuals_changed(): void {
    this._variants_are_solid = undefined
    super.set_visuals_changed()
  }

  override maps_coordinate(attr: string): boolean {
    return attr == "x0" || attr == "y0" || attr == "x1" || attr == "y1"
  }

  override get data_mapping(): DataMapping | null {
    if (!this._all_render_variants_are_solid()) {
      return null
    }
    const {x_scale, y_scale} = this.glyph.renderer.coordinates
    const mapping = create_data_mapping(x_scale, y_scale)
    if (mapping == null || !data_mapping_is_precise(mapping, this._data_error)) {
      return null
    }
    return with_data_origin(mapping, this._data_origin)
  }

  protected get coordinate_rounding(): CoordinateRounding {
    return "none"
  }

  protected _all_render_variants_are_solid(): boolean {
    if (this._variants_are_solid != null) {
      return this._variants_are_solid
    }
    const parent = this.glyph.parent
    const views = [
      parent.glyph,
      parent.decimated_glyph,
      parent.selection_glyph,
      parent.nonselection_glyph,
      parent.hover_glyph,
      parent.muted_glyph,
    ].filter((view) => view != null) as SegmentLikeView[]
    for (const view of views) {
      const {line_dash} = view.visuals.line
      for (let i = 0; i < line_dash.length; i++) {
        if (normalize_dash_pattern(resolve_line_dash(line_dash.get(i))).length != 0) {
          this._variants_are_solid = false
          return this._variants_are_solid
        }
      }
    }
    this._variants_are_solid = true
    return this._variants_are_solid
  }

  override draw(indices: number[], main_glyph: SegmentLikeView, transform: Transform): void {
    const main_gl = main_glyph.glglyph!
    if (!this._all_render_variants_are_solid()) {
      main_glyph.ensure_screen_data()
      if (main_gl._mapping_signature != null) {
        main_gl.data_mapped = true
        main_gl._mapping_signature = null
      }
      super.draw(indices, main_glyph, transform)
      return
    }

    if (this.visuals_changed) {
      this._set_visuals()
      this.visuals_changed = false
    }

    const mapping_signature = main_gl.data_mapping?.signature ?? null
    const mapping_changed = mapping_signature != main_gl._mapping_signature
    if (main_gl.data_changed || mapping_changed || (main_gl.data_mapped && mapping_signature == null)) {
      main_gl._set_segment_data()
      main_gl._mapping_signature = main_gl.data_mapping?.signature ?? null
    }
    main_gl.data_changed = false
    main_gl.data_mapped = false

    const show = this._get_selection_show(indices, main_gl)
    const data_mapping = main_gl.data_mapping
    const props: SegmentGlyphProps = {
      scissor: this.regl_wrapper.scissor,
      viewport: this.regl_wrapper.viewport,
      canvas_size: [transform.width, transform.height],
      antialias: this._antialias/transform.pixel_ratio,
      miter_limit: this._miter_limit,
      start: main_gl._start,
      end: main_gl._end,
      show,
      hidden: main_gl._hidden,
      nsegments: main_gl.nvertices,
      linewidth: this._linewidth,
      line_color: this._line_color,
      line_cap: this._line_cap,
      line_join: this._line_join,
      data_mapping,
    }
    this.regl_wrapper.segment(data_mapping != null, this.coordinate_rounding)(props)
  }

  protected _set_segment_data(): void {
    const n = this.nvertices
    const starts = this._start.get_sized_array(2*n)
    const ends = this._end.get_sized_array(2*n)
    const valid = this._valid.get_sized_array(n)
    const {data_mapping} = this
    if (data_mapping != null) {
      const end_x = new Float32Array(n)
      const end_y = new Float32Array(n)
      const {origin, error} = pack_data_rects(
        starts, end_x, end_y,
        this.glyph.x0, this.glyph.y0, this.glyph.x1, this.glyph.y1,
        data_mapping,
      )
      this._data_origin = origin
      this._data_error = error
      if (!data_mapping_is_precise(data_mapping, error)) {
        this.glyph.ensure_screen_data()
        this._set_segment_data()
        return
      }
      interleave(end_x, end_y, n, 0, ends)
      for (let i = 0; i < n; i++) {
        valid[i] = is_valid_data_point(this.glyph.x0[i], this.glyph.y0[i], data_mapping) &&
          is_valid_data_point(this.glyph.x1[i], this.glyph.y1[i], data_mapping) ? 1 : 0
      }
    } else {
      this.glyph.ensure_screen_data()
      interleave(this.glyph.sx0, this.glyph.sy0, n, 0, starts)
      interleave(this.glyph.sx1, this.glyph.sy1, n, 0, ends)
      for (let i = 0; i < n; i++) {
        valid[i] = isFinite(this.glyph.sx0[i] + this.glyph.sy0[i] + this.glyph.sx1[i] + this.glyph.sy1[i]) ? 1 : 0
      }
    }
    this._start.update()
    this._end.update()
    this._valid.update()
    this._data_revision++
  }

  private _get_selection_show(indices: number[], main_gl: SegmentGL): Uint8Buffer {
    if (indices.length == main_gl.nvertices) {
      return main_gl._valid
    }
    const selection_changed = this.revision_changed("selection", "segment-mask")
    if (selection_changed || this._show_data_revision != main_gl._data_revision ||
        this._selection_show.length != main_gl.nvertices) {
      const show = this._selection_show.get_sized_array(main_gl.nvertices)
      const valid = main_gl._valid.get_array()
      show.fill(0)
      for (const index of indices) {
        show[index] = valid[index]
      }
      this._selection_show.update()
      this._show_data_revision = main_gl._data_revision
    }
    this.consume_revision("selection", "segment-mask")
    return this._selection_show
  }
}
