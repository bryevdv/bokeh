export const MAX_PENDING_PATCHES = 64
export const MAX_PENDING_BYTES = 8 * 1024 * 1024

export type RevisionItem = {message: any, buffers: DataView[]}
export type QueueResult = "queued" | "ignored" | "overflow"

type PendingPatch = RevisionItem & {bytes: number}

/** A bounded pre-subscriber queue for revisioned notebook transports. */
export class RevisionQueue {
  private snapshot?: RevisionItem
  private patches: PendingPatch[] = []
  private bytes = 0
  private awaitingSnapshot = false

  get awaitingResync(): boolean {
    return this.awaitingSnapshot
  }

  pushPatch(message: any, buffers: DataView[]): QueueResult {
    if (this.awaitingSnapshot) return "ignored"
    const bytes = buffers.reduce((total, view) => total + view.byteLength, new TextEncoder().encode(JSON.stringify(message)).byteLength)
    this.patches.push({message, buffers, bytes})
    this.bytes += bytes
    if (this.patches.length <= MAX_PENDING_PATCHES && this.bytes <= MAX_PENDING_BYTES) return "queued"
    this.patches = []
    this.bytes = 0
    this.awaitingSnapshot = true
    return "overflow"
  }

  reset(revision: number): void {
    this.awaitingSnapshot = false
    this.patches = this.patches.filter((patch) => patch.message.revision > revision)
    this.bytes = this.patches.reduce((total, patch) => total + patch.bytes, 0)
  }

  replaceWithSnapshot(message: any, buffers: DataView[] = []): void {
    this.reset(message.revision)
    this.snapshot = {message, buffers}
  }

  drain(callback: (message: any, buffers: DataView[]) => void): void {
    if (this.snapshot != null) callback(this.snapshot.message, this.snapshot.buffers)
    this.snapshot = undefined
    for (const patch of this.patches) callback(patch.message, patch.buffers)
    this.patches = []
    this.bytes = 0
  }

  clear(): void {
    this.snapshot = undefined
    this.patches = []
    this.bytes = 0
    this.awaitingSnapshot = false
  }
}
