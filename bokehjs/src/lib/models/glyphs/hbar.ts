import {LRTB, LRTBView} from "./lrtb"
import type {LRTBRect} from "./lrtb"
import {ScreenArray} from "core/types"
import * as p from "core/properties"
import type {HBarGL} from "./webgl/hbar"
import {HBarStreamIndex} from "./hbar_index"

export interface HBarView extends HBar.Data {}

export class HBarView extends LRTBView {
  declare model: HBar
  declare visuals: HBar.Visuals
  private _stream_index: HBarStreamIndex | null = null

  /** @internal */
  declare glglyph?: HBarGL

  override async load_glglyph() {
    const {HBarGL} = await import("./webgl/hbar")
    return HBarGL
  }

  scenterxy(i: number): [number, number] {
    const scx = (this.sleft[i] + this.sright[i])/2
    const scy = this.sy[i]
    return [scx, scy]
  }

  protected _lrtb(i: number): LRTBRect {
    const left_i = this.left[i]
    const right_i = this.right[i]
    const y_i = this.y[i]
    const half_height_i = this.height.get(i)/2

    const l = Math.min(left_i, right_i)
    const r = Math.max(left_i, right_i)
    const t = y_i + half_height_i
    const b = y_i - half_height_i

    return {l, r, t, b}
  }

  override index_data(): void {
    if (!this.has_webgl()) {
      this._stream_index = null
      super.index_data()
      return
    }

    const delta = this.stream_delta
    if (delta != null && this._stream_index != null && this._stream_index.stream(delta)) {
      this._set_index(this._stream_index)
      return
    }

    this._stream_index = new HBarStreamIndex(
      this.data_size,
      (i) => {
        const {l: x0, b: y0, r: x1, t: y1} = this._lrtb(i)
        return {x0, y0, x1, y1}
      },
      (i) => this.y[i],
    )
    this._set_index(this._stream_index)
  }

  protected override _map_data(force_cpu: boolean = false): void {
    if (!force_cpu && this.has_webgl() && this.glglyph.data_mapping != null) {
      return
    }

    if (this.inherited_y && this.inherited_height) {
      this._inherit_attr<HBar.Data>("sheight")
      this._inherit_attr<HBar.Data>("stop")
      this._inherit_attr<HBar.Data>("sbottom")
    } else {
      const sheight = this.sdist(this.renderer.yscale, this.y, this.height, "center")

      const {sy} = this
      const n = this.sy.length
      const stop = new ScreenArray(n)
      const sbottom = new ScreenArray(n)

      for (let i = 0; i < n; i++) {
        const sy_i = sy[i]
        const sheight_i = sheight[i]
        stop[i] = sy_i - sheight_i/2
        sbottom[i] = sy_i + sheight_i/2
      }

      this._define_attr<HBar.Data>("sheight", sheight)
      this._define_attr<HBar.Data>("stop", stop)
      this._define_attr<HBar.Data>("sbottom", sbottom)
    }

    this._clamp_to_viewport()
  }
}

export namespace HBar {
  export type Attrs = p.AttrsOf<Props>

  export type Props = LRTB.Props & {
    left: p.XCoordinateSpec
    y: p.YCoordinateSpec
    height: p.DistanceSpec
    right: p.XCoordinateSpec
  }

  export type Visuals = LRTB.Visuals

  export type Data = LRTB.Data & p.GlyphDataOf<Props>
}

export interface HBar extends HBar.Attrs {}

export class HBar extends LRTB {
  declare properties: HBar.Props
  declare __view_type__: HBarView

  constructor(attrs?: Partial<HBar.Attrs>) {
    super(attrs)
  }

  static {
    this.prototype.default_view = HBarView

    this.define<HBar.Props>(({}) => ({
      left:   [ p.XCoordinateSpec, {value: 0} ],
      y:      [ p.YCoordinateSpec, {field: "y"} ],
      height: [ p.DistanceSpec,    {value: 1} ],
      right:  [ p.XCoordinateSpec, {field: "right"} ],
    }))
  }
}
