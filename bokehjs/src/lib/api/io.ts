import {Document} from "../document"
import {StandaloneMount, StandaloneRootError} from "../embed/standalone"
import type {EmbedTarget} from "../embed/dom"

import type {ViewOf} from "core/view"
import type {ViewManager} from "core/view_manager"
import {HasProps} from "core/has_props"
import type {ModelResolver} from "core/resolvers"
import {dom_ready, contains} from "core/dom"
import {logger} from "core/logging"
import {isArray, isPlainObject, isString} from "core/util/types"

import type {UIElement} from "models/ui/ui_element"
import type {DOMNode} from "models/dom/dom_node"
import type {ClientSession} from "../client/session"
import type {EmbedArtifact, PreparedArtifact} from "../embed/artifact"
import {ArtifactError, prepare_embed_artifact, validate_embed_artifact} from "../embed/artifact"
import type {ResourcePolicy} from "../embed/resources"

declare type Jq = any
declare const $: Jq

export type ShowableRoot = UIElement | DOMNode
export type Showable = ShowableRoot | readonly ShowableRoot[]

export type RootKey = string
export type MountTarget = EmbedTarget | string
export type KeyedRoots<T extends HasProps = HasProps> = ReadonlyMap<RootKey, T> | Readonly<Record<RootKey, T>>
export type MountTargets = ReadonlyMap<RootKey, MountTarget | null> | Readonly<Record<RootKey, MountTarget | null>>
export type DocumentOwnership = "caller" | "mount"

export type MountOwnership = {
  readonly document: DocumentOwnership
  readonly views: "mount"
  readonly targets: "caller"
  readonly session: "mount" | "none"
  readonly resources: "shared" | "none"
}

/** A normalized runtime source for one document and its addressable logical roots. */
export class MountSource<T extends HasProps = HasProps> {
  readonly roots: ReadonlyMap<RootKey, T>

  constructor(
    readonly document: Document,
    roots: KeyedRoots<T>,
    readonly document_ownership: DocumentOwnership = "caller",
    readonly track_document_roots: boolean = false,
  ) {
    const entries = keyed_entries(roots)
    const models = new Set<T>()
    const normalized = new Map<RootKey, T>()
    for (const [key, model] of entries) {
      if (key.length == 0) {
        throw new MountError("source", "Bokeh mount root keys must not be empty")
      }
      if (!(model instanceof HasProps)) {
        throw new MountError("source", `Bokeh mount root '${key}' is not a model`)
      }
      if (models.has(model)) {
        throw new MountError("source", `Bokeh model ${model} is assigned to more than one mount root`)
      }
      if (model.document != document || !document.roots().includes(model)) {
        throw new MountError("source", `Bokeh mount root '${key}' is not a root of its source document`)
      }
      models.add(model)
      normalized.set(key, model)
    }
    this.roots = normalized
  }

  static from_document(document: Document): MountSource<HasProps> {
    return new MountSource(document, keyed_by_id(document.roots()), "caller", true)
  }

  static from_roots<T extends HasProps>(roots: T | readonly T[] | KeyedRoots<T>): MountSource<T> {
    let keyed: KeyedRoots<T>
    if (roots instanceof HasProps) {
      keyed = keyed_by_id<T>([roots])
    } else if (isArray(roots)) {
      keyed = keyed_by_id<T>(roots as T[])
    } else {
      keyed = roots as KeyedRoots<T>
    }
    const entries = keyed_entries(keyed)
    const models = entries.map(([, model]) => model)
    const source_documents = new Set(models.map((model) => model.document).filter((doc): doc is Document => doc != null))
    const has_unowned_models = models.some((model) => model.document == null)

    if (source_documents.size > 1 || (source_documents.size == 1 && has_unowned_models)) {
      throw new MountError("source", "all Bokeh mount roots must belong to the same document or to no document")
    }

    const source_document = models.find((model) => model.document != null)?.document
    if (source_document != null) {
      return new MountSource<T>(source_document, keyed, "caller")
    }

    const document = new Document({roots: models})
    try {
      return new MountSource<T>(document, keyed, "mount")
    } catch (error) {
      document.destroy()
      throw error
    }
  }
}

export type Mountable = MountSource | Document | EmbedArtifact | ShowableRoot | readonly ShowableRoot[] | KeyedRoots<HasProps>

export type MountErrorKind =
  | "source"
  | "target"
  | "render"
  | "abort"
  | "disposed"
  | "schema"
  | "decode"
  | "resource"
  | "http"
  | "websocket"
  | "session"

