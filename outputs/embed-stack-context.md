/Users/bryan/.zlogin:9: nice(5) failed: operation not permitted
# EMBED overhaul: stack context and handoff contract

This file is the durable handoff for the replacement Codex tasks in the **Bokeh embed overhaul** project. It records the source work that must be preserved, the architectural contract shared by all branches, the intended stack, and branch-specific acceptance criteria.

The full embedding API inventory and design proposal is in `outputs/embedding-architecture-proposal.md`. Read that document before changing an API or wire format.

## Source work to preserve

The replacement stack starts at `branch-4.0` (`e40959e7da00157ff732a82e0bd428889c18e471`). The old tasks remain the provenance record until Bryan removes them.

| Area | Old Codex task | Source branch and tip | Source commits |
|---|---|---|---|
| Browser lifecycle and framework adapters | `Correct BokehJS HasProps initialization` (`019fbfa0-c51c-7941-928f-5ea90af08c8b`) | `bokehjs-framework-integration` at `25d555da5b3919a8b70bc3e40fa991840f1be0e5` | 10 commits, `f6c1acac41` through `25d555da5b` |
| Minimal serialized model IDs | `Minimal IDs` (`019ef71f-6a32-73e1-bb3b-c68bf278a55b`) | `minimal-ids` at `4b54c421bc747a42a802c70093aaa8f6c5fc9bab` | 6 commits, `4425f6cf0e` through `4b54c421bc` |
| Unified embedding design | `Unify Bokeh embedding APIs` (`01a020ce-d0cf-7221-925a-348a8d73a140`) | this coordination work | `outputs/embedding-architecture-proposal.md` and this handoff |
| Jupyter redesign | `Evaluate Bokeh Jupyter integration` (`019fd019-af5a-7352-a623-0efcecb5cad3`) | `poc/jupyter-integration-4.0` at `00136fe8f59b6f2498efcacd7012ea6b19d97a32` | 10 commits, `848be7fb78` through `00136fe8f5` |
| Initiative authoring | `Draft initiative proposal files` (`01a020b7-e04e-74f2-834b-56ce4b518bf2`) | separate proposal task | consume `outputs/embed-initiative-summary.md` |

Exact source commit sequences:

```text
bokehjs-framework-integration
f6c1acac41 Add BokehJS lifecycle and framework integration
5faf707b75 Publish framework packages and harden ESM types
6e7184058d Harden framework packages and production fixtures
f7c8e41950 Harden lifecycle cleanup and deserialization rollback
94fd75bcd4 Enforce lifecycle-aware model factories
e823d149b3 Add interactive framework example applications
bf1bc7430a Fix framework integration CI failures
969fa25a98 Fix Angular framework example dev server
330c919030 Document and test multi-root framework mounts
25d555da5b Add shared-document framework mounts

minimal-ids
4425f6cf0e checkpoint
a51ae225d7 checkpoint 2
4265d0e170 Support anonymous model deserialization
fe8b58d028 Tighten minimal ID graph analysis
d82f58a928 Simplify minimal ID serializer policy
4b54c421bc Clarify BokehJS reference collection

poc/jupyter-integration-4.0
848be7fb78 Add first-party Jupyter integration foundation
88785007cc Add automatic and synchronized notebook displays
8e5444888f Replace manual notebook pushes with live handles
5ab23696a5 Streamline notebook display and export APIs
b95d95a26c Finalize first-party Jupyter integration for Bokeh 4.0
e507ca7cc9 Support isolated Colab notebook outputs
8f25d7989e Add AnyWidget transport for marimo notebooks
7f2a65eacc Fix AnyWidget resources across frontend sessions
a6485cdf52 Fix increasing points in marimo demo
00136fe8f5 Move Jupyter frontend under Python sources
```

## Dedicated project environment

All eight replacement tasks use the dedicated `bokeh-embed` Conda environment for every project command, including Git, Python, Node.js, tests, and builds:

```text
/Users/bryan/anaconda3/bin/conda run -n bokeh-embed ...
```

This project rule overrides the workspace-level `dev313` default. The environment was created from `conda/environment-test-3.13.yml` and the transfer baseline is:

| Tool | Version |
|---|---|
| Python | 3.13.15 |
| Node.js | 24.19.0 |
| npm | 11.17.0 |
| pytest | 9.1.1 |

