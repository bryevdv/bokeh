import {expect} from "#framework/assertions"
import {xy} from "#framework/interactive"
import {display, fig} from "#framework/layouts"
import {WebGLScenario, require_glglyph} from "#framework/webgl"
import {encode_rgba} from "@bokehjs/core/util/color"
import {ndarray} from "@bokehjs/core/util/ndarray"
import type {Float32Buffer} from "@bokehjs/models/glyphs/webgl/buffer"
import type {BaseGLGlyph} from "@bokehjs/models/glyphs/webgl/base"
import {ColumnDataSource} from "@bokehjs/models/sources/column_data_source"
import type {Texture2D} from "regl"

async function wait_until(predicate: () => boolean, frames: number = 30): Promise<void> {
  for (let i = 0; i < frames; i++) {
    if (predicate()) {
      return
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  throw new Error("condition did not settle")
}

function svg(color: string): string {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><rect width="32" height="24" fill="${color}"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
}

describe("WebGL retained textures", () => {
  it.no_image("should reuse ImageRGBA textures across bounds and image replacement", async () => {
    const image = (first: [number, number, number, number], second: [number, number, number, number]) => ndarray(new Uint32Array([
      encode_rgba(first), encode_rgba(second), encode_rgba(second), encode_rgba(first),
    ]), {dtype: "uint32", shape: [2, 2]})
    const source = new ColumnDataSource({data: {
      image: [image([255, 0, 0, 255], [0, 0, 255, 255])], x: [0], y: [0], dw: [2], dh: [2],
    }})
    const p = fig([420, 320], {output_backend: "webgl", x_range: [-3, 3], y_range: [-3, 3]})
    const renderer = p.image_rgba({
      image: {field: "image"}, x: {field: "x"}, y: {field: "y"},
      dw: {field: "dw"}, dh: {field: "dh"}, source,
    })
    const {view} = await display(p)
    const gl = require_glglyph(view.owner.get_one(renderer).glyph) as unknown as {
      _tex: (Texture2D | null)[]
      _bounds: (Float32Buffer | null)[]
      diagnostics: BaseGLGlyph["diagnostics"]
    }
    const texture = gl._tex[0]
    const resources = gl.diagnostics.resources
    const bounds_revision = gl._bounds[0]!.uploaded_revision
    const scenario = new WebGLScenario(view)

    await scenario.mutate(() => source.patch({x: [[0, 0.5]], y: [[0, -0.5]]}))
    expect(gl._tex[0]).to.be.identical(texture)
    expect(gl._bounds[0]!.uploaded_revision).to.be.above(bounds_revision)

    await scenario.mutate(() => source.patch({image: [[0, image([0, 255, 0, 255], [0, 0, 0, 255])]]}))
    expect(gl._tex[0]).to.be.identical(texture)
    expect(gl.diagnostics.resources).to.be.equal(resources)

    source.data = {image: [], x: [], y: [], dw: [], dh: []}
    await scenario.settle()
    expect(gl._tex.length).to.be.equal(0)
    expect(gl._bounds.length).to.be.equal(0)
    expect(gl.diagnostics.resources).to.be.below(resources)
  })

  it.no_image("should ignore stale ImageURL callbacks and release replaced textures", async () => {
    const source = new ColumnDataSource({data: {
      url: [svg("red")], x: [0], y: [0], w: [2], h: [1.5], alpha: [0.75],
    }})
    const p = fig([420, 320], {
      output_backend: "webgl", x_range: [-3, 3], y_range: [-3, 3],
      tools: "wheel_zoom,reset", active_scroll: "wheel_zoom",
    })
    const renderer = p.image_url({
      url: {field: "url"}, x: {field: "x"}, y: {field: "y"},
      w: {field: "w"}, h: {field: "h"}, global_alpha: {field: "alpha"}, source,
    })
    const {view} = await display(p)
    const glyph = view.owner.get_one(renderer).glyph
    const gl = require_glglyph(glyph) as unknown as {
      _textures: (Texture2D | null)[]
      _images: (HTMLImageElement | null)[]
      _bounds: (Float32Buffer | null)[]
      diagnostics: BaseGLGlyph["diagnostics"]
    }
    await wait_until(() => gl._textures[0] != null)
    const texture = gl._textures[0]
    const resources = gl.diagnostics.resources
    const scenario = new WebGLScenario(view)

    source.patch({url: [[0, svg("blue")]]})
    const final_url = svg("lime")
    source.patch({url: [[0, final_url]]})
    await wait_until(() => gl._images[0]?.src == final_url)
    await scenario.settle()
    expect(glyph.has_webgl()).to.be.true
    expect(gl._textures[0]).to.be.identical(texture)
    expect(gl._bounds[0]).to.not.be.null
    expect(gl.diagnostics.resources).to.be.equal(resources)

    await scenario.zoom(xy(0, 0), 2)
    source.patch({url: [[0, ""]]})
    await scenario.settle()
    expect(gl._textures[0]).to.be.null
    expect(gl.diagnostics.resources).to.be.below(resources)
  })

})