export class MountError extends Error {
  override readonly name = "BokehMountError"

  constructor(
    readonly kind: MountErrorKind,
    message: string,
    override readonly cause?: unknown,
    readonly root_key?: RootKey,
  ) {
    super(message)
  }
}

export type MountState = "pending" | "ready" | "failed" | "disposed"

export type MountOptions = {
  signal?: AbortSignal
  /** Caller-owned DOM targets addressed by logical root key. Missing or null entries remain detached. */
  targets?: MountTargets
  use_for_title?: boolean
  /** Artifact resource policy. Direct model/document mounts ignore this option. */
  resources?: ResourcePolicy
  resolver?: ModelResolver
  on_error?(error: MountError): void
}

function keyed_entries<T>(values: ReadonlyMap<string, T> | Readonly<Record<string, T>>): [string, T][] {
  return values instanceof Map ? [...values] : Object.entries(values)
}

function keyed_by_id<T extends HasProps>(models: readonly T[]): Map<string, T> {
  const result = new Map<string, T>()
  for (const model of models) {
    if (result.has(model.id)) {
      throw new MountError("source", `duplicate Bokeh mount root key '${model.id}'`)
    }
    result.set(model.id, model)
  }
  return result
}

function as_mount_source(source: Mountable): MountSource {
  if (source instanceof MountSource) {
    return source
  } else if (source instanceof Document) {
    return MountSource.from_document(source)
  } else if (source instanceof HasProps || isArray(source) || source instanceof Map || isPlainObject(source)) {
    return MountSource.from_roots<HasProps>(source as HasProps | readonly HasProps[] | KeyedRoots<HasProps>)
  } else {
    throw new MountError("source", "mount source must be a Bokeh model, root collection, Document, or MountSource")
  }
}

function mount_error(kind: MountErrorKind, error: unknown, root_key?: RootKey): MountError {
  if (error instanceof MountError) {
    return error
  } else if (error instanceof StandaloneRootError) {
    return mount_error(kind, error.cause, error.root_key)
  } else if (error instanceof ArtifactError) {
    return new MountError(error.kind, error.message, error, root_key)
  }
  const message = error instanceof Error ? error.message : `${error}`
  return new MountError(kind, message, error, root_key)
}

function is_mount_options(value: unknown): value is MountOptions {
  return isPlainObject(value) && !(value instanceof HasProps)
}

async function resolve_target(target: MountTarget | undefined, script: HTMLScriptElement | SVGScriptElement | null): Promise<EmbedTarget> {
  await dom_ready()

  let resolved: unknown = target
  if (target == null) {
    if (script != null && contains(document.body, script)) {
      const parent = script.parentNode
      if (parent instanceof HTMLElement || parent instanceof DocumentFragment) {
        resolved = parent
      }
    }
    resolved ??= document.body
  } else if (isString(target)) {
    const found = document.querySelector(target)
    if (found instanceof HTMLElement) {
      resolved = found.shadowRoot ?? found
    } else {
      throw new Error(`'${target}' selector didn't match an HTMLElement`)
    }
  } else if (typeof $ !== "undefined" && (target as any) instanceof $) {
    resolved = (target as Jq)[0]
  }

  if (resolved instanceof HTMLElement) {
    if (!resolved.isConnected) {
      throw new Error("Bokeh mount targets must be connected HTMLElements")
    }
    return resolved
  } else if (resolved instanceof DocumentFragment) {
    return resolved
  } else {
    throw new Error("target should be a connected HTMLElement, DocumentFragment, string selector, $ or null")
  }
}

export class BokehMount<T extends HasProps = HasProps> {
  private _state: MountState = "pending"
  private _error: MountError | null = null
  private readonly _errors: MountError[] = []
  private readonly _suppressed_roots = new Set<RootKey>()
  private readonly _on_abort = () => this._abort(this.signal?.reason)
  private _resolve_disposed!: () => void

  readonly ready: Promise<void>
  readonly when_disposed: Promise<void>
  private readonly _artifact: boolean

  constructor(
    source: MountSource<T> | Promise<PreparedArtifact>,
    target: MountTarget | undefined,
    private readonly _options: MountOptions,
    script: HTMLScriptElement | SVGScriptElement | null,
  ) {
    this._artifact = !(source instanceof MountSource)
    this.when_disposed = new Promise<void>((resolve) => this._resolve_disposed = resolve)
    if (source instanceof MountSource) {
      this._set_source(source)
    }

    const {signal} = _options
    if (signal?.aborted == true) {
      this._abort(signal.reason)
    } else {
      signal?.addEventListener("abort", this._on_abort, {once: true})
    }

    this.ready = this._initialize(source, target, script)
    void this.ready.catch(() => {})
  }