The installed local Bokeh 4.0 proof-of-concept wheel is distribution metadata and a static baseline only. No task may repoint this shared environment with `pip install -e` or another editable install. Before a consequential Python run, verify that `bokeh` resolves to the intended task checkout. From a task repository root, invoke pytest as:

```text
/Users/bryan/anaconda3/bin/conda run -n bokeh-embed python -m pytest -o pythonpath=src ...
```

The EMBED 03 minimal-ID focused suite passes 129/129 with this command and source precedence. An earlier `dev313` run failed five tests because it imported the editable primary checkout; that result is recorded as wrong-source contamination, not a branch failure.

## Shared architectural contract

The three implementation efforts are one program, not three independent API designs.

1. `mount()` and `BokehMount` are the browser lifecycle foundation. Framework adapters and notebook hosts consume them; they do not invent parallel render/disposal paths.
2. `EmbedArtifact` is the portable, versioned representation of embedding intent. It separates source, logical roots, dependency requirements, metadata, and buffers from DOM placement and resource location.
3. Logical root keys cross the Python/JavaScript boundary. Targets are supplied at mount time as caller-owned elements, selectors, or a root-key mapping. Random DOM IDs and `RenderItem` positional root arrays are compatibility details.
4. Minimal IDs are the static serialization policy, not a universal protocol change. Static pages, fragments, JSON artifacts, external artifacts, and docs use graph-minimal IDs. Server sessions, patches, comms, and live notebook transports retain every ID required by their protocol boundaries.
5. Resource requirements are emitted by the artifact compiler; resource policy resolves CDN, inline, server, relative, absolute, or host-owned delivery. Hosts may implement a resolver, but resource loading and deduplication have one promise-based contract.
6. A `BokehMount` has explicit readiness, errors, ownership, root access, and idempotent disposal. It must support multiple logical roots and shared documents. Hosts own their mount targets; Bokeh owns only the views, listeners, sessions, and resources documented by the handle.
7. Bokeh 4.0 is a breaking API boundary. Keep familiar APIs such as `components()`, `file_html()`, `save()`, and `show()` when they remain useful thin facades. Keep any other adapter only when it is isolated, cheap, and architecture-neutral. Do not preserve `RenderItem`, `JsonItem`, per-embed autoload programs, wrapping flags, or notebook-specific rendering machinery when doing so would maintain duplicate contracts; remove them or provide an explicit 4.0 migration error.
8. Sphinx is a primary static consumer and Jupyter is a primary live/hosted consumer. Neither is a special case allowed to bypass the common artifact, resource, and mount contracts.
9. Downstream artifacts that carry opaque patches or comm messages choose protocol-full serialization; ordinary static output stays graph-minimal. `notebook_content(..., live=True)` is the current public route. Exporting the source-neutral `embed_protocol()` compiler would remove notebook-specific naming for other patch hosts.
10. Existing server sessions have a public server-source artifact constructor, and declarative renderers expose their handle as `target.bokehMount`, with readiness, structured failure, and disposal but no global mount registry.
11. Hosts may own all resource tags with `resources="none"`, but this does not remove already-host-owned extension content from an artifact payload. The resource contract still needs a public named-extension satisfaction/manifest seam so application-local scripts, modules, styles, integrity, and ordering remain exact without duplicate bytes.
12. Connected notebook adapters outside Bokeh need a public protocol-2 host seam for resource records/leases and transport binding; they should not copy Bokeh's private notebook ownership machinery.
13. Server integrations that may initialize in a worker need a public owning scheduler/loop on `ServerContext`; downstream code must not have to reach through `application_context.io_loop`.

## Existing browser work and the target mount contract

The framework source branch originally established:

- `mount(obj, target, options) -> Promise<BokehMount>`;
- `BokehMount.document`, `.models`, `.views`, `.view_lookup`, `.root_keys`,
  `.root()`, `.view()`, `.target()`, `.disposed`, and `.dispose()`;
- React, Vue, Angular, and Web Component adapters;
- multi-root and shared-document behavior.

EMBED 02 resolves the browser boundary as follows:

