import {expect} from "#framework/assertions"
import {display, fig, row} from "#framework/layouts"

import type {PlotView} from "@bokehjs/models/plots/plot_canvas"

function count_blue_pixels(view: PlotView): number {
  const {canvas, ctx} = view.canvas_view.primary
  const {data} = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let blue = 0
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = data.subarray(i, i + 4)
    blue += a > 32 && b > r + 50 && b > g + 50 ? 1 : 0
  }
  return blue
}

describe("WebGL shared canvas sizing", () => {
  it.no_image("should retain its largest size while rendering smaller adjacent plots", async () => {
    const attrs = {
      output_backend: "webgl" as const,
      x_range: [-1, 1] as [number, number],
      y_range: [-1, 1] as [number, number],
      x_axis_type: null,
      y_axis_type: null,
      toolbar_location: null,
      background_fill_color: "white",
      outline_line_color: null,
    }
    const large = fig([520, 380], attrs)
    large.scatter([0], [0], {size: 80, fill_color: "red", line_color: null})
    const small = fig([320, 240], attrs)
    small.scatter([0], [0], {size: 60, fill_color: "blue", line_color: null})

    const {view} = await display(row([large, small]))
    const large_view = view.owner.get_one(large)
    const small_view = view.owner.get_one(small)
    const large_canvas_view = large_view.canvas_view
    const small_canvas_view = small_view.canvas_view
    expect(large_canvas_view.webgl === small_canvas_view.webgl).to.be.true

    const webgl = large_canvas_view.webgl!
    large_canvas_view.prepare_webgl(large_view.frame.bbox)
    const retained = {width: webgl.canvas.width, height: webgl.canvas.height}
    small_canvas_view.prepare_webgl(small_view.frame.bbox)

    expect({width: webgl.canvas.width, height: webgl.canvas.height}).to.be.equal(retained)
    expect(retained.width).to.not.be.below(Math.floor(large_canvas_view.pixel_ratio*large_canvas_view.bbox.width))
    expect(retained.height).to.not.be.below(Math.floor(large_canvas_view.pixel_ratio*large_canvas_view.bbox.height))

    const ratio = small_canvas_view.pixel_ratio
    const canvas_height = Math.floor(ratio*small_canvas_view.bbox.height)
    const {y: sy, height} = small_view.frame.bbox
    const vy = small_canvas_view.bbox.yview.compute(sy + height)
    expect(webgl.regl_wrapper.scissor.y).to.be.similar(webgl.canvas.height - canvas_height + ratio*vy)

    small.x_range.setv({start: -2, end: 2})
    await small_view.ready
    await small_view.ready
    expect({width: webgl.canvas.width, height: webgl.canvas.height}).to.be.equal(retained)
    expect(count_blue_pixels(small_view)).to.be.above(100)
  })
})
