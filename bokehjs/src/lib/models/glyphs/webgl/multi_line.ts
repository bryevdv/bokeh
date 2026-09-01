import type {Framebuffer2D, Texture2D} from "regl"
import type {Transform} from "./base"
import {BaseLineGL} from "./base_line"
import type {BaseLineVisuals} from "./base_line"
import {Float32Buffer, Uint8Buffer} from "./buffer"
import type {ReglWrapper} from "./regl_wrap"
import type {AccumulateProps} from "./types"
import type {MultiLineView} from "../multi_line"
import type {DataMapping} from "./data_mapping"
import {
  create_data_mapping, data_mapping_is_precise, is_valid_data_point, missing_data_value, pack_data_points,
  with_data_origin,
} from "./data_mapping"
import {resolve_line_dash} from "core/visuals/line"
import {normalize_dash_pattern} from "./dash_cache"
import type {Vec2} from "regl"

export class MultiLineGL extends BaseLineGL {
  private _point_offsets: number[] = []
  private _point_mapping_signature: string | null | undefined
  private _data_origin: Vec2 = [0, 0]
  private _data_error: Vec2 = [0, 0]
  private _variants_are_solid?: boolean

  constructor(regl_wrapper: ReglWrapper, override readonly glyph: MultiLineView) {
    super(regl_wrapper, glyph)
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
    return attr == "xs" || attr == "ys"
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

  private _all_render_variants_are_solid(): boolean {
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
    ].filter((view) => view != null) as MultiLineView[]

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

  override draw(indices: number[], main_glyph: MultiLineView, transform: Transform): void {
    // Indices refer to whole lines not line segments
    if (this.visuals_changed) {
      this._set_visuals()
      this.visuals_changed = false
    }

    const main_gl_glyph = main_glyph.glglyph!
    const mapping_signature = main_gl_glyph.data_mapping?.signature ?? null
    const mapping_mode_changed = mapping_signature != main_gl_glyph._point_mapping_signature
    const update_points = main_gl_glyph.data_changed || mapping_mode_changed ||
      (main_gl_glyph.data_mapped && mapping_signature == null)
    const data_changed_or_mapped = main_gl_glyph.data_changed || main_gl_glyph.data_mapped || mapping_mode_changed

    if (update_points) {
      main_gl_glyph._set_data(main_gl_glyph.data_changed || mapping_mode_changed)
      main_gl_glyph._point_mapping_signature = main_gl_glyph.data_mapping?.signature ?? null
    }

    if ((data_changed_or_mapped && main_gl_glyph._is_dashed) || this._is_dashed) {
      // length_so_far is a data property as it depends on point positions in canvas coordinates
      // but is only needed for dashed lines so it also depends on visual properties.
      // Care needed if base glyph is solid but e.g. nonselection glyph is dashed.
      main_gl_glyph._set_length()
    }

    if (data_changed_or_mapped) {
      main_gl_glyph.data_changed = false
      main_gl_glyph.data_mapped = false
    }

    const {data_size} = this.glyph  // Number of lines
    let framebuffer: Framebuffer2D | null = null
    let tex: Texture2D | null = null
    if (data_size > 1) {
      [framebuffer, tex] = this.regl_wrapper.framebuffer_and_texture
    }

    for (const index of indices) {
      const npoints = main_glyph.xs.get(index).length
      const nsegments = npoints - 1  // Points array includes extra points at each end
      if (nsegments <= 0) {
        continue
      }
      const point_offset = main_gl_glyph._point_offsets[index]

      // Not necessary if just a single line
      if (framebuffer != null) {
        this.regl_wrapper.clear_framebuffer(framebuffer)
      }

      const scissor = this._draw_single(main_gl_glyph, transform, index, point_offset, nsegments, framebuffer)

      if (framebuffer != null) {
        // Accumulate framebuffer to WebGL canvas
        const accumulate_props: AccumulateProps = {
          scissor,
          viewport: this.regl_wrapper.viewport,
          framebuffer_tex: tex!,
        }

        this.regl_wrapper.accumulate()(accumulate_props)
      }

    }
  }

  protected _get_visuals(): BaseLineVisuals {
    return this.glyph.visuals.line
  }

  protected _set_data(data_changed: boolean): void {
    // If data_changed is false the underlying glyph data has not changed but has been mapped to
    // different canvas coordinates e.g. via pan or zoom. If data_changed is true the data itself
    // has changed, which also implies it has been mapped.

    // Set data properties which are points and show flags for data
    // (taking into account NaNs but not selected indices)
    const line_count = this.glyph.data_size
    const {data_mapping} = this
    const xs = data_mapping != null ? this.glyph.xs : this.glyph.sxs
    const ys = data_mapping != null ? this.glyph.ys : this.glyph.sys
    const total_point_count = xs.data.length

    if (this._points == null) {
      this._points = this.own(new Float32Buffer(this.regl_wrapper))
    }
    const points_array = this._points.get_sized_array((total_point_count + 2*line_count)*2)

    let packed: Float32Array | null = null
    if (data_mapping != null) {
      packed = new Float32Array(2*total_point_count)
      const {origin, error} = pack_data_points(packed, this.glyph.xs.data, this.glyph.ys.data, data_mapping)
      this._data_origin = origin
      this._data_error = error
      if (!data_mapping_is_precise(data_mapping, error)) {
        this.glyph.ensure_screen_data()
        this._set_data(data_changed)
        return
      }
    }

    let point_offset = 0
    let source_point_offset = 0
    for (let i = 0; i < line_count; i++) {
      if (data_changed) {
        this._point_offsets[i] = point_offset
      }
      // Process a single line at a time.
      const x = xs.get(i)
      const y = ys.get(i)
      const npoints = x.length

      const points = points_array.subarray(point_offset, point_offset + (npoints+2)*2)
      if (packed == null) {
        this._set_points_single(points, x, y)
      } else {
        points.set(packed.subarray(2*source_point_offset, 2*(source_point_offset + npoints)), 2)
        const is_closed = npoints > 2 && x[0] == x[npoints - 1] && y[0] == y[npoints - 1] &&
          is_valid_data_point(x[0], y[0], data_mapping!)
        if (is_closed) {
          points.copyWithin(0, 2*(npoints - 1), 2*npoints)
          points.copyWithin(2*(npoints + 1), 4, 6)
        } else {
          points[0] = missing_data_value
          points[1] = missing_data_value
          points[2*npoints + 2] = missing_data_value
          points[2*npoints + 3] = missing_data_value
        }
      }

      point_offset += (npoints + 2)*2
      source_point_offset += npoints
    }
    if (data_changed) {
      this._point_offsets.length = line_count
    }

    this._points.update()

    if (data_changed) {
      if (this._show == null) {
        this._show = this.own(new Uint8Buffer(this.regl_wrapper))
      }
      const show_array = this._show.get_sized_array(total_point_count + line_count)

      let point_offset = 0
      let show_offset = 0
      for (let i = 0; i < line_count; i++) {
        // Process a single line at a time.
        const x = xs.get(i)
        const y = ys.get(i)
        const npoints = x.length

        const points = points_array.subarray(point_offset, point_offset + (npoints+2)*2)

        const show = show_array.subarray(show_offset, show_offset + npoints+1)
        if (data_mapping == null) {
          this._set_show_single(show, points)
        } else {
          let start_valid = npoints > 0 && is_valid_data_point(x[0], y[0], data_mapping)
          for (let j = 1; j < npoints; j++) {
            const end_valid = is_valid_data_point(x[j], y[j], data_mapping)
            show[j] = start_valid && end_valid ? 1 : 0
            start_valid = end_valid
          }
          const closed = npoints > 2 && x[0] == x[npoints - 1] && y[0] == y[npoints - 1]
          if (closed) {
            show[0] = show[npoints - 1]
            show[npoints] = show[1]
          } else {
            show[0] = 0
            show[npoints] = 0
          }
        }

        point_offset += (npoints + 2)*2
        show_offset += npoints + 1
      }

      this._show.update()
    }
  }

  protected _set_length(): void {
    const line_count = this.glyph.data_size
    const total_point_count = this.glyph.sxs.data.length

    const points_array = this._points!.get_array()
    const show_array = this._show!.get_array()

    if (this._length_so_far == null) {
      this._length_so_far = this.own(new Float32Buffer(this.regl_wrapper))
    }
    const length_so_far = this._length_so_far.get_sized_array(total_point_count - line_count)

    let point_offset = 0
    let show_offset = 0
    let length_offset = 0
    for (let i = 0; i < line_count; i++) {
      const sx = this.glyph.sxs.get(i)
      const npoints = sx.length
      const nsegments = npoints - 1

      const points = points_array.subarray(point_offset, point_offset + (npoints+2)*2)
      const show = show_array.subarray(show_offset, show_offset + npoints+1)
      const length = length_so_far.subarray(length_offset, length_offset + nsegments)
      this._set_length_single(length, points, show)

      point_offset += (npoints + 2)*2
      show_offset += npoints + 1
      length_offset += nsegments
    }

    this._length_so_far.update()
  }
}