- `mount()` returns a `BokehMount` synchronously so callers can dispose or abort
  work immediately; `handle.ready` covers source normalization, target
  resolution, construction, and readiness of every initially selected view.
- `MountSource` is the normalized runtime seam: one document, keyed logical
  roots, and explicit caller/mount document ownership. It is not a second wire
  schema. EMBED 04's artifact decoder and server source constructor must produce
  this normalized input and extend the same readiness pipeline with resources,
  decoding, and sessions.
- Missing or `null` keyed targets leave roots detached. `attach(key, target)`
  has its own awaitable readiness, `replace_target()` preserves an existing
  view where possible, and `detach(key)` removes only that root's view while the
  handle and shared document remain live.
- The handle owns views and listeners; the caller owns targets. Bare roots use
  a mount-owned temporary document, while a supplied document remains
  caller-owned. Session and loaded-resource ownership are reserved for EMBED 04
  and must be exposed through this same handle rather than a parallel lifecycle.
- `dispose()` is idempotent and awaitable. Early disposal, abort, target errors,
  and render errors roll back mount-owned views, target-local handle
  publications, listeners, and document ownership before readiness rejects.

The positional `mount_document_standalone()` option remains an internal bridge
for server/notebook callers that later branches still need to migrate. It is not
the public mount contract and must not constrain the artifact decoder or keyed
target API. Framework packages delegate to the core runtime and never inject
resources independently.

## Minimal-ID integration rules

The minimal-ID source branch provides Python and BokehJS reference-graph analysis, anonymous model deserialization, and root preservation for the legacy standalone `RenderItem` path.

When replayed above the lifecycle branch:

- preserve lifecycle-aware construction/finalization and rollback when merging anonymous deserialization;
- keep `Document.to_json()` canonical and ID-full unless the caller explicitly compiles a static artifact;
- use `Document.to_static_json()` as the explicit low-level compiler seam in Python and BokehJS; it applies graph-minimal IDs and accepts additional externally referenced models without changing canonical serialization;
- treat artifact roots as externally addressable by logical key plus document/root ordinal, so a root ID is not required merely for mounting;
- have the artifact decoder resolve those ordinals to models and construct EMBED 02's keyed `MountSource`; neither the fixture nor the runtime seam depends on `RenderItem` or DOM/model ID coupling;
- retain IDs for shared/cyclic models and for every externally referenced patch, comm, or server boundary;
- retain both lifecycle and minimal-ID tests in overlapping `has_props.ts` and document test files;
- add contract fixtures proving Python serialization and BokehJS deserialization agree for anonymous, shared, cyclic, rooted, and live-protocol graphs.
- derive deterministic artifact/build fingerprints from normalized source and options rather than raw serialized model IDs, because graph-required shared/cyclic IDs may remain allocation-dependent across equivalent document reconstructions.

## Jupyter architecture and latest review requirements

Jupyter belongs in this program because it exercises every layer: serialization, resource ownership, mounting, transport, disposal, rerendering, saved output, and host-specific lifecycle.

Target mapping:

| Notebook use case | Common architecture |
|---|---|
| Final-expression/static display | Static `EmbedArtifact` MIME payload, common resource resolver, `mount()` |
| `show(plot)` | Artifact plus notebook transport descriptor |
| Live standalone updates | ID-full initial artifact plus revisioned patches owned by a notebook handle |
| AnyWidget/marimo | Host adapter around the same artifact, resolver, and `BokehMount` |
| `show(Application)` | Server-source artifact mounted by the same browser API |
| Saved/exported output | Portable static artifact or explicit accessible fallback |

Notebook-specific code remains responsible for MIME registration, comm/AnyWidget transport, host capability detection, server-app proxying, export UI, and diagnostics. It should not own a parallel `docs_json`/`RenderItem`/`embed_items_notebook()` rendering lifecycle. The frontend should converge on `await mount(artifact, target, options)` and dispose the returned handle.

The newest review of `poc/jupyter-integration-4.0` found it promising but not merge-ready. Every item below is required context for the replacement Jupyter task:

