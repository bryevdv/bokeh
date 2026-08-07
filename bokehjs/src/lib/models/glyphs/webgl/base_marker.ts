import type {Vec4} from "regl"
import type {Transform} from "./base"
import {BaseGLGlyph} from "./base"
import {Float32Buffer, NormalizedUint8Buffer, Uint8Buffer} from "./buffer"
import type {LineProps, FillProps, HatchProps, MarkerGlyphProps, GLMarkerType, MarkerDataMapping} from "./types"
import {marker_type_to_size_hint} from "./webgl_utils"
import type * as visuals from "core/visuals"
import type * as p from "core/properties"
import type {HatchPattern} from "core/property_mixins"

export type MarkerVisuals = {
  readonly line: visuals.LineVector
  readonly fill: visuals.FillVector
  readonly hatch: visuals.HatchVector
}

// Abstract base class for markers. All markers share the same GLSL, except for
// one function in the fragment shader that defines the marker geometry and is
// enabled through a #define.
export abstract class BaseMarkerGL extends BaseGLGlyph {
  private readonly _antialias: number = 1.5

  // data properties
  protected readonly _centers = this.own(new Float32Buffer(this.regl_wrapper, 2))

  protected readonly _widths = this.own(new Float32Buffer(this.regl_wrapper))
  protected readonly _heights = this.own(new Float32Buffer(this.regl_wrapper))
  protected readonly _angles = this.own(new Float32Buffer(this.regl_wrapper))
  protected readonly _auxs = this.own(new Float32Buffer(this.regl_wrapper))

  // used by RectGL
  protected _border_radius: Vec4 = [0.0, 0.0, 0.0, 0.0]
  protected _border_radius_nonzero: boolean = false

  // indices properties
  protected readonly _show = this.own(new Uint8Buffer(this.regl_wrapper))
  protected _show_all: boolean = false

  // visual properties
  protected readonly _linewidths = this.own(new Float32Buffer(this.regl_wrapper))
  protected readonly _line_caps = this.own(new Uint8Buffer(this.regl_wrapper))
  protected readonly _line_joins = this.own(new Uint8Buffer(this.regl_wrapper))
  protected readonly _line_rgba = this.own(new NormalizedUint8Buffer(this.regl_wrapper, 4))
  protected readonly _fill_rgba = this.own(new NormalizedUint8Buffer(this.regl_wrapper, 4))

  // Only needed if have hatch pattern, either all or none of the buffers are set.
  protected _have_hatch: boolean = false
  protected readonly _hatch_patterns = this.own(new Uint8Buffer(this.regl_wrapper))
  protected readonly _hatch_scales = this.own(new Float32Buffer(this.regl_wrapper))
  protected readonly _hatch_weights = this.own(new Float32Buffer(this.regl_wrapper))
  protected readonly _hatch_rgba = this.own(new NormalizedUint8Buffer(this.regl_wrapper, 4))

  // Avoiding use of nan or inf to represent missing data in webgl as shaders may
  // have reduced floating point precision. So here using a large-ish negative
  // value instead.
  protected static readonly missing_point = -10000

  protected get data_mapping_mode(): MarkerDataMapping {
    return this.data_mapping == null ? "none" : "point"
  }

  protected get circular_streaming(): boolean {
    return false
  }

  get marker_circular_offset(): number {
    return this.circular_streaming ? this._centers.circular_offset : 0
  }

  get uses_circular_streaming(): boolean {
    return this.circular_streaming
  }

  /**
   * Selects appropriate geometry buffers for rendering a marker glyph.
   *
   * This method implements smart buffer selection to support property overrides in derived
   * glyphs (hover_glyph, selection_glyph, muted_glyph). For each geometry property, it
   * checks if the derived glyph has populated its own buffer; if so, that buffer is used,
   * otherwise it falls back to the main glyph's buffer.
   *
   * This pattern enables zero-overhead overrides: derived glyphs that don't override
   * properties simply reuse main glyph buffers, while overrides are handled via lazy
   * buffer creation detected by length checks.
   *
   * @param derived_gl - The glyph being rendered (may be main or derived glyph)
   * @param main_gl_glyph - The main glyph (used as fallback for unpopulated buffers)
   * @returns Object with buffer references for width, height, angle, aux, and border_radius
   *
   * Note: border_radius always uses main glyph buffer (overrides not supported)
   */
  marker_props(derived_gl: BaseMarkerGL, main_gl_glyph: BaseMarkerGL) {
    // Smart selection: use derived buffer if populated, else main buffer
    const use_derived_width = derived_gl !== main_gl_glyph && derived_gl._widths.length > 0
    const use_derived_height = derived_gl !== main_gl_glyph && derived_gl._heights.length > 0
    const use_derived_angle = derived_gl !== main_gl_glyph && derived_gl._angles.length > 0
    const use_derived_aux = derived_gl !== main_gl_glyph && derived_gl._auxs.length > 0

    return {
      width: use_derived_width ? derived_gl._widths : main_gl_glyph._widths,
      height: use_derived_height ? derived_gl._heights : main_gl_glyph._heights,
      angle: use_derived_angle ? derived_gl._angles : main_gl_glyph._angles,
      aux: use_derived_aux ? derived_gl._auxs : main_gl_glyph._auxs,
      border_radius: main_gl_glyph._border_radius,  // Always from main (overrides not supported)
    }
  }

