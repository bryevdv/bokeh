import type {Transform} from "./base"
import type {MarkerVisuals} from "./base_marker"
import {BaseMarkerGL} from "./base_marker"
import type {ReglWrapper} from "./regl_wrap"
import type {GLMarkerType} from "./types"
import type {GlyphView} from "../glyph"

export type SingleMarkerGlyphView = GlyphView & {
  visuals: MarkerVisuals
  glglyph?: SingleMarkerGL
}

export abstract class SingleMarkerGL extends BaseMarkerGL {
  private _visible_indices: number[] = []
  private _mapping_signature: string | null | undefined
  constructor(regl_wrapper: ReglWrapper, override readonly glyph: SingleMarkerGlyphView) {
    super(regl_wrapper, glyph)
  }

  abstract get marker_type(): GLMarkerType

  /** Whether range changes are represented entirely by mapping uniforms. */
  protected get uniform_only_mapping(): boolean {
    return false
  }

  protected override _get_visuals(): MarkerVisuals {
    return this.glyph.visuals
  }

  draw(indices: number[], main_glyph: SingleMarkerGlyphView, transform: Transform): void {
    this._draw_impl(indices, transform, main_glyph.glglyph!)
  }

  protected _draw_impl(indices: number[], transform: Transform, main_gl_glyph: SingleMarkerGL): void {
    const stream_delta = this.stream_delta ?? undefined
    const main_mapping_signature = main_gl_glyph.data_mapping?.signature ?? null
    const main_mapping_changed = main_mapping_signature != main_gl_glyph._mapping_signature
    if (main_gl_glyph.data_changed || main_mapping_changed ||
        (main_gl_glyph.data_mapped && !(main_gl_glyph.uniform_only_mapping && main_mapping_signature != null))) {
      main_gl_glyph.set_data(main_gl_glyph.data_changed)
      main_gl_glyph._mapping_signature = main_gl_glyph.data_mapping?.signature ?? null
    }
    main_gl_glyph.data_changed = false
    main_gl_glyph.data_mapped = false

    // Update derived glyph data if it has overrides
    const derived_mapping_signature = this.data_mapping?.signature ?? null
    const derived_mapping_changed = derived_mapping_signature != this._mapping_signature
    if (this !== main_gl_glyph && (this.data_changed || derived_mapping_changed ||
        (this.data_mapped && !(this.uniform_only_mapping && derived_mapping_signature != null)))) {
      this.set_data(this.data_changed)  // Populate derived buffers
      this._mapping_signature = this.data_mapping?.signature ?? null
    }
    if (this !== main_gl_glyph) {
      this.data_changed = false
      this.data_mapped = false
    }

    if (this.visuals_changed) {
      this._set_visuals()
      this.visuals_changed = false
    }

    const nmarkers = main_gl_glyph.nvertices

    const prev_nmarkers = this._show.length
    const show_array = this._show.get_sized_array(nmarkers)
    const selection_changed = this.revision_changed("selection", "single-marker-mask")
    if (main_gl_glyph.uses_circular_streaming) {
      const show_all = indices.length >= nmarkers
      const visible = show_all ? null : new Set(indices)
      const circular_offset = main_gl_glyph.marker_circular_offset
      const can_stream =
        stream_delta != null &&
        prev_nmarkers == nmarkers &&
        selection_changed == false &&
        this._show_all == show_all

      if (can_stream || prev_nmarkers != nmarkers || selection_changed ||
          this._show_all != show_all || this._show.circular_offset != circular_offset) {
        this._show.set_from_function(
          nmarkers,
          (array, logical_index, physical_index) => {
            array[physical_index] = show_all || visible!.has(logical_index) ? 255 : 0
          },
          can_stream ? stream_delta : undefined,
          circular_offset,
        )
      }
      this._show_all = show_all
      this._visible_indices = show_all ? [] : [...indices]
      this.consume_revision("selection", "single-marker-mask")
      this._draw_one_marker_type(this.marker_type, transform, main_gl_glyph)
      return
    }

    let show_changed = false
    let changed_indices: number[] | null = null
    if (indices.length < nmarkers) {
      const was_show_all = this._show_all
      this._show_all = false
      if (prev_nmarkers != nmarkers || selection_changed) {
        if (prev_nmarkers == nmarkers && !was_show_all) {
          const previous = new Set(this._visible_indices)
          const next = new Set(indices)
          changed_indices = []
          for (const index of previous) {
            if (!next.has(index)) {
              show_array[index] = 0
              changed_indices.push(index)
            }
          }
          for (const index of next) {
            if (!previous.has(index)) {
              show_array[index] = 255
              changed_indices.push(index)
            }
          }
        } else {
          show_array.fill(0)
          for (const index of indices) {
            show_array[index] = 255
          }
        }
        this._visible_indices = [...indices]
        show_changed = true
      }
    } else if (!this._show_all || prev_nmarkers != nmarkers) {
      this._show_all = true
      this._visible_indices = []
      show_array.fill(255)
      show_changed = true
    }
    if (show_changed) {
      if (changed_indices != null && changed_indices.length <= nmarkers/4) {
        this._show.update_ranges(changed_indices)
      } else {
        this._show.update()
      }
    }
    this.consume_revision("selection", "single-marker-mask")

    this._draw_one_marker_type(this.marker_type, transform, main_gl_glyph)
  }
}