1. Frontend runtime tests currently depend on generated `frontend/build/runtime.js`, which is excluded or removed in clean CI. Run frontend tests directly in the frontend package before packaging, and verify the packaged runtime separately.
2. Ignored or re-executed `show()` handles can leak document graphs. Python registries retain handles/source callbacks and the frontend `documentData` map retains serialized documents. Define output ownership and distinguish actual deletion/replacement from renderer virtualization.
3. AnyWidget retains unbounded patch history, including buffers. Replace this with a current snapshot plus monotonic sequence/revision cursor, bounded compaction, or an equivalently bounded protocol.
4. Absolute filenames can leak into saved notebook output and become broken links. Emit rich file links only for notebook-relative paths; otherwise emit a plain message.
5. Export UI state is keyed only by notebook path, so two tabs for one notebook race. Add a per-export correlation ID and select the matching context.
6. Split the roughly 600-line `plugin.ts` into testable units such as kernel comms, renderers, notebook model, export, and thin activation. Add direct Vitest coverage.
7. Add tests for comm failures/timeouts, settlement/closure, malformed and binary messages, renderer disposal/rerender, trust/output removal, traversal rejection, and concurrent exports.
8. Keep Playwright for real DOM, Shadow DOM, renderer, and export integration. Use Playwright only for browser automation; remove Selenium fallback.
9. CI must explicitly install and exercise AnyWidget and marimo; skipped or undiscovered tests are not evidence.
10. `_execute_cell_until()` must execute a cell once, then retry observation. It must not re-execute the cell on each poll.
11. Simplify before expanding: consider removing document-handle sequence/cursor/pending queues when synchronous broadcast suffices; stop maintaining a private mirror `Document` and reading `_held_events`; consolidate static/connected output assembly; require `view_id` consistently; share portable/extension runtime cleanup; remove the renderer-status handshake from `notebook_info` if it has no distinct responsibility.

The review validation baseline was 151 Python tests passing and `npm run check:protocol` passing with no review edits. This is a baseline, not proof that the blockers above are fixed.

EMBED 06 resolution (2026-08-20):

| Review item | Resolution and evidence |
|---|---|
| 1. clean-CI frontend tests | Handwritten TypeScript runs directly under Vitest before packaging; generated AnyWidget/labextension assets have separate Python/package checks. |
| 2. output ownership and leaks | Trusted notebook model scans own explicit `view_id` tags, counts duplicate views, distinguishes renderer virtualization from output replacement/deletion, releases only the last owner, and disposes mounts/comm/application sessions deterministically. Python registries are capped at 128 retained owners and reset detaches callbacks and closes frontends. |
| 3. AnyWidget history/buffers | Messages carry monotonic revisions; the frontend retains at most 64 pending patches or 8 MiB, then clears and requests a current artifact snapshot. Python batching caps held source events at 256. |
| 4. safe export links | Rich file MIME is emitted only for unambiguous notebook-relative paths with no absolute root, drive, backslash, or `..` component. Other paths produce a generic text result without the kernel path. |
| 5. export correlation | Each UI export uses a cryptographically random correlation ID. The authenticated POST, notebook path, and one-shot nbconvert GET must match; server storage is capped at 32 entries, 60 seconds, and 50 MiB per request. |
| 6. split `plugin.ts` | Activation is 14 lines; ownership/context, kernel comms, renderers, notebook observation, export, shared runtime, AnyWidget, and protocol are separate source modules with direct tests. |
| 7. failure/disposal/trust/concurrency tests | Python and Vitest cover malformed/traversal inputs, comm errors/timeouts, binary patch metadata, dispose-before-ready, replacement/deletion, duplicate IDs, trust downgrade, resync, mount rejection, latest-render-wins cancellation, concurrent exports, authorization, and bounded server state. |
| 8. Playwright only | Selenium fallback and imports were removed. BokehJS, JupyterLab, extension-disabled, and marimo browser automation use Playwright. |
| 9. AnyWidget/marimo CI | The wheel job explicitly installs and prints AnyWidget/marimo versions, then runs their focused unit and real browser suites. |
| 10. execute once | Browser helpers issue one `Shift+Enter`, wait for a changed completed execution prompt, and retry only observation. Save/reopen waits for the matching MIME output to reach disk before reload. |
| 11. simplify/shared cleanup | Notebook output compiles one common artifact/fragment, sends direct revisioned source-document events, and uses `Bokeh.mount()`/`BokehMount` for readiness, errors, replacement, cancellation, and disposal. Private mirror documents, `_held_events`, `docs_json`, `RenderItem`, notebook-specific loader programs, portable cleanup templates, and the renderer-status handshake are gone. |

