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
import type {Float32Buffer, NormalizedUint8Buffer} from "@bokehjs/models/glyphs/webgl/buffer"
import type {HBarStreamIndex} from "@bokehjs/models/glyphs/hbar_index"
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

  it.no_image("should retain mapped coordinates across quad, line, segment, span, and strip families", async () => {
    const n = 2_000
    const x = range(n).map((i) => -9 + 18*i/(n - 1))
    const y = x.map((value) => 3*Math.sin(value))
    const p = fig([720, 440], {
      output_backend: "webgl", x_range: [-10, 10], y_range: [-10, 10],
      tools: "pan,wheel_zoom,reset", active_drag: "pan", active_scroll: "wheel_zoom",
      x_axis_type: null, y_axis_type: null,
    })
    const circle = p.circle({x, y, radius: 0.03, line_color: null})
    const quad = p.quad({
      left: x, right: x.map((value) => value + 0.02),
      bottom: y, top: y.map((value) => value + 0.04),
      line_color: null, fill_alpha: 0.2,
    })
    const multi_line = p.multi_line({
      xs: range(40).map((i) => x.slice(50*i, 50*(i + 1))),
      ys: range(40).map((i) => y.slice(50*i, 50*(i + 1))),
      line_alpha: 0.3,
    })
    const segment = p.segment({
      x0: x, y0: y, x1: x.map((value) => value + 0.05), y1: y.map((value) => value + 0.08),
      line_alpha: 0.3,
    })
    const hspan = p.hspan(range(40).map((i) => -8 + 0.4*i), {line_alpha: 0.15})
    const hstrip = p.hstrip({
      y0: range(30).map((i) => -9 + 0.5*i),
      y1: range(30).map((i) => -8.8 + 0.5*i),
      fill_alpha: 0.08, line_color: null,
    })
    const {view} = await display(p)
    const buffers = [
      (require_glglyph(view.owner.get_one(circle).glyph) as unknown as {_centers: Float32Buffer})._centers,
      ...(() => {
        const gl = require_glglyph(view.owner.get_one(quad).glyph) as unknown as {
          _centers: Float32Buffer
          _widths: Float32Buffer
          _heights: Float32Buffer
        }
        return [gl._centers, gl._widths, gl._heights]
      })(),
      (require_glglyph(view.owner.get_one(multi_line).glyph) as unknown as {_points: Float32Buffer})._points,
      ...(() => {
        const gl = require_glglyph(view.owner.get_one(segment).glyph) as unknown as {
          _start: Float32Buffer
          _end: Float32Buffer
        }
        return [gl._start, gl._end]
      })(),
      ...(() => {
        const gl = require_glglyph(view.owner.get_one(hspan).glyph) as unknown as {
          _start: Float32Buffer
          _end: Float32Buffer
        }
        return [gl._start, gl._end]
      })(),
      ...(() => {
        const gl = require_glglyph(view.owner.get_one(hstrip).glyph) as unknown as {
          _centers: Float32Buffer
          _widths: Float32Buffer
          _heights: Float32Buffer
        }
        return [gl._centers, gl._widths, gl._heights]
      })(),
    ]
    for (const buffer of buffers) {
      buffer.reset_upload_stats()
    }

    const scenario = new WebGLScenario(view)
    await scenario.pan(xy(0, 0), xy(1, -0.5))
    await scenario.zoom(xy(0, 0), 2)
    await scenario.reset()

    for (const buffer of buffers) {
      expect(buffer.upload_stats).to.be.equal({full_uploads: 0, partial_uploads: 0, bytes: 0})
    }
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

  it.no_image("should draw 50k independent solid segments with one instanced submission", async () => {
    const n = 50_000
    const x = range(n).map((i) => i % 500)
    const y = range(n).map((i) => Math.floor(i/500))
    const p = fig([620, 400], {
      output_backend: "webgl", x_range: [-1, 501], y_range: [-1, 101],
      x_axis_type: null, y_axis_type: null,
    })
    const renderer = p.segment({
      x0: x, y0: y, x1: x.map((value) => value + 0.8), y1: y.map((value) => value + 0.3),
      line_color: "#2563eb", line_alpha: 0.25,
    })
    const {view} = await display(p)
    const gl = require_glglyph(view.owner.get_one(renderer).glyph) as unknown as {
      _start: Float32Buffer
      _end: Float32Buffer
    }
    const {batch, pending} = view.canvas_view.webgl!.regl_wrapper.diagnostics

    expect(gl._start.length).to.be.equal(2*n)
    expect(gl._end.length).to.be.equal(2*n)
    expect(batch.submitted).to.be.equal(1)
    expect(batch.draw_calls).to.be.equal(1)
    expect(pending.commands).to.be.equal(0)
  })

  it.no_image("should retain HBar and Quad buffers during fixed-rollover streaming", async () => {
    const n = 1_000
    const batch = 100
    const source = new ColumnDataSource({data: {
      left: range(n),
      right: range(n).map((i) => i + 0.75),
      y: range(n).map((i) => i % 20),
      top: range(n).map((i) => i % 20 + 0.4),
      bottom: range(n).map((i) => i % 20 - 0.4),
      color: range(n).map((i) => i % 3 == 0 ? "#2563eb" : "#f97316"),
    }})
    const p = fig([720, 440], {
      output_backend: "webgl", x_range: [0, 2*n], y_range: [-1, 21],
      x_axis_type: null, y_axis_type: null,
    })
    const hbar = p.hbar({
      left: {field: "left"}, right: {field: "right"}, y: {field: "y"},
      height: 0.8, fill_color: {field: "color"}, line_color: null, source,
    })
    const quad = p.quad({
      left: {field: "left"}, right: {field: "right"},
      top: {field: "top"}, bottom: {field: "bottom"},
      fill_color: {field: "color"}, line_color: null, source,
    })
    const {view} = await display(p)
    const hbar_view = view.owner.get_one(hbar).glyph
    const hbar_gl = require_glglyph(hbar_view) as unknown as {
      data_mapping: unknown
      _centers: Float32Buffer
      _widths: Float32Buffer
      _heights: Float32Buffer
      _fill_rgba: NormalizedUint8Buffer
    }
    const quad_gl = require_glglyph(view.owner.get_one(quad).glyph) as unknown as {
      data_mapping: unknown
      _centers: Float32Buffer
      _widths: Float32Buffer
      _heights: Float32Buffer
      _fill_rgba: NormalizedUint8Buffer
    }
    expect(hbar_gl.data_mapping).to.not.be.null
    expect(quad_gl.data_mapping).to.not.be.null

    const hbar_arrays = [hbar_gl._centers, hbar_gl._widths, hbar_gl._heights].map((buffer) => buffer.get_array())
    const quad_arrays = [quad_gl._centers, quad_gl._widths, quad_gl._heights].map((buffer) => buffer.get_array())
    const old_hbar_centers = hbar_gl._centers.get_array().slice()
    const old_quad_centers = quad_gl._centers.get_array().slice()
    const old_hbar_colors = hbar_gl._fill_rgba.get_array().slice()
    const old_quad_colors = quad_gl._fill_rgba.get_array().slice()
    const hbar_index = hbar_view.index as HBarStreamIndex
    for (const buffer of [
      hbar_gl._centers, hbar_gl._widths, hbar_gl._heights, hbar_gl._fill_rgba,
      quad_gl._centers, quad_gl._widths, quad_gl._heights, quad_gl._fill_rgba,
    ]) {
      buffer.reset_upload_stats()
    }
    const scenario = new WebGLScenario(view)

    for (let step = 0; step < 3; step++) {
      const offset = n + step*batch
      await scenario.mutate(() => source.stream({
        left: range(batch).map((i) => offset + i),
        right: range(batch).map((i) => offset + i + 0.75),
        y: range(batch).map((i) => i % 20),
        top: range(batch).map((i) => i % 20 + 0.4),
        bottom: range(batch).map((i) => i % 20 - 0.4),
        color: range(batch).map((i) => (offset + i) % 3 == 0 ? "#2563eb" : "#f97316"),
      }, n))
    }

    expect(source.length).to.be.equal(n)
    expect([hbar_gl._centers, hbar_gl._widths, hbar_gl._heights].map((buffer) => buffer.get_array()))
      .to.be.equal(hbar_arrays)
    expect([quad_gl._centers, quad_gl._widths, quad_gl._heights].map((buffer) => buffer.get_array()))
      .to.be.equal(quad_arrays)
    expect(hbar_gl._centers.get_logical_array().slice(0, 20))
      .to.be.equal(old_hbar_centers.slice(6*batch, 6*batch + 20))
    expect(quad_gl._centers.get_logical_array().slice(0, 20))
      .to.be.equal(old_quad_centers.slice(6*batch, 6*batch + 20))
    expect(hbar_gl._fill_rgba.get_logical_array().slice(0, 20))
      .to.be.equal(old_hbar_colors.slice(12*batch, 12*batch + 20))
    expect(quad_gl._fill_rgba.get_logical_array().slice(0, 20))
      .to.be.equal(old_quad_colors.slice(12*batch, 12*batch + 20))
    expect(hbar_gl._centers.circular_offset).to.be.equal(3*batch)
    expect(quad_gl._centers.circular_offset).to.be.equal(3*batch)
    for (const [buffer, bytes_per_item] of [
      [hbar_gl._centers, 2*Float32Array.BYTES_PER_ELEMENT],
      [hbar_gl._widths, Float32Array.BYTES_PER_ELEMENT],
      [hbar_gl._heights, Float32Array.BYTES_PER_ELEMENT],
      [hbar_gl._fill_rgba, 4],
      [quad_gl._centers, 2*Float32Array.BYTES_PER_ELEMENT],
      [quad_gl._widths, Float32Array.BYTES_PER_ELEMENT],
      [quad_gl._heights, Float32Array.BYTES_PER_ELEMENT],
      [quad_gl._fill_rgba, 4],
    ] as const) {
      expect(buffer.upload_stats.full_uploads).to.be.equal(0)
      expect(buffer.upload_stats.partial_uploads).to.be.above(0)
      expect(buffer.upload_stats.partial_uploads).to.be.below(4)
      expect(buffer.upload_stats.bytes).to.be.equal(3*batch*bytes_per_item)
    }
    expect(hbar_view.index).to.be.equal(hbar_index)
    expect(hbar_index.diagnostics.stream_updates).to.be.equal(3)
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