  get line_props(): LineProps {
    return {
      linewidth: this._linewidths,
      line_color: this._line_rgba,
      line_cap: this._line_caps,
      line_join: this._line_joins,
    }
  }

  get fill_props(): FillProps {
    return {
      fill_color: this._fill_rgba,
    }
  }

  get hatch_props(): HatchProps {
    return {
      hatch_pattern: this._hatch_patterns,
      hatch_scale: this._hatch_scales,
      hatch_weight: this._hatch_weights,
      hatch_color: this._hatch_rgba,
    }
  }

  protected _draw_one_marker_type(
    marker_type: GLMarkerType,
    transform: Transform,
    main_gl_glyph: BaseMarkerGL,
    show: Uint8Buffer = this._show,
  ): void {
    const data_mapping = main_gl_glyph.data_mapping
    const data_mapping_mode = main_gl_glyph.data_mapping_mode
    const total = main_gl_glyph.nvertices
    const offset = main_gl_glyph.marker_circular_offset
    const ranges = offset == 0
      ? [{offset: 0, length: total}]
      : [{offset, length: total - offset}, {offset: 0, length: offset}]

    for (const range of ranges) {
      if (range.length == 0) {
        continue
      }
      const props_no_hatch: MarkerGlyphProps = {
        scissor: this.regl_wrapper.scissor,
        viewport: this.regl_wrapper.viewport,
        canvas_size: [transform.width, transform.height],
        size_hint: marker_type_to_size_hint(marker_type),
        nmarkers: range.length,
        marker_offset: range.offset,
        antialias: this._antialias / transform.pixel_ratio,
        show,
        center: main_gl_glyph._centers,  // Always from main (position overrides not supported)
        data_mapping,
        ...this.marker_props(this, main_gl_glyph),
        ...this.line_props,
        ...this.fill_props,
      }

      if (this._have_hatch) {
        const props_hatch = {...props_no_hatch, ...this.hatch_props}
        const draw = this.regl_wrapper.marker_hatch(marker_type, data_mapping_mode)
        draw(props_hatch)
      } else {
        const draw = this.regl_wrapper.marker_no_hatch(marker_type, data_mapping_mode)
        draw(props_no_hatch)
      }
    }
  }

  private _did_set_once: boolean = false
  set_data(data_changed: boolean = this.data_changed): void {
    if (!this._did_set_once) {
      this._did_set_once = true
      this._set_once()
    }
    this._set_data(data_changed)
    this.consume_stream_geometry()
  }

  protected abstract _set_data(data_changed?: boolean): void

  protected _set_once(): void {}

  protected abstract _get_visuals(): MarkerVisuals

  protected _set_visuals(): void {
    const {line, fill, hatch} = this._get_visuals()
    const delta = this.stream_visuals_delta ?? undefined
    const circular_offset = this.circular_streaming ? this.marker_circular_offset : undefined

    this._linewidths.set_from_prop(line.line_width, delta, circular_offset)
    this._line_caps.set_from_line_cap(line.line_cap, delta, circular_offset)
    this._line_joins.set_from_line_join(line.line_join, delta, circular_offset)
    this._line_rgba.set_from_color(line.line_color, line.line_alpha, delta, circular_offset)
    this._fill_rgba.set_from_color(fill.fill_color, fill.fill_alpha, delta, circular_offset)

    this._have_hatch = hatch.doit
    if (this._have_hatch) {
      this._hatch_patterns.set_from_hatch_pattern(
        hatch.hatch_pattern as p.Uniform<HatchPattern>, delta, circular_offset,
      )
      this._hatch_scales.set_from_prop(hatch.hatch_scale, delta, circular_offset)
      this._hatch_weights.set_from_prop(hatch.hatch_weight, delta, circular_offset)
      this._hatch_rgba.set_from_color(hatch.hatch_color, hatch.hatch_alpha, delta, circular_offset)
    }
    this.consume_stream_visuals()
  }
}
