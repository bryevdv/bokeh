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

All six replacement tasks use the dedicated `bokeh-embed` Conda environment for every project command, including Git, Python, Node.js, tests, and builds:

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

The EMBED 02 minimal-ID focused suite passes 129/129 with this command and source precedence. An earlier `dev313` run failed five tests because it imported the editable primary checkout; that result is recorded as wrong-source contamination, not a branch failure.

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

## Existing browser work and the target mount contract

The framework source branch currently establishes:

- `mount(obj, target, options) -> Promise<BokehMount>`;
- `BokehMount.document`, `.models`, `.views`, `.view_manager`, `.disposed`, and `.dispose()`;
- React, Vue, Angular, and Web Component adapters;
- multi-root and shared-document behavior.

The replacement lifecycle task should preserve that tested capability and evolve it toward the embedding contract:

- define a `MountSource` that accepts existing models/documents and versioned artifacts;
- use keyed root targets rather than only positional `root_targets`;
- make the handle the stable public surface; model/view internals may be expert accessors;
- specify readiness and structured error behavior;
- specify document, view, session, and target ownership;
- allow incremental root attach/detach where a shared document permits it;
- never require React/Vue/Angular adapters to inject scripts or manage BokehJS bundles.

The present `DocumentMountController` disposes the entire mount when any root target disappears. That behavior must be revisited for frameworks that conditionally render one root from a shared document.

## Minimal-ID integration rules

The minimal-ID source branch provides Python and BokehJS reference-graph analysis, anonymous model deserialization, and root preservation for the legacy standalone `RenderItem` path.

When replayed above the lifecycle branch:

- preserve lifecycle-aware construction/finalization and rollback when merging anonymous deserialization;
- keep `Document.to_json()` canonical and ID-full unless the caller explicitly compiles a static artifact;
- treat artifact roots as externally addressable by logical key plus document/root ordinal, so a root ID is not required merely for mounting;
- retain IDs for shared/cyclic models and for every externally referenced patch, comm, or server boundary;
- retain both lifecycle and minimal-ID tests in overlapping `has_props.ts` and document test files;
- add contract fixtures proving Python serialization and BokehJS deserialization agree for anonymous, shared, cyclic, rooted, and live-protocol graphs.

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

## Numbered branch stack

```text
branch-4.0
└── codex/embed-00-contract
    └── codex/embed-01-mount-frameworks
        └── codex/embed-02-minimal-ids
            └── codex/embed-03-artifact-runtime
                └── codex/embed-04-sphinx
                    └── codex/embed-05-jupyter
```

### EMBED 00 — Contract and stack coordination

Own the cross-language artifact schema, root addressing, resource requirement/policy vocabulary, lifecycle/ownership rules, compatibility policy, shared fixtures, and stack verification record. Keep design decisions here rather than letting later branches choose incompatible variants.

Acceptance:

- all current use cases and API overlaps have an explicit 3.x-to-4.0 mapping, including removal/error behavior where no facade is retained;
- schema fixtures cover static, multi-root, multi-document if retained, server-source, resources, buffers, and version/error cases;
- ownership, readiness, disposal, target replacement, and error propagation are normative;
- each later task records decisions that affect another layer back into this contract.

### EMBED 01 — Mount lifecycle and framework adapters

Replay and preserve the framework source branch, then align it with the common mount contract. Framework packages remain thin adapters over core BokehJS lifecycle APIs.

Acceptance:

- the original ten-commit capability is accounted for by range-diff or an explicit equivalence note;
- React, Vue, Angular, and Web Component fixtures cover mount/update/unmount, errors, multi-root, shared-document, and selective root removal;
- resource scripts are host-owned or resolved by the common loader, never injected independently by each framework;
- disposal and deserialization rollback are leak-tested.

### EMBED 02 — Minimal model IDs

Replay and preserve the minimal-ID source branch above the lifecycle work, resolve semantic overlaps, and expose an explicit static-artifact serialization policy.

Acceptance:

- the original six-commit capability is accounted for;
- canonical/live document serialization stays protocol-safe and ID-full where required;
- static artifact fixtures prove anonymous, shared, cyclic, keyed-root, and cross-language behavior;
- lifecycle-aware model construction and rollback remain intact;
- size and determinism measurements are recorded for representative documents.

### EMBED 03 — Artifact and resource runtime

Implement the versioned Python/JavaScript `EmbedArtifact`, compiler, renderers, resource requirements/policy resolver, promise-based loader, server-source representation, useful thin facades, and explicit 4.0 migration diagnostics. Extend the lifecycle branch's `mount()` instead of introducing another browser entry point.

Acceptance:

- one artifact supports page, typed fragment, JSON, external payload, and MIME rendering;
- one mount path handles standalone and server sources with keyed targets and observable errors;
- concurrent and sequential additive resource loading is deterministic and deduplicated;
- `file_html()` and `components()` delegate first; `JsonItem`, `RenderItem`, autoload, and wrapping-flag use cases move to the artifact APIs without constraining the new return shapes;
- cross-language schema fixtures plus retained-facade and 4.0 migration matrices run in CI.

### EMBED 04 — Sphinx and `bokeh-plot`

Make documentation builds a first-class static artifact consumer. Replace per-directive autoload programs and global monkeypatching with explicit output capture, artifact nodes, per-page aggregation, and exact resources.

Acceptance:

- pages without plots load no Bokeh assets;
- a plot page loads one bootstrap and each required bundle at most once;
- page requirements are the exact union of contained artifacts;
- multiple `show()` calls and multiple roots work without replacing `Document` or module globals;
- generated payload names are deterministic and incremental/parallel builds are correct;
- stale assets are managed by a manifest;
- HTML and non-HTML builders have tested output/fallback behavior;
- full docs build and browser tests include the existing high-plot-count pages and enforce size/request budgets.

### EMBED 05 — Jupyter and notebook hosts

Replay and preserve the Jupyter proof of concept above the common runtime, then refactor it into host adapters and address every latest-review blocker.

Acceptance:

- the original ten-commit feature set is accounted for;
- static, live standalone, server app, Colab, AnyWidget, marimo, saved output, and export use cases map to the common artifact/resource/mount APIs;
- output replacement/removal/virtualization has explicit bounded ownership and cleanup;
- patch history and binary buffers are bounded and revisioned;
- frontend units run from source in clean CI, package tests verify built assets, and AnyWidget/marimo are explicitly exercised;
- export links are safe and portable, concurrent exports are correlation-safe, and Playwright is the only browser automation layer;
- the detailed review test matrix above passes.

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
6. Run branch-local focused tests through `bokeh-embed`: lifecycle/framework tests on 01; those plus minimal serialization/deserialization tests on 02; artifact schema, loader, retained-facade/migration, and cross-language tests on 03; Sphinx unit/full-build/browser budgets on 04; the complete notebook matrix plus framework/mount smoke tests on 05. Before Python tests, verify the imported Bokeh path and use `python -m pytest -o pythonpath=src ...`.
7. Confirm each task's worktree starts from its named branch and no task silently forks from the repository default branch.
8. After every EMBED 00 contract commit, restack 01 through 05 sequentially and repeat adjacent-ancestry and `git diff --check` verification.
9. Keep source branches and old tasks until range-diffs, test results, unresolved known blockers, and task/branch/worktree mappings are recorded in `outputs/embed-stack-verification.md`.
