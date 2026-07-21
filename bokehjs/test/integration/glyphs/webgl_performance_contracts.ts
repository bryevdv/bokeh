import {expect} from "#framework/assertions"
import {xy} from "#framework/interactive"
import {display, fig} from "#framework/layouts"
import {
  WebGLScenario, buffer_upload_totals, require_glglyph,
  reset_buffer_upload_stats, wrapped_buffers,
} from "#framework/webgl"
import {range} from "@bokehjs/core/util/array"
import {LCGRandom} from "@bokehjs/core/util/random"
import type {BaseGLGlyph} from "@bokehjs/models/glyphs/webgl/base"
import type {Float32Buffer} from "@bokehjs/models/glyphs/webgl/buffer"
import {ColumnDataSource} from "@bokehjs/models/sources/column_data_source"

describe("WebGL deterministic performance contracts", () => {
  it.no_image("should interact with 100k mapped markers without coordinate uploads", async () => {
    const n = 100_000
    const values = new LCGRandom(2026).floats(2*n)
    const p = fig([720, 440], {
      output_backend: "webgl", x_range: [-10, 10], y_range: [-10, 10],
      tools: "pan,wheel_zoom,reset", active_drag: "pan", active_scroll: "wheel_zoom",
      x_axis_type: null, y_axis_type: null,
    })
    const renderer = p.scatter(
      values.slice(0, n).map((value) => 20*value - 10),
      values.slice(n).map((value) => 20*value - 10),
      {size: 3, fill_alpha: 0.35, line_color: null},
    )
    const {view} = await display(p)
    const gl = require_glglyph(view.owner.get_one(renderer).glyph) as unknown as {
      _centers: Float32Buffer
      diagnostics: BaseGLGlyph["diagnostics"]
    }
    expect(gl._centers.length).to.be.equal(2*n)
    reset_buffer_upload_stats(gl)
    const buffers = wrapped_buffers(gl).filter((buffer) => buffer.length > 0)
    const arrays = buffers.map((buffer) => buffer.get_array())
    const resources = gl.diagnostics.resources
    const scenario = new WebGLScenario(view)

    for (let i = 0; i < 5; i++) {
      await scenario.pan(xy(0, 0), xy(0.25*(i + 1), -0.1*i))
      await scenario.zoom(xy(0, 0), i % 2 == 0 ? 1 : -1)
    }
    await scenario.reset()

    expect(gl._centers.upload_stats).to.be.equal({full_uploads: 0, partial_uploads: 0, bytes: 0})
    // Viewport masking may patch one-byte visibility buffers, but must remain
    // smaller than a single four-byte value per point across the whole trace.
    expect(buffer_upload_totals(gl).bytes).to.be.below(4*n)
    expect(buffers.map((buffer) => buffer.get_array()).every((array, i) => array === arrays[i])).to.be.true
    expect(gl.diagnostics.resources).to.be.equal(resources)
    expect(view.canvas_view.webgl_diagnostics.compositor_pending).to.be.equal(0)
  })

  it.no_image("should collapse a large compatible renderer batch into few draw calls", async () => {
    const p = fig([620, 400], {
      output_backend: "webgl", x_range: [-1, 1], y_range: [-1, 1],
      x_axis_type: null, y_axis_type: null, background_fill_color: "white",
    })
    const nrenderers = 96
    for (let i = 0; i < nrenderers; i++) {
      const angle = 2*Math.PI*i/nrenderers
      p.scatter([0.8*Math.cos(angle)], [0.8*Math.sin(angle)], {
        marker: "circle", size: 8, fill_color: "navy", line_color: null,
      })
    }
    const {view} = await display(p)
    const {batch, pending} = view.canvas_view.webgl!.regl_wrapper.diagnostics
    expect(batch.submitted).to.be.equal(nrenderers)
    expect(batch.draw_calls).to.be.below(nrenderers/8)
    expect(pending.commands).to.be.equal(0)
    expect(view.canvas_view.webgl_diagnostics.compositor_pending).to.be.equal(0)
  })

  it.no_image("should keep resource and CPU-array cardinality stable during mutation stress", async () => {
    const n = 1_000
    const values = new LCGRandom(77).floats(2*n)
    const source = new ColumnDataSource({data: {
      x: values.slice(0, n).map((value) => 4*value - 2),
      y: values.slice(n).map((value) => 4*value - 2),
      size: range(n).map(() => 5),
    }})
    const p = fig([620, 400], {
      output_backend: "webgl", x_range: [-3, 3], y_range: [-3, 3],
      tools: "pan,wheel_zoom,reset", active_drag: "pan", active_scroll: "wheel_zoom",
      x_axis_type: null, y_axis_type: null,
    })
    const renderer = p.scatter({
      x: {field: "x"}, y: {field: "y"}, size: {field: "size"}, source,
      marker: "circle", fill_color: "#2563eb", line_color: null,
    })
    const {view} = await display(p)
    const gl = require_glglyph(view.owner.get_one(renderer).glyph)
    const resources = gl.diagnostics.resources
    const buffers = wrapped_buffers(gl).filter((buffer) => buffer.length > 0)
    const arrays = buffers.map((buffer) => buffer.get_array())
    const scenario = new WebGLScenario(view)

    for (let i = 0; i < 4; i++) {
      const index = (i*379) % n
      await scenario.mutate(() => {
        source.patch({
          x: [[index, -1.5 + (i % 20)*0.15]],
          y: [[index, 1.5 - (i % 15)*0.2]],
          size: [[index, 4 + (i % 5)]],
        })
        source.selected.indices = i % 3 == 0 ? [index, (index + 1) % n] : []
      })
      if (i % 5 == 0) {
        await scenario.zoom(xy(0, 0), i % 10 == 0 ? 1 : -1)
      }
    }

    expect(gl.diagnostics.resources).to.be.equal(resources)
    expect(buffers.map((buffer) => buffer.get_array()).every((array, i) => array === arrays[i])).to.be.true
    expect(view.canvas_view.webgl_diagnostics.compositor_pending).to.be.equal(0)
    expect(view.canvas_view.webgl!.regl_wrapper.diagnostics.pending.commands).to.be.equal(0)
  })
})
