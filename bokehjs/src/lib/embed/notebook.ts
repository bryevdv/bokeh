import type {Patch} from "document"
import {Document} from "document"
import type {ID} from "core/types"

export type NotebookPatch = {
  kind: "patch"
  revision: number
  content: Patch
  buffer_ids?: ID[]
}

export class NotebookPatchError extends Error {
  override readonly name = "BokehNotebookPatchError"

  constructor(readonly code: "invalid" | "gap" | "buffers", message: string) {
    super(message)
  }
}

function array_buffer(view: DataView): ArrayBuffer {
  const {buffer, byteOffset, byteLength} = view
  if (buffer instanceof ArrayBuffer && byteOffset == 0 && byteLength == buffer.byteLength) {
    return buffer
  }
  return buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer
}

/** Apply revisioned notebook patches directly to a mounted artifact document. */
export function create_notebook_patch_receiver(document: Document, initial_revision = 0):
    (message: NotebookPatch, buffers?: DataView[]) => void {
  let revision = initial_revision
  return (message, buffers = []) => {
    if (message?.kind != "patch" || !Number.isSafeInteger(message.revision) || message.revision < 1 || message.content == null) {
      throw new NotebookPatchError("invalid", "the notebook transport received an invalid patch envelope")
    }
    if (message.revision <= revision) {
      return // A reconnected transport may replay an already applied patch.
    }
    if (message.revision != revision + 1) {
      throw new NotebookPatchError(
        "gap", `notebook patch revision ${message.revision} does not follow ${revision}`,
      )
    }
    const ids = message.buffer_ids ?? []
    if (ids.length != buffers.length || new Set(ids).size != ids.length) {
      throw new NotebookPatchError("buffers", "notebook patch buffer metadata does not match its binary payload")
    }
    const mapped = new Map<ID, ArrayBuffer>()
    for (let index = 0; index < ids.length; index++) {
      mapped.set(ids[index], array_buffer(buffers[index]))
    }
    document.apply_json_patch(message.content, mapped)
    revision = message.revision
  }
}
