import {describe, expect, it, vi} from "vitest"

import {kernelProxy} from "../src/kernel"
import {MAX_PENDING_PATCHES} from "../src/revision_queue"

describe("JupyterLab kernel transport", () => {
  it("bounds pre-render patch history and requests one replacement snapshot", async () => {
    const comm: any = {
      open: vi.fn(),
      send: vi.fn(),
      close: vi.fn(() => ({done: Promise.resolve()})),
    }
    const kernel = {createComm: vi.fn(() => comm)}
    const manager = {
      context: {sessionContext: {ready: Promise.resolve(), session: {kernel}}},
    }
    const opening = kernelProxy(manager as any).openLive!("live")
    await Promise.resolve()
    comm.onMsg({content: {data: {kind: "snapshot", artifact: "{}", revision: 0}}})
    const connection = await opening

    for (let revision = 1; revision <= MAX_PENDING_PATCHES + 20; revision++) {
      comm.onMsg({content: {data: {kind: "patch", revision, content: {events: []}}}})
    }
    expect(comm.send).toHaveBeenCalledTimes(1)
    expect(comm.send).toHaveBeenCalledWith({kind: "resync"})

    const received: any[] = []
    connection.onMessage((message) => received.push(message))
    comm.onMsg({content: {data: {kind: "patch", revision: 90, content: {events: []}}}})
    expect(received).toEqual([])

    comm.onMsg({content: {data: {kind: "snapshot", artifact: "{\"fresh\":true}", revision: 100}}})
    expect(received).toEqual([{kind: "snapshot", artifact: "{\"fresh\":true}", revision: 100}])
    connection.close()
  })
})