  private _source: MountSource<T> | null = null
  private _mount: StandaloneMount | null = null
  private _session: ClientSession | null = null
  private _release: (() => void) | null = null

  get ownership(): MountOwnership {
    return {
      document: this._source?.document_ownership ?? "mount",
      views: "mount",
      targets: "caller",
      session: this._session == null ? "none" : "mount",
      resources: this._artifact ? "shared" : "none",
    }
  }

  private _set_source(source: MountSource<T>, prepared?: PreparedArtifact): void {
    this._source = source
    this._session = prepared?.session ?? null
    this._release = prepared?.release ?? null
    this._mount = new StandaloneMount(
      source.document,
      new Map(source.roots),
      source.document_ownership == "mount",
      undefined,
      (error, root_key) => this._record_error(mount_error("render", error, root_key)),
      source.track_document_roots,
    )
  }

  get document(): Document {
    if (this._source == null) {
      throw new MountError("source", "the Bokeh artifact document is not available before mount readiness")
    }
    return this._source.document
  }

  get session(): ClientSession | null {
    return this._session
  }

  get root_keys(): readonly RootKey[] {
    return this._mount?.root_keys ?? []
  }

  get roots(): ReadonlyMap<RootKey, T> {
    return this._mount == null ? new Map() : this._mount.roots as unknown as ReadonlyMap<RootKey, T>
  }

  get models(): readonly T[] {
    return [...this.roots.values()]
  }

  get views(): ViewOf<T>[] {
    return this.root_keys.map((key) => this.view(key)).filter((view) => view != null)
  }

  get targets(): ReadonlyMap<RootKey, EmbedTarget> {
    return this._mount?.targets ?? new Map()
  }

  root(key: RootKey): T | null {
    return this._mount?.root(key) as T | null ?? null
  }

  view(key: RootKey): ViewOf<T> | null {
    return this._mount?.view(key) as ViewOf<T> | null ?? null
  }

  target(key: RootKey): EmbedTarget | null {
    return this._mount?.target(key) ?? null
  }

  get view_manager(): ViewManager {
    if (this._mount == null) {
      throw new MountError("source", "the Bokeh artifact view manager is not available before mount readiness")
    }
    return this._mount.views
  }

  get state(): MountState {
    return this._state
  }

  get error(): MountError | null {
    return this._error
  }

  get errors(): readonly MountError[] {
    return this._errors
  }

  get disposed(): boolean {
    return this._state == "disposed" || this._state == "failed" || this._mount?.disposed == true
  }

  private get signal(): AbortSignal | undefined {
    return this._options.signal
  }

  private _record_error(error: MountError): void {
    this._error = error
    this._errors.push(error)
    try {
      this._options.on_error?.(error)
    } catch (callback_error) {
      logger.error(`Bokeh mount error callback failed: ${callback_error}`)
    }
  }

  private _check_pending(): void {
    if (this._state == "disposed") {
      throw this._error ?? new MountError("disposed", "Bokeh mount was disposed before becoming ready")
    }
  }

  private async _initialize(source: MountSource<T> | Promise<PreparedArtifact>, target: MountTarget | undefined,
      script: HTMLScriptElement | SVGScriptElement | null): Promise<void> {
    try {
      this._check_pending()
      if (!(source instanceof MountSource)) {
        const prepared = await source
        if (this._state == "disposed") {
          prepared.release()
          prepared.document.destroy()
          this._check_pending()
        }
        const normalized = new MountSource(
          prepared.document,
          prepared.roots,
          prepared.document_ownership,
          prepared.track_document_roots,
        ) as MountSource<T>
        this._set_source(normalized, prepared)
      }
      const mount = this._mount
      if (mount == null) {
        throw new MountError("source", "failed to prepare a Bokeh mount source")
      }
      const configured_targets = this._options.targets
      let default_target: EmbedTarget | null = null
      const targets = new Map<RootKey, EmbedTarget>()

      try {
        if (configured_targets == null || target != null) {
          default_target = await resolve_target(target, script)
        }
        if (configured_targets != null) {
          for (const [key, configured] of keyed_entries(configured_targets)) {
            if (!this.roots.has(key)) {
              throw new MountError("target", `unknown Bokeh mount root '${key}'`, undefined, key)
            }
            if (configured != null && !this._suppressed_roots.has(key)) {
              try {
                targets.set(key, await resolve_target(configured, null))
              } catch (error) {
                throw mount_error("target", error, key)
              }
            }
          }
        }
      } catch (error) {
        throw mount_error("target", error)
      }

      this._check_pending()
      for (const key of this._suppressed_roots) {
        targets.delete(key)
      }
      await mount.initialize(default_target, targets, this._options.use_for_title)
      this._check_pending()
      this._state = "ready"
    } catch (error) {
      const mounted_error = mount_error("render", error)
      if (this._state != "disposed") {
        this._state = "failed"
        this._record_error(mounted_error)
        this._mount?.dispose()
        this._release?.()
        this._release = null
        this._resolve_disposed()
      }
      throw this._error ?? mounted_error
    }
  }

