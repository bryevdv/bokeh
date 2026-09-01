// This module implements the Base GL Glyph and some utilities
import type {Context2d} from "core/util/canvas"
import type {GlyphView} from "../glyph"
import type {ReglWrapper} from "./regl_wrap"
import type {GPUResource} from "./resource_owner"
import {GPUResourceOwner} from "./resource_owner"
import type {RevisionDomain} from "./revisions"
import type {RevisionSnapshot} from "./revisions"
import {RevisionState} from "./revisions"
import type {DataMapping} from "./data_mapping"
import type {StreamDelta} from "core/patching"

export type BaseGLGlyphConstructor = {
  new(regl: ReglWrapper, base_glyph: GlyphView): BaseGLGlyph
}

export abstract class BaseGLGlyph {
  protected nvertices: number = 0
  private readonly _resources = new GPUResourceOwner()
  protected readonly revisions = new RevisionState()
  private _stream_geometry_delta: StreamDelta | null = null
  private _stream_visuals_delta: StreamDelta | null = null

  protected get stream_delta(): StreamDelta | null {
    return this._stream_geometry_delta
  }

  protected get stream_visuals_delta(): StreamDelta | null {
    return this._stream_visuals_delta
  }

  protected get data_changed(): boolean {
    return this.revisions.changed("geometry", "legacy-data")
  }
  protected set data_changed(changed: boolean) {
    if (changed) {
      this.revisions.bump("geometry")
    } else {
      this.revisions.consume("geometry", "legacy-data")
    }
  }

  protected get data_mapped(): boolean {
    return this.revisions.changed("mapping", "legacy-mapping")
  }
  protected set data_mapped(changed: boolean) {
    if (changed) {
      this.revisions.bump("mapping")
    } else {
      this.revisions.consume("mapping", "legacy-mapping")
    }
  }

  protected get visuals_changed(): boolean {
    return this.revisions.changed("visuals", "legacy-visuals")
  }
  protected set visuals_changed(changed: boolean) {
    if (changed) {
      this.revisions.bump("visuals")
    } else {
      this.revisions.consume("visuals", "legacy-visuals")
    }
  }

  constructor(protected readonly regl_wrapper: ReglWrapper, readonly glyph: GlyphView) {}

  get diagnostics(): {revisions: RevisionSnapshot, resources: number, destroyed: boolean} {
    return {
      revisions: this.revisions.snapshot,
      resources: this._resources.size,
      destroyed: this._resources.destroyed,
    }
  }

  /** Optional vertex-shader mapping for immutable data-coordinate buffers. */
  get data_mapping(): DataMapping | null {
    return null
  }

  /** Coordinate specs consumed directly by this WebGL implementation. */
  maps_coordinate(attr: string): boolean {
    return attr == "x" || attr == "y"
  }

  set_data_changed(): void {
    const {data_size} = this.glyph
    if (data_size != this.nvertices) {
      this.nvertices = data_size
    }
    this.revisions.bump("geometry")
  }

  set_data_mapped(): void {
    this.revisions.bump("mapping")
  }

  set_visuals_changed(): void {
    this.revisions.bump("visuals")
  }

  private _merge_streaming(previous: StreamDelta | null, delta: StreamDelta): StreamDelta {
    if (previous == null || previous.new_length != delta.old_length) {
      return delta
    }

    const previous_old_rows = previous.new_length - previous.new_rows
    const previous_new_rows_removed = Math.max(0, delta.removed_rows - previous_old_rows)
    const previous_new_rows = Math.max(0, previous.new_rows - previous_new_rows_removed)
    const new_rows = Math.min(delta.new_length, previous_new_rows + delta.new_rows)
    const removed_rows = Math.min(
      previous.old_length,
      previous.removed_rows + Math.min(delta.removed_rows, previous_old_rows),
    )
    const affected_ranges = delta.new_length == 0
      ? []
      : removed_rows != 0
        ? [{start: 0, end: delta.new_length}]
        : new_rows != 0
          ? [{start: delta.new_length - new_rows, end: delta.new_length}]
          : []

    return {
      old_length: previous.old_length,
      new_length: delta.new_length,
      new_rows,
      removed_rows,
      affected_ranges,
    }
  }

  set_streaming(delta: StreamDelta): void {
    this._stream_geometry_delta = this._merge_streaming(this._stream_geometry_delta, delta)
    this._stream_visuals_delta = this._merge_streaming(this._stream_visuals_delta, delta)
  }

  protected consume_stream_geometry(): void {
    this._stream_geometry_delta = null
  }

  protected consume_stream_visuals(): void {
    this._stream_visuals_delta = null
  }

  clear_streaming(): void {
    this._stream_geometry_delta = null
    this._stream_visuals_delta = null
  }

  /** Re-upload all retained state after the browser restores the GL context. */
  context_restored(): void {
    this.revisions.bump("geometry")
    this.revisions.bump("mapping")
    this.revisions.bump("visuals")
    this.revisions.bump("selection")
  }

  render(_ctx: Context2d, indices: number[], mainglyph: GlyphView): void {
    const selection_changed = this.revisions.sync_selection(indices)
    if (indices.length == 0 && !selection_changed &&
        !this.data_changed && !this.data_mapped && !this.visuals_changed) {
      return
    }
    const canvas_view = this.glyph.renderer.plot_view.canvas_view
    const queued_indices = [...indices]
    canvas_view.enqueue_webgl({
      label: this.glyph.toString(),
      execute: () => {
        const {width, height} = canvas_view.webgl!.canvas
        const {pixel_ratio} = canvas_view
        const trans = {
          pixel_ratio,
          width:  width / pixel_ratio,
          height: height / pixel_ratio,
        }
        this.draw(queued_indices, mainglyph, trans)
        canvas_view.mark_webgl_dirty()
      },
    })
  }

  abstract draw(indices: number[], mainglyph: GlyphView, trans: Transform): void

  protected own<T extends GPUResource>(resource: T): T {
    return this._resources.own(resource)
  }

  protected release<T extends GPUResource>(resource: T | null | undefined): null {
    return this._resources.release(resource)
  }

  protected replace<T extends GPUResource>(previous: T | null | undefined, replacement: T): T {
    return this._resources.replace(previous, replacement)
  }

  protected revision_changed(domain: RevisionDomain, consumer: string): boolean {
    return this.revisions.changed(domain, consumer)
  }

  protected consume_revision(domain: RevisionDomain, consumer: string): number {
    return this.revisions.consume(domain, consumer)
  }

  destroy(): void {
    this.regl_wrapper.flush()
    this._resources.destroy()
  }
}

export type Transform = {
  pixel_ratio: number
  width: number
  height: number
}