The browser matrix additionally verifies static/live/server application views,
multi-display resource deduplication, output rerun, save/reopen reconnect,
extension-disabled fallback, and marimo reload. Proprietary Colab is covered by
production-adapter contract tests; an automated run inside the hosted Colab UI
remains environment-limited and is not claimed.

## Numbered branch stack

```text
branch-4.0
└── codex/embed-00-contract
    └── codex/embed-01-model-factories
        └── codex/embed-02-mount-frameworks
            └── codex/embed-03-minimal-ids
                └── codex/embed-04-artifact-runtime
                    └── codex/embed-05-sphinx
                        └── codex/embed-06-jupyter
                            └── codex/embed-07-view-index-cleanup
                                └── codex/embed-08-panel
```

## Ten-minute reviewer path

The shortest way to review the architecture is to follow one value from Python
intent to browser cleanup. Each transition has one owning task, so a reviewer
can reject an incompatible second implementation at the boundary where it
would be introduced.

| Transition | Contract to inspect | Owning task |
| --- | --- | --- |
| construct runtime objects | models and views are created through failure-atomic factories | EMBED 01 |
| establish DOM ownership | one keyed mount returns an immediate lifecycle handle | EMBED 02 |
| serialize static state | graph-minimal IDs and logical root keys replace global model-ID addressing | EMBED 03 |
| compile and deliver | one compiler produces a versioned artifact whose requirements are resolved by host policy | EMBED 04 |
| aggregate a documentation page | Sphinx unions artifact requirements and emits one page bootstrap | EMBED 05 |
| adapt a notebook host | Jupyter adds bounded synchronization and output ownership without another renderer | EMBED 06 |
| acquire from external JavaScript | target-local discovery replaces global view and document registries | EMBED 07 |
| migrate downstream | Panel consumes the completed contract and reports reusable Bokeh gaps separately | EMBED 08 |

The resulting lifecycle is intentionally small:

.. code-block:: python

   artifact = embed({"plot": plot, "controls": controls})
   page = render_page(artifact, resources=ResourcePolicy(mode="cdn"))

.. code-block:: javascript

   const mount = Bokeh.mount(artifact, {
     targets: {
       plot: document.querySelector("#plot"),
       controls: document.querySelector("#controls"),
     },
   })
   await mount.ready
   const plot = mount.root("plot")
   await mount.dispose()

Here the artifact declares what it needs, the host chooses how those
requirements are delivered, logical keys address roots, and the retained mount
owns readiness, lookup, errors, replacement, and cleanup. No DOM ID or global
model/view registry crosses those boundaries.

### EMBED 00 — Contract and stack coordination

Own the cross-language artifact schema, root addressing, resource requirement/policy vocabulary, lifecycle/ownership rules, compatibility policy, shared fixtures, and stack verification record. Keep design decisions here rather than letting later branches choose incompatible variants.

Acceptance:

- all current use cases and API overlaps have an explicit 3.x-to-4.0 mapping, including removal/error behavior where no facade is retained;
- schema fixtures cover static, multi-root, multi-document if retained, server-source, resources, buffers, and version/error cases;
- ownership, readiness, disposal, target replacement, and error propagation are normative;
- each later task records decisions that affect another layer back into this contract.

### EMBED 01 — Lifecycle-aware model factories

Factor the BokehJS construction prerequisite out of the framework branch. This
layer owns `HasProps.create()`, lifecycle-aware deferred construction and
finalization, failure/deserialization/view rollback, protected constructors,
factory typing, and the complete source/test/example call-site migration. It
does not own mount targets, framework adapters, artifact decoding, or resource
loading.

Acceptance:

- the prerequisite is a buildable three-commit series immediately above EMBED
  00 and below every mount consumer;
- all model construction and deserialization paths use the guarded factory and
  preserve exact-once cleanup on failure;
- direct constructor enforcement covers library, examples, fixtures, and tests;
- BokehJS build, focused lifecycle/construction tests, and lint pass before
  EMBED 02 is replayed.

### EMBED 02 — Mount lifecycle and framework adapters