  async attach(key: RootKey, target: MountTarget): Promise<ViewOf<T> | null> {
    this._suppressed_roots.delete(key)
    await this.ready
    let resolved: EmbedTarget
    try {
      resolved = await resolve_target(target, null)
    } catch (error) {
      const mounted_error = mount_error("target", error, key)
      this._record_error(mounted_error)
      throw mounted_error
    }

    try {
      return await this._mount!.attach(key, resolved) as ViewOf<T> | null
    } catch (error) {
      const mounted_error = mount_error("render", error, key)
      this._record_error(mounted_error)
      throw mounted_error
    }
  }

  replace_target(key: RootKey, target: MountTarget): Promise<ViewOf<T> | null> {
    return this.attach(key, target)
  }

  detach(key: RootKey): void {
    if (this._state == "pending" && this._mount == null) {
      this._suppressed_roots.add(key)
      return
    }
    if (!this.roots.has(key)) {
      throw new MountError("source", `unknown Bokeh mount root '${key}'`, undefined, key)
    }
    this._suppressed_roots.add(key)
    this._mount!.detach(key)
  }

  private _abort(reason: unknown): void {
    if (this._state == "disposed" || this._state == "failed") {
      return
    }
    this._error = new MountError("abort", reason instanceof Error ? reason.message : "Bokeh mount was aborted", reason)
    void this.dispose()
  }

  dispose(): Promise<void> {
    if (this._state == "disposed") {
      return this.when_disposed
    }
    if (this._state == "pending" && this._error == null) {
      this._error = new MountError("disposed", "Bokeh mount was disposed before becoming ready")
    }
    this.signal?.removeEventListener("abort", this._on_abort)
    this._mount?.dispose()
    this._release?.()
    this._release = null
    if (this._state != "failed") {
      this._state = "disposed"
    }
    this._resolve_disposed()
    return this.when_disposed
  }
}

export function mount<T extends ShowableRoot>(source: T, options?: MountOptions): BokehMount<T>
export function mount<T extends ShowableRoot>(source: T, target?: MountTarget, options?: MountOptions): BokehMount<T>
export function mount<T extends ShowableRoot>(source: readonly T[], options?: MountOptions): BokehMount<T>
export function mount<T extends ShowableRoot>(source: readonly T[], target?: MountTarget, options?: MountOptions): BokehMount<T>
export function mount<T extends ShowableRoot>(source: KeyedRoots<T>, options?: MountOptions): BokehMount<T>
export function mount<T extends ShowableRoot>(source: KeyedRoots<T>, target?: MountTarget, options?: MountOptions): BokehMount<T>
export function mount(source: MountSource | Document, options?: MountOptions): BokehMount<HasProps>
export function mount(source: MountSource | Document, target?: MountTarget, options?: MountOptions): BokehMount<HasProps>
export function mount(source: EmbedArtifact, options?: MountOptions): BokehMount<HasProps>
export function mount(source: EmbedArtifact, target?: MountTarget, options?: MountOptions): BokehMount<HasProps>
export function mount(source: Mountable, target_or_options?: MountTarget | MountOptions, options?: MountOptions): BokehMount

export function mount(source: Mountable, target_or_options?: MountTarget | MountOptions, options: MountOptions = {}): BokehMount {
  const script = document.currentScript // This needs to be evaluated before any asynchronous target resolution.
  const target = is_mount_options(target_or_options) ? undefined : target_or_options
  const mount_options = is_mount_options(target_or_options) ? target_or_options : options
  const artifact_like = isPlainObject(source) && typeof (source as {schema?: unknown}).schema == "string" &&
    (source as {schema: string}).schema.startsWith("bokeh.embed/")
  const normalized = artifact_like
    ? prepare_embed_artifact(source, mount_options.resources, mount_options.resolver, mount_options.signal)
    : as_mount_source(source)
  return new BokehMount(normalized, target, mount_options, script)
}

