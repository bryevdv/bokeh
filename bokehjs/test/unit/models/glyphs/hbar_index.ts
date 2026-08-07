import {expect} from "#framework/assertions"

import type {StreamDelta} from "@bokehjs/core/patching"
import {HBarStreamIndex} from "@bokehjs/models/glyphs/hbar_index"

describe("HBarStreamIndex", () => {
  it("should incrementally evict and append fixed-rollover lane entries", () => {
    let left = [0, 1, 2, 3, 4, 5]
    let lane = [0, 1, 0, 1, 0, 1]
    const index = new HBarStreamIndex(
      left.length,
      (i) => ({x0: left[i], y0: lane[i] - 0.4, x1: left[i] + 0.75, y1: lane[i] + 0.4}),
      (i) => lane[i],
    )
    const original = index

    expect([...index.indices({x0: 2.1, y0: 0, x1: 2.1, y1: 0})]).to.be.equal([2])
    expect(index.bbox).to.be.equal({x0: 0, y0: -0.4, x1: 5.75, y1: 1.4})

    const delta: StreamDelta = {
      old_length: 6,
      new_length: 6,
      new_rows: 2,
      removed_rows: 2,
      affected_ranges: [{start: 0, end: 6}],
    }
    left = [2, 3, 4, 5, 6, 7]
    lane = [0, 1, 0, 1, 1, 0]
    expect(index.stream(delta)).to.be.true
    expect(index).to.be.equal(original)
    expect([...index.indices({x0: 2.1, y0: 0, x1: 2.1, y1: 0})]).to.be.equal([0])
    expect([...index.indices({x0: 6.1, y0: 1, x1: 6.1, y1: 1})]).to.be.equal([4])
    expect([...index.indices({x0: 7.1, y0: 0, x1: 7.1, y1: 0})]).to.be.equal([5])
    expect(index.bbox).to.be.equal({x0: 2, y0: -0.4, x1: 7.75, y1: 1.4})
    expect(index.diagnostics).to.be.equal({lanes: 2, chunks: 2, stream_updates: 1})

    left = [4, 5, 6, 7, 8, 9]
    lane = [0, 1, 1, 0, 0, 1]
    expect(index.stream(delta)).to.be.true
    expect([...index.indices({x0: 8.1, y0: 0, x1: 8.1, y1: 0})]).to.be.equal([4])
    expect(index.bounds({x0: 5, y0: 0.5, x1: 10, y1: 2})).to.be.equal({
      x0: 5,
      y0: 0.6,
      x1: 9.75,
      y1: 1.4,
    })
    expect(index.diagnostics.stream_updates).to.be.equal(2)
  })

  it("should reject a non-fixed stream delta", () => {
    const left = [0, 1, 2]
    const index = new HBarStreamIndex(
      left.length,
      (i) => ({x0: left[i], y0: -0.5, x1: left[i] + 0.5, y1: 0.5}),
      () => 0,
    )
    expect(index.stream({
      old_length: 3,
      new_length: 4,
      new_rows: 1,
      removed_rows: 0,
      affected_ranges: [{start: 3, end: 4}],
    })).to.be.false
    expect(index.diagnostics.stream_updates).to.be.equal(0)
  })
})