Replay and preserve the framework source branch, then align it with the common mount contract. Framework packages remain thin adapters over core BokehJS lifecycle APIs.

Acceptance:

- the original ten-commit capability is accounted for by range-diff or an explicit equivalence note;
- React, Vue, Angular, and Web Component fixtures cover mount/update/unmount, errors, multi-root, shared-document, and selective root removal;
- resource scripts are host-owned or resolved by the common loader, never injected independently by each framework;
- mount-created documents, views, target publication, framework controllers,
  and listeners are leak-tested across failure and disposal. Model construction
  and deserialization rollback remain EMBED 01 responsibilities.

### EMBED 03 — Minimal model IDs

Replay and preserve the minimal-ID source branch above the lifecycle work, resolve semantic overlaps, and expose an explicit static-artifact serialization policy.

Acceptance:

- the original six-commit capability is accounted for;
- canonical/live document serialization stays protocol-safe and ID-full where required;
- static artifact fixtures prove anonymous, shared, cyclic, keyed-root, and cross-language behavior;
- lifecycle-aware model construction and rollback remain intact;
- size and determinism measurements are recorded for representative documents.

### EMBED 04 — Artifact and resource runtime

Implement the versioned Python/JavaScript `EmbedArtifact`, compiler, renderers, resource requirements/policy resolver, promise-based loader, server-source representation, useful thin facades, and explicit 4.0 migration diagnostics. Extend the lifecycle branch's `mount()` instead of introducing another browser entry point.

Acceptance:

- one artifact supports page, typed fragment, JSON, external payload, and MIME rendering;
- one mount path handles standalone and server sources with keyed targets and observable errors;
- concurrent and sequential additive resource loading is deterministic and deduplicated;
- `file_html()` and `components()` delegate first; `JsonItem`, `RenderItem`, autoload, and wrapping-flag use cases move to the artifact APIs without constraining the new return shapes;
- cross-language schema fixtures plus retained-facade and 4.0 migration matrices run in CI.

Implemented EMBED 04 decisions that later layers must preserve:

- v1 standalone artifacts normalize to one compiler document and structurally
  address roots by logical key plus document/root ordinal; server roots retain
  protocol-required model IDs only;
- `bokeh/api` is an explicit artifact requirement because the existing public
  `Bokeh.mount()` lifecycle remains in the API bundle; core does not import that
  lifecycle across the bundle boundary;
- artifact identity normalizes retained graph IDs; typed fragment/external
  build identity additionally covers resolved resource policy and renderer
  options;
- resource delivery is page-shared and promise-deduplicated, while server
  sessions are mount-owned and disposed through the same `BokehMount`;
- the stable declaration bootstrap is `Bokeh.mount_artifact_declaration()`;
  external artifacts reference JSON data rather than unique loader programs;
- `/embed.json` is the per-app server bootstrap route. The 4.0 route set no
  longer exposes `/autoload.js`;
- CSP `external_only` output requires external payload and bootstrap URLs;
  offline output rejects every external requirement.

Detailed API and migration recipes are in
`outputs/embed-04-artifact-runtime.md`; determinism results are in
`outputs/embed-04-artifact-measurements.md`.

### EMBED 05 — Sphinx and `bokeh-embed`

Make documentation builds a first-class static artifact consumer. Replace the
legacy `bokeh-plot` extension/directive and its per-directive autoload programs
with canonical `bokeh.sphinxext.bokeh_embed`, `.. bokeh-embed::`, explicit
output capture, artifact nodes, per-page aggregation, and exact resources.

Acceptance:

- pages without plots load no Bokeh assets;
- a plot page loads one bootstrap and each required bundle at most once;
- page requirements are the exact union of contained artifacts;
- multiple `show()` calls and multiple roots work without replacing `Document` or module globals;
- generated payload names are deterministic and incremental/parallel builds are correct;
- stale assets are managed by a manifest;
- HTML and non-HTML builders have tested output/fallback behavior;
- full docs build and browser tests include the existing high-plot-count pages and enforce size/request budgets.
- legacy `bokeh_plot` extension/configuration names and `.. bokeh-plot::` fail
  with source-located Bokeh 4 migration guidance; generated assets live under
  `_static/bokeh-embed` and recognized legacy assets are cleaned safely.