export async function mount_artifact_declaration(
  script: HTMLScriptElement | null = document.currentScript instanceof HTMLScriptElement ? document.currentScript : null,
  options: MountOptions = {},
): Promise<BokehMount> {
  if (script == null) {
    throw new MountError("source", "an artifact declaration script is required")
  }
  const payload_url = script.dataset.bokehPayloadUrl
  let value: unknown
  if (payload_url != null) {
    let response: Response
    try {
      response = await fetch(payload_url)
    } catch (error) {
      throw new MountError("http", `failed to fetch Bokeh artifact from ${payload_url}: ${error}`, error)
    }
    if (!response.ok) {
      throw new MountError("http", `Bokeh artifact request failed: ${response.status} ${response.statusText}`)
    }
    try {
      value = await response.json()
    } catch (error) {
      throw new MountError("decode", `failed to decode Bokeh artifact from ${payload_url}: ${error}`, error)
    }
  } else {
    const payload = script.previousElementSibling
    if (!(payload instanceof HTMLScriptElement) || payload.dataset.bokehArtifactPayload == null) {
      throw new MountError("source", "an inline artifact declaration must follow its JSON payload script")
    }
    try {
      value = JSON.parse(payload.textContent)
    } catch (error) {
      throw new MountError("decode", `failed to decode inline Bokeh artifact: ${error}`, error)
    }
  }

  let artifact: EmbedArtifact
  try {
    artifact = validate_embed_artifact(value)
  } catch (error) {
    throw mount_error("schema", error)
  }
  const candidates = [...document.querySelectorAll<HTMLElement>(
    "[data-bokeh-artifact][data-bokeh-root]:not([data-bokeh-mounted])",
  )]
  const targets = new Map<RootKey, HTMLElement>()
  for (const root of artifact.roots) {
    const target = candidates.find((candidate) =>
      candidate.dataset.bokehArtifact == artifact.fingerprint && candidate.dataset.bokehRoot == root.key)
    if (target == null) {
      throw new MountError("target", `missing declaration target for Bokeh artifact root '${root.key}'`, undefined, root.key)
    }
    targets.set(root.key, target)
  }
  const server_default = artifact.source.kind == "server" && artifact.roots.length == 0
  const default_target = server_default
    ? candidates.find((candidate) =>
      candidate.dataset.bokehArtifact == artifact.fingerprint && candidate.dataset.bokehRoot == "*")
    : undefined
  if (server_default && default_target == null) {
    throw new MountError("target", "missing declaration target for Bokeh server artifact", undefined, "*")
  }
  for (const target of targets.values()) {
    target.dataset.bokehMounted = artifact.fingerprint
  }
  if (default_target != null) {
    default_target.dataset.bokehMounted = artifact.fingerprint
  }

  const handle = server_default
    ? mount(artifact, default_target, {resources: "none", ...options})
    : mount(artifact, {targets, resources: "none", ...options})
  for (const target of [...targets.values(), ...(default_target == null ? [] : [default_target])]) {
    const decorated = target as HTMLElement & {bokehMount?: BokehMount}
    decorated.bokehMount = handle
  }
  try {
    await handle.ready
  } catch (error) {
    for (const target of [...targets.values(), ...(default_target == null ? [] : [default_target])]) {
      delete target.dataset.bokehMounted
      delete (target as HTMLElement & {bokehMount?: BokehMount}).bokehMount
    }
    throw error
  }
  return handle
}

export async function show<T extends UIElement | DOMNode>(obj: T, target?: MountTarget): Promise<ViewOf<T>>
export async function show<T extends UIElement | DOMNode>(obj: readonly T[], target?: MountTarget): Promise<ViewOf<T>[]>
export async function show(obj: Document, target?: MountTarget): Promise<ViewOf<HasProps>[]>
export async function show(obj: UIElement | Document, target?: MountTarget): Promise<ViewOf<HasProps> | ViewOf<HasProps>[]>

export async function show(obj: Document | Showable, target?: MountTarget): Promise<ViewOf<HasProps> | ViewOf<HasProps>[]> {
  const mounted = mount(obj, target)
  await mounted.ready
  const result = isArray(obj) || obj instanceof Document ? mounted.views : mounted.views[0]
  return result
}