Implemented EMBED 05 decisions that later layers must preserve:

- documentation output capture is a context-local seam in `bokeh.io`; without
  an active capture, `show()`, `save()`, `output_file()`, and
  `output_notebook()` retain their normal behavior. Consumers must not restore
  global monkeypatching to capture output;
- each directive compiles ordinary Bokeh objects through `embed()` and the
  typed renderers. The docs-private `bokeh.embed-page/v1` manifest only groups
  public `bokeh.embed/v1` artifacts; it is not a second public artifact format;
- page instance keys combine docname, structural directive/artifact ordinals,
  and the normalized source fingerprint. Artifact roots remain logical keys
  plus document/root ordinals and never use DOM or model IDs for targeting;
- a page resolves the exact `ResourceRequirements.union()` through one
  explicit project policy. `cdn`, `inline`, `offline`, copied `static`,
  relative/absolute/server, CSP, and host-owned delivery all use EMBED 04's
  resolver and typed resource renderer;
- the page bootstrap calls `Bokeh.mount()` and retains the returned
  `BokehMount`; it does not own a parallel decoder, resource registry, or view
  lifecycle. EMBED 06 through 08 must continue to use the common mount contract;
- source/options/schema/version/callback-policy fingerprints key the directive
  cache and payload name. External sources are Sphinx dependencies; doctree
  purge/merge and atomic cache writes make incremental and parallel builds
  deterministic. One manifest owns and removes stale payload, bootstrap, and
  copied-vendor files;
- non-HTML/quick builders emit accessible fallback text. Static Python
  callbacks are an actionable source-located error by default; an intentional
  project may select `warn` or `suppress`, while server applications require a
  server embed outside `bokeh-embed`;
- cross-runtime fingerprint parity treats integral JSON numbers identically,
  and the BokehJS artifact decoder pre-registers ID-bearing objects before
  decoding forward references. These are shared EMBED 04 contract fixes, not
  Sphinx-only exceptions;
- Node development builds provide a CommonJS compiler entry point alongside
  the packaged `compiler.js`, allowing custom-extension docs to build under
  the project's Node 24 ESM package scope.

Full-build, incremental, browser, request, and size evidence is recorded in
`outputs/embed-05-sphinx-measurements.md`.

### EMBED 06 — Jupyter and notebook hosts

Replay and preserve the Jupyter proof of concept above the common runtime, then refactor it into host adapters and address every latest-review blocker.

Acceptance:

- the original ten-commit feature set is accounted for;
- static, live standalone, server app, Colab, AnyWidget, marimo, saved output, and export use cases map to the common artifact/resource/mount APIs;
- output replacement/removal/virtualization has explicit bounded ownership and cleanup;
- patch history and binary buffers are bounded and revisioned;
- frontend units run from source in clean CI, package tests verify built assets, and AnyWidget/marimo are explicitly exercised;
- export links are safe and portable, concurrent exports are correlation-safe, and Playwright is the only browser automation layer;
- the detailed review test matrix above passes.

### EMBED 07 — Global view-index cleanup

Remove public global view/document discovery after every in-tree consumer has a
retained or target-local mount route. The final browser contract has no
`Bokeh.index`, `Bokeh.documents`, or public `view_manager`. External hosts use
`target.bokehMount` or `Bokeh.when_mounted(target, {signal})`; mounted content is
addressed through `root_keys`, `root()`, `view()`, `target()`, `document`, and
`view_lookup`. Semantic cross-root lookup uses `Model.name`; callback-owned
models use explicit `CustomJS.args`.

Final parent for the downstream audit:
`codex/embed-07-view-index-cleanup` at
`159f97de9eb8bdd24c363c50095bdb6565c4a002`, based on EMBED 06 at
`885d319d5cfb19644538b559c94b7f1047475d14`.

### EMBED 08 — Panel downstream impact and patch proposal

Run last, after EMBED 01–07 are complete. Evaluate Panel against the finished Bokeh 4.0 artifact/resource/mount/lifecycle and target-local discovery design. Panel consumes the contract; it does not establish a parallel embedding architecture or force preservation of removed Bokeh internals.

Acceptance:

- identify the Panel revision and inventory every dependency on Bokeh embedding, `RenderItem`/`JsonItem`, resources, document/session APIs, custom models, comms, notebooks, server paths, and static export;
- map each affected Panel user workflow to the final Bokeh 4.0 route and separate Panel-owned changes from genuine reusable Bokeh contract gaps;
- produce a file- and symbol-specific Panel patch proposal or draft diff, with migration behavior, documentation changes, sequencing, and risk notes;
- specify focused and end-to-end tests for static HTML, templates, notebooks, Panel server, multi-root output, custom extensions, resource ownership, readiness/errors, and disposal;
- do not add a Bokeh compatibility shim solely for Panel internals when a clean Panel migration exists;
- record any cross-layer issue back into the EMBED contract and verification ledger before implementation diverges.

Final implementation evidence:

- Panel was pinned at `be0b5e2b0955a38a8871aa3fc1703b57c76c1e81`;
- `outputs/panel-bokeh-4.0.patch` is an applicable 45-file diff covering
  artifact/template/static/notebook/server output, BokehJS 4 compatibility,
  target-local component access, lifecycle disposal, protocol-full static
  replay, Panel-owned autoload with retained `/embed.json`, and explicit WASM
  migration errors;
- the independent affected suite passed 137 tests with 77 optional skips;
  extension build, TypeScript, Ruff, compileall, and browser lifecycle probes
  also passed;
- resolved assumptions and the three remaining reusable Bokeh gaps are recorded
  in the shared contract above and in `outputs/panel-impact-assessment.md`.

## Bokeh 4.0 migration and compatibility policy

- Bokeh 4.0 is intentionally allowed to break the 3.x embedding surface in order to establish one coherent architecture.
- Keep familiar APIs only when they remain useful thin facades or when an adapter is clean, isolated, cheap to maintain, and unable to constrain the new contracts.
- Preserve use cases and useful input capabilities: single objects, sequences, ordered mappings, `Document`, themes, templates, resource policies, headers/credentials, and reverse-proxy behavior all require documented 4.0 routes.
- Do not preserve `RenderItem`, `JsonItem`, `autoload_static()`, wrapping flags, or notebook-private rendering machinery merely for compatibility. Prefer removal or an explicit migration error to a shim that recreates duplicate serialization, loading, targeting, or lifecycle behavior.
- `EmbedArtifact` has its own compatibility rules. Do not infer a fixed one- or two-major-version support window for 3.x envelopes from that schema policy.
- Test retained facades semantically rather than by whitespace, random IDs, or incidental script layout. Test removals with actionable diagnostics and runnable replacement recipes.
- Publish one before/after recipe for every use-case row in `embedding-architecture-proposal.md` before Bokeh 4.0 ships.

## Verification protocol for the replacement stack

No old task should be removed until this audit passes.

1. Record the exact source tips and commit sequences above.
2. Verify every adjacent pair with `git merge-base --is-ancestor`.
3. Compare the framework replay with `git range-diff` and a tree diff excluding the contract files.
4. Compare the minimal-ID and Jupyter replays with `git range-diff`; record every conflict and why its resolution preserves both sides. Known semantic overlaps include `has_props.ts`, BokehJS document tests, `embed/index.ts`, and embed tests.
5. Run `git diff --check` on every branch range.
6. Run branch-local focused tests through `bokeh-embed`: construction, deserialization, rollback, and factory-enforcement tests on 01; lifecycle/framework tests on 02; those plus minimal serialization/deserialization tests on 03; artifact schema, loader, retained-facade/migration, and cross-language tests on 04; Sphinx unit/full-build/browser budgets on 05; the complete notebook matrix plus framework/mount smoke tests on 06; target-local discovery/removal checks on 07; and the Panel downstream apply, focused, build, lint, and browser probes on 08. Before Python tests, verify the imported Bokeh path and use `python -m pytest -o pythonpath=src ...`.
7. Confirm each task's worktree starts from its named branch and no task silently forks from the repository default branch.
8. After every EMBED 00 contract commit, restack EMBED 01 through the current top branch sequentially and repeat adjacent-ancestry and `git diff --check` verification.
9. Keep source branches and old tasks until range-diffs, test results, unresolved known blockers, and task/branch/worktree mappings are recorded in `outputs/embed-stack-verification.md`.
