/Users/bryan/.zlogin:9: nice(5) failed: operation not permitted
# EMBED replacement stack verification

This report is completed as branches and replacement tasks evolve. It supplements the verification protocol in `outputs/embed-stack-context.md`. The table records the last fully tested pre-ledger-restack tips; the final handoff reports the rewritten tips because every EMBED 00 commit intentionally rewrites descendant commit IDs.

## Source baselines

| Source | Tip | Status |
|---|---|---|
| `branch-4.0` | `e40959e7da00157ff732a82e0bd428889c18e471` | recorded |
| `bokehjs-framework-integration` | `25d555da5b3919a8b70bc3e40fa991840f1be0e5` | recorded and retained |
| `minimal-ids` | `4b54c421bc747a42a802c70093aaa8f6c5fc9bab` | recorded and retained |
| `poc/jupyter-integration-4.0` | `00136fe8f59b6f2498efcacd7012ea6b19d97a32` | recorded and retained |

## Branch and task mapping

| Task | Branch | Parent | Worktree | Transfer state |
|---|---|---|---|---|
| EMBED 00 | `codex/embed-00-contract` | `branch-4.0` | `/Users/bryan/work/trees/53c9/bokeh-embed` | clean pre-ledger tip `e1a03b8d1041` |
| EMBED 00A | `codex/embed-00a-model-factories` | `codex/embed-00-contract` | `/Users/bryan/work/trees/embed-00a-model-factories` | clean pre-ledger tip `398918081fa3`; three reviewable prerequisite commits |
| EMBED 01 | `codex/embed-01-mount-frameworks` | `codex/embed-00a-model-factories` | `/Users/bryan/work/trees/623b/bokeh-embed` | clean pre-ledger tip `3914f150da46`; 12 reviewable commits with exact pre-split tree equivalence |
| EMBED 02 | `codex/embed-02-minimal-ids` | `codex/embed-01-mount-frameworks` | `/Users/bryan/work/trees/0014/bokeh-embed` | clean pre-ledger tip `3b07d501340f`; eight reviewable commits |
| EMBED 03 | `codex/embed-03-artifact-runtime` | `codex/embed-02-minimal-ids` | `/Users/bryan/work/trees/feaa/bokeh-embed` | clean pre-ledger tip `d4f2503aec9e`; four reviewable commits |
| EMBED 04 | `codex/embed-04-sphinx` | `codex/embed-03-artifact-runtime` | `/Users/bryan/work/trees/1395/bokeh-embed` | clean pre-ledger tip `c73e68699cd5`; five reviewable commits |
| EMBED 05 | `codex/embed-05-jupyter` | `codex/embed-04-sphinx` | `/Users/bryan/work/trees/ad10/bokeh-embed` | clean pre-ledger tip `cbabeb0d9f2f`; four reviewable commits |
| EMBED 06 | `codex/embed-06-panel` | `codex/embed-05-jupyter` | `/Users/bryan/work/trees/e94b/bokeh-embed` | clean pre-ledger tip `65779f100177`; three reviewable commits; pre-final provenance retained as `backup/embed-06-panel-pre-final-6f0cb9211b` |

The project worktree `/Users/bryan/work/trees/bokeh-embed` is detached at the pre-handoff EMBED 00 contract tip and owns no stack branch.

## Dedicated environment

Every project command on all eight tasks uses:

```text
/Users/bryan/anaconda3/bin/conda run -n bokeh-embed ...
```

The environment came from `conda/environment-test-3.13.yml` and contains Python 3.13.15, Node.js 24.19.0, npm 11.17.0, and pytest 9.1.1. Its installed local Bokeh 4.0 proof-of-concept wheel is distribution metadata/static baseline only. Do not run `pip install -e` against any task. Before consequential Python validation, verify the imported Bokeh path; from a task root use `python -m pytest -o pythonpath=src ...`.

## Replay/equivalence audit

| Branch | Source comparison | Result | Notes |
|---|---|---|---|
| 00A + 01 | framework source range | passed | All ten source commits are accounted for. Factory/rollback/enforcement hunks were extracted into three prerequisite commits; mount/framework work was reshaped into 12 reviewable commits. The combined final tree equals the validated pre-split replay outside coordination outputs. |
| 02 | minimal-ID source range | passed | All six source commits are accounted for; only documented lifecycle-aware semantic conflict resolutions differ. |
| 05 | Jupyter source range | replay accounted for; replacement complete | All ten source commits are represented. The review series deliberately replaces the source POC's private document/render lifecycle with EMBED 03/04 artifacts, resource policies, and mounts; the blocker-by-blocker disposition is in `embed-stack-context.md`. |

## Ancestry and hygiene

| Check | Result |
|---|---|
| Every adjacent branch is an ancestor of the next | passed after the 2026-08-20 policy handoff and sequential restack |
| `git diff --check` for every branch range | passed after the 2026-08-20 policy handoff and sequential restack |
| No accidental wheel/build output committed | passed: no wheel, egg-info, distribution, or generated `frontend/build` tree; packaged Jupyter labextension static files belong to the preserved source POC |
| Source branches retained | passed |
| Old tasks retained until audit complete | required; no deletion authorized |

## Branch-local validation

| Branch | Required validation | Result |
|---|---|---|
| 00 | Markdown/context audit, source-tip verification, environment-policy check | passed; task-local import path and the four durable Markdown files verified |
| 00A | BokehJS lifecycle-aware construction, rollback, protected constructors, call-site migration, build/lint/focused units | passed: library build and lint plus 98 focused construction/deserialization/lifecycle tests; final three-commit prerequisite is clean |
| 01 | lifecycle core tests; React/Vue/Angular/Web Component fixtures; docs/type/package checks | passed: core mount units 19/19, all focused lint targets, and the full framework package/runtime suite including the dedicated packed Angular lifecycle contract; final ancestry, diff, and history checks passed |
| 02 | 01 smoke tests plus Python/BokehJS minimal-ID and cross-language round trips | completion suite passed; see the detailed EMBED 02 evidence below |
| 03 | schema fixtures, Python compiler/renderers, BokehJS mount/loader, retained-facade and migration matrix | passed; see the detailed EMBED 03 evidence below |
| 04 | Sphinx unit tests, incremental/parallel/full docs builds, browser tests, size/request budgets | passed; see the detailed EMBED 04 evidence below |
| 05 | source frontend units, packaged-runtime tests, notebook Python/protocol tests, AnyWidget/marimo CI, Playwright, common mount smoke | passed; see the detailed EMBED 05 evidence and `embed-05-jupyter-measurements.md` |
| 06 | Panel impact inventory, Bokeh 4.0 workflow mapping, applicable diff, focused and browser downstream validation | complete against Panel `be0b5e2b0955a38a8871aa3fc1703b57c76c1e81`; applicable 35-file patch, 133 focused passes/77 optional skips, extension/TypeScript/lint/build checks, and static/server/autoload browser lifecycle probes |

The earlier EMBED 02 `dev313` run that failed five tests imported an editable primary checkout. It is classified as wrong-source contamination, not a branch failure. The clean 129/129 result above is the valid branch evidence.

## EMBED 05 Jupyter host decisions and evidence

The Jupyter layer is now a host adapter over `EmbedArtifact`, exact
`ResourcePolicy` resolution, `Bokeh.mount()`, and `BokehMount`. Static output,
connected documents, managed ASGI sessions, saved output, and export all carry
the versioned artifact contract; notebook code owns only MIME, host discovery,
transport, ownership, export coordination, and diagnostics. No `docs_json`,
`RenderItem`, autoload program, private mirror `Document`, or notebook-specific
render lifecycle remains.

| Contract | Evidence |
|---|---|
| Readiness, replacement, cancellation, failure, and disposal | Shared runtime mounts into an abortable generation; late mounts are disposed, prior mounts are disposed on replacement, and failures become redacted actionable diagnostics. Direct Vitest covers dispose-before-ready, rejection, revision gaps, resync, and latest-render-wins concurrency. |
| Explicit output ownership | Trusted cell/output scans use mandatory `view_id`; duplicate display IDs remain owned until the last output disappears. Virtualized renderers do not release ownership. Deletion, replacement, trust downgrade, notebook disposal, `handle.close()`, and `app.stop()` release deterministic Python/frontend state. |
| Revisioned bounded synchronization | Python sends direct source-document patches with monotonic revisions and at most 256 held events. AnyWidget retains at most 64 patches or 8 MiB, then requests a fresh artifact snapshot. Every repeated `ready`, including reload without an earlier `disposed`, idempotently resynchronizes current state. |
| Explicit resources and CSP | Static/live/application displays resolve the artifact's exact requirements through the common policy. CDN, inline, offline, server/relative/absolute, host-owned `none`, nonce, cross-origin, integrity, and `external_only` rules remain explicit. Notebook records are deduplicated by exact asset identity and capped at 64 browser entries. |
| Security and export concurrency | File links reject absolute, drive-qualified, backslash, and parent-traversal paths. Managed apps reject non-loopback bind/proxy defaults and enforce token/origin boundaries. Export uses an authenticated 50 MiB POST, random per-export correlation, exact notebook-path match, one-shot consumption, 60-second TTL, and 32-entry bound. Untrusted notebooks never execute capture. |
| Packaging and hosts | The prebuilt labextension and AnyWidget ESM ship in the Bokeh wheel with protocol 2. CI explicitly installs AnyWidget and marimo, checks JupyterLab/server discovery, runs source Vitest before packaging, verifies packaged assets, and uses Playwright only. |

Recorded completion validation in the dedicated `bokeh-embed` environment:

| Validation | Result |
|---|---|
| Direct frontend Vitest | 5 files, 13 tests passed |
| Focused Python host/protocol/export/runtime suite | 94 passed |
| Broader Python I/O suite without Selenium driver modules | 121 passed |
| Focused Python Playwright PNG/SVG export | 9 passed; SVG root selection is mount-based rather than optional model-ID based |
| BokehJS library and unit compilation | passed |
| Focused BokehJS Playwright notebook patch suite | 3 passed, 2,345 deselected |
| Full Jupyter extension integration | 8 passed, including real JupyterLab lifecycle and extension-disabled fallback |
| Real marimo/AnyWidget browser integration | 1 passed |
| Ruff and selected Pyright | passed; 0 Pyright errors/warnings |

The complete measurements, validation commands, migration routes, and
downstream propagation decisions are in
`outputs/embed-05-jupyter-measurements.md`.

## EMBED 04 Sphinx consumer decisions and evidence

The branch replaces UUID-named per-directive autoload programs and global
monkeypatching with context-local Bokeh I/O capture, picklable artifact nodes,
deterministic source/options cache keys, per-page payloads, exact requirement
unions, one shared bootstrap, and common `Bokeh.mount()` lifecycle handles.
External source dependencies, doctree purge/merge handlers, atomic cache writes,
and a generated-asset manifest cover incremental and parallel builds. HTML
builders resolve explicit CDN/inline/offline/static/relative/host-owned and CSP
policies; non-HTML and quick builders receive accessible fallback text.

The Bokeh docs project intentionally selects `suppress` for Python callbacks so
its mixed server/CustomJS demonstration preserves the standalone JavaScript
portion. The extension default is still an actionable source-located error,
and server applications remain invalid static directive output. Custom models
use a development `.cjs` compiler entry point under Node 24's ESM package scope;
packaged distributions retain their existing `compiler.js` route.

Review series introduced by EMBED 04:

| Commit | Purpose |
|---|---|
| `797e8f4c80` | context-local documentation output capture |
| `fe7cbe65b1` | exact resource unions plus cross-runtime numeric fingerprint and forward-reference hardening |
| `eec871b7cf` | Node 24 development compiler entry point |
| `bf6fbe1efd` | artifact-backed Sphinx directives, page aggregation, policies, docs, and focused fixtures |

Validation through the dedicated `bokeh-embed` environment:

| Command or audit | Result |
|---|---|
| worktree import-path probe using `PYTHONPATH=src` | resolved to this task's `src/bokeh/__init__.py` |
| focused output capture, retained I/O, artifact, and complete Sphinx extension pytest selection | 75 passed |
| `BOKEH_DEV=yes` compiler unit module | 15 passed |
| focused Sphinx/Chromium integration fixture | 1 passed; two roots, five unique requests, zero console errors, payload/bootstrap/bundle budgets enforced |
| `node make test:unit --grep "core/serialization module"` | 25 passed |
| `node make eslint:lib`; bootstrap `node --check`; Python Ruff and staged hooks | passed |
| canonical `make html` with `-W -j 4`, static policy, and temporary output | passed for 570 Sphinx sources in 201.89 s |
| no-change canonical incremental build | passed in 28.00 s; manifest and 490-payload corpus hashes unchanged |
| full-output browser matrix | core/plot, 42-root widgets/tables, WebGL, MathJax, and compiled custom extension all fully mounted with zero console errors and no duplicate Bokeh URL |

The generated full site contained 490 artifact pages, 490 payloads totaling
55,937,313 bytes, one 1,961-byte bootstrap, and six exact shared BokehJS
bundles. The 42-root page used six Bokeh-owned requests; the 35-root plot page
used four. Exact page bytes, request sets, full-build tree sizes, hashes, and
the 9,337,415-byte data-payload high-water mark are recorded in
`outputs/embed-04-sphinx-measurements.md`.

Cross-layer decisions for EMBED 00/05/06 to propagate:

- `bokeh.embed-page/v1` is a docs-private grouping envelope, never a competing
  public artifact or notebook transport;
- output capture remains context-local and inert outside its scope;
- consumer instance keys and target selection use logical keys and structural
  ordinals, not model/DOM IDs;
- all hosts resolve requirements through the common policy and keep the common
  `BokehMount`; none may copy the Sphinx bootstrap into a new lifecycle;
- integral JSON-number canonicalization and decoder forward-reference support
  are shared artifact guarantees;
- static Python callbacks and server applications require explicit host routes,
  not a silent second standalone pipeline.

## EMBED 03 artifact/runtime decisions and evidence

The branch implements one immutable `bokeh.embed/v1` envelope in Python and
BokehJS, graph-minimal standalone compilation, structural logical roots,
server-source bootstrap, typed output renderers, exact standalone requirements,
conservative dynamic server requirements, resource policies, and a deterministic
promise registry. Artifact decoding feeds EMBED 01's `MountSource` and
`BokehMount`; repeated/early/failing mounts use that lifecycle's rollback and
idempotent disposal.

The shared fixture at
`bokehjs/test/unit/embed/artifact_fixtures.json` is read directly by Python and
BokehJS tests. It covers keyed standalone roots without forced IDs, explicit
buffers/metadata, server source fields and selected roots, resource manifests,
and versioned envelopes with Python-compatible expected fingerprints. Focused
tests add malformed schema/fingerprint cases, allocation-independent
fingerprints, CSP/offline policy conflicts, additive concurrent loading, server
HTTP and bootstrap-schema errors, allowlisted credentialed CORS, retained
facade behavior, and actionable 4.0 migration errors.

Validation through the dedicated `bokeh-embed` environment:

| Command | Result |
|---|---|
| worktree import-path probe using `PYTHONPATH=src` | resolved to this task's `src/bokeh/__init__.py` |
| `python -m pytest -o pythonpath=src` on retained embed modules, artifact/compiler/renderers, server bootstrap view, ASGI, and Tornado server modules with `BOKEH_DEV=true` | 217 passed |
| `python -m ruff check` on changed Python source/tests | passed |
| `node make lib:build` | passed repeatedly with deterministic bundle hashes |
| `node make test:compile:unit` | passed |
| `node make eslint:lib eslint:test:unit` | passed after focused fixes |
| `node make test:unit --grep "EmbedArtifact runtime"` | 14 passed |
| `node make test:unit --grep "in api/plotting module\|minimal ID cross-language fixtures"` | 22 passed |

The headless browser run used locally available Chrome 151 while the runner
reports Chrome 141 as officially supported. The managed sandbox blocks local
test ports, so browser validation ran with the approved local-socket sandbox
override; no network publication or GitHub operation occurred.

Payload/build measurements and hashes are recorded in
`outputs/embed-03-artifact-measurements.md`. The full schema, lifecycle,
resource policy, migration matrix, and downstream propagation decisions are in
`outputs/embed-03-artifact-runtime.md`.

## EMBED 02 minimal-ID decisions and evidence

The six source capabilities remain accounted for:

| Source commit | Preserved capability |
|---|---|
| `4425f6cf0e` | Python and BokehJS graph-minimal serializers, canonical ID-full defaults, anonymous document roots, and shared-identity round trips |
| `a51ae225d7` | Standalone static embedding policy with explicit compatibility retention for roots still addressed by the legacy bridge |
| `4265d0e170` | Python anonymous-model deserialization with client-side ID allocation |
| `fe8b58d028` | Immediate-reference counting and cycle analysis that retains IDs only for shared/cyclic graph members, not their unshared ancestors |
| `d82f58a928` | Explicit serializer membership policy for models that require IDs |
| `4b54c421bc` | BokehJS `ReferenceCollector` abstraction shared by graph traversal without replacing lifecycle construction state |

Lifecycle conflict resolutions are intentional. All replayed and new BokehJS model construction uses `Model.create()`, including the cyclic-graph regression that the original source test constructed directly. Anonymous deserialization still uses deferred lifecycle-aware construction and finalization; failed construction/deserialization cleanup remains reversible. The lifecycle binary-buffer replacement test is retained. `ReferenceCollector` coexists with the guarded construction stack rather than replacing it.

`Document.to_json()` remains canonical and ID-full in both runtimes. The new `Document.to_static_json()` is the explicit low-level compiler seam: it uses graph-minimal IDs and accepts an additional externally referenced model set without changing canonical or patch/session behavior. Static roots are described by logical key plus document/root ordinal in the shared fixture, then resolved into EMBED 01's keyed `MountSource`; roots do not retain IDs merely for DOM mounting. The legacy standalone bridge calls the same seam but temporarily requests root IDs because `RenderItem` still requires them; EMBED 03 must not inherit that compatibility requirement.

The single fixture payload in `bokehjs/test/unit/document/minimal_ids_fixture.ts` is consumed directly by both Python and BokehJS tests. It covers anonymous models, shared identity, a two-model cycle, deterministic map/root order, two logical root keys, Python serialization, Python and BokehJS deserialization, keyed `MountSource` normalization, canonical serialization, and live patch IDs.

Validation through the dedicated `bokeh-embed` environment:

| Command | Result |
|---|---|
| `python -c 'import bokeh; print(bokeh.__file__)'` with `PYTHONPATH=src` | resolved to this task's `src/bokeh/__init__.py` |
| `python -m pytest -o pythonpath=src tests/unit/bokeh/core/test_serialization.py tests/unit/bokeh/embed/test_util__embed.py -q` | 129 passed |
| the same baseline plus `tests/unit/bokeh/document/test_minimal_ids.py` | 133 passed |
| `node make lib:build` | passed |
| `node make test:compile:unit` | passed |
| `node make eslint:lib` | passed |
| `node make eslint:test:unit` | passed |
| `node make test:unit --grep "minimal ID cross-language fixtures"` | 3 passed |
| `node make test:unit --grep "Document"` | 50 passed |
| `node make test:unit --grep "core/has_props module"` | 19 passed |
| `node make test:unit --grep "core/serialization module"` | 24 passed |
| `ruff check` on changed Python source/tests | passed |

Headless BokehJS validation used locally available Chrome 151 while the runner reports Chrome 141 as officially supported. The warning produced no test, browser, or protocol failures.

Payload sizes, ID counts, repeated determinism, and equivalent-rebuild behavior are recorded in `outputs/embed-02-minimal-id-measurements.md`. The line-plot measurement confirms that graph-required IDs may remain allocation-dependent across equivalent rebuilds; EMBED 03 must derive artifact/build fingerprints from normalized source and options rather than raw retained model IDs.

Cross-layer decisions for EMBED 00/03 to propagate:

- the artifact root descriptor is structural (`key`, document ordinal, root ordinal), not a mandatory model-ID reference;
- the artifact compiler calls `Document.to_static_json()` and supplies extra ID-bearing models only for an actual external protocol reference;
- canonical documents, server/session state, patches, comms, and live notebook transports use ID-full serialization;
- the artifact decoder resolves structural roots after deserialization and constructs the existing keyed `MountSource`/`BokehMount` lifecycle;
- deterministic artifact/build identity must be computed independently of allocation-dependent graph-required IDs.

## EMBED 01 lifecycle decisions and evidence

- The public runtime input is `MountSource`, containing one document, keyed
  logical roots, and document ownership. Serialized `EmbedArtifact` decoding,
  resource loading, and server sessions remain EMBED 03 responsibilities and
  must feed this seam and the existing `BokehMount`, not create another handle.
- Initial `ready` includes target resolution plus construction and readiness of
  selected root views. Unselected roots in a shared document do not block it;
  each later `attach()` is independently awaitable.
- Targets are caller-owned, views are mount-owned, and document ownership is
  explicit. Selective detach and target replacement preserve the shared
  document and sibling roots. Disposal is synchronous in its DOM/model cleanup,
  returns an awaitable completion promise, and is idempotent.
- Structured errors currently cover source, target, render, abort, and early
  disposal failures with logical root keys where applicable. EMBED 03 extends
  the vocabulary for decode, resource, HTTP, WebSocket, and session failures.
- Focused DOM units exercise readiness, keyed/multi-root placement, shared
  caller documents, selective detach/reattach, target replacement, dynamic root
  add/remove failures, abort/supersession, failure rollback, global-index
  cleanup, and repeated disposal.
- The framework fixture uses the shared base controller for error, callback
  rollback, exact-once disposal, and selective lifecycle assertions. React,
  Vue, Svelte, and Web Component production and development fixtures run the
  complete shared contract. The packed Angular fixture independently exercises
  linked roots in separate Angular-owned targets, native-control updates,
  selective detach/reattach, provider unmount/remount, structured target-error
  rollback, and exact-once final disposal. All packages build from packed npm
  artifacts and stay within their bundle budgets.

The original ten source commits remain fully accounted for. Their factory and
rollback hunks were extracted into EMBED 00A, and EMBED 01 was rewritten into
12 reviewable mount/framework commits above that prerequisite. The combined
tree is exact against the validated pre-split replay, so the history change does
not change framework behavior.

### Lifecycle-aware factory extraction boundary

EMBED 00 has no dependency on the lifecycle-aware model factory. The completed
prerequisite therefore sits immediately after EMBED 00 and before EMBED 01. It
was hunk-split from three interleaved source commits:

- `ef43625b05` (`Add BokehJS lifecycle and framework integration`, 470 files)
  contains the start of the prerequisite: `HasProps.create()`, the guarded
  construction stack, explicit property/initialization/signal lifecycle states,
  deferred construction for deserialization, failure cleanup, and the first
  broad conversion from direct model constructors to lifecycle-aware factories.
  The same commit also introduces the mount runtime, adapters, fixtures,
  package/lockfile changes, and generated baselines that belong to EMBED 01.
- `69a69c749b` (`Harden lifecycle cleanup and deserialization rollback`, 16
  files) is the second prerequisite slice. Its `has_props.ts`, deserializer,
  document, and general view-construction changes make destruction idempotent
  and make failed construction/deserialization/view initialization reversible.
  Its `api/io.ts` and `embed/*` hunks are mount-specific and remain EMBED 01.
- `122961a89a` (`Enforce lifecycle-aware model factories`, 390 files) completes
  the prerequisite by making model constructors protected, tightening
  `HasPropsClass`/factory typing including `Figure.create()`, and converting the
  remaining source, example, and test call sites to `.create()`.

The completed review series is:

| Commit | Purpose |
|---|---|
| `0936442934` | lifecycle-aware BokehJS construction and deferred finalization |
| `ff1410648c` | reversible construction/deserialization/view rollback and exact-once cleanup |
| `398918081f` | protected constructors, factory typing, and complete call-site enforcement |

The extracted layer retains construction, deserialization, document,
view-cleanup, typing, constructor-visibility, call-site, and associated unit
tests as one buildable prerequisite. BokehJS library build, lint, and 98 focused
construction/deserialization/lifecycle tests passed. Mount-specific `api/io.ts`
and `embed/*` work remains in EMBED 01.

### Recorded EMBED 01 commands

All commands ran from `bokehjs/` through the dedicated `bokeh-embed`
environment.

| Command | Result |
|---|---|
| `node make lib:build` | passed |
| `node make test:unit --grep "in api/plotting module"` | 19 passed, 0 skipped, 2306 deselected |
| `node make eslint:lib` | passed |
| `node make eslint:test:unit` | passed |
| `node make eslint:frameworks` | passed |
| `node make eslint:test:frameworks` | passed |
| `node make eslint:examples:frameworks` | passed |
| `node make test:frameworks` | passed: library/framework builds, package type checks, SSR construction, React/Vue/Svelte/Web Component production fixtures, React/Vue/Svelte development fixtures, all nine packed examples, bundle budgets, and the dedicated Angular lifecycle contract |

Headless validation used locally available Chrome 151 while the runner reports
Chrome 141 as its officially supported version. The version warning did not
produce browser exceptions, network failures, or test failures.

## Known unresolved review blockers

All eleven recorded Jupyter review blockers are resolved with implementation
and evidence in `outputs/embed-stack-context.md` and
`outputs/embed-05-jupyter-measurements.md`. Hosted Colab browser automation is
the only environment-limited check; the exact production static and connected
adapter contracts are unit-tested and the documentation labels the hosted
smoke test as pending rather than claiming it passed.

EMBED 06 was rerun against the actual completed EMBED 00A–05 Python and
BokehJS APIs. The earlier conceptual assessment remains only as provenance; its
speculative existing-session, declarative-mount, and blanket ID-retention gaps
were replaced with observed API evidence.

## Bokeh 4.0 compatibility evidence

Every 3.x embedding use case must have a tested 4.0 route and migration recipe. Familiar APIs are retained only as useful thin facades; any other adapter must be isolated, cheap, and architecture-neutral. There is no promised one- or two-major compatibility window for `JsonItem`, `RenderItem`, autoload programs, wrapping flags, or notebook-private rendering machinery.

## Panel downstream inspection

| Evidence | Result |
|---|---|
| Local checkout preference | no Panel checkout found under `/Users/bryan/work` |
| Authoritative source | disposable shallow clone of `https://github.com/holoviz/panel.git`; independent clean snapshots used for apply/test validation; no user checkout or GitHub mutation |
| Revision | `be0b5e2b0955a38a8871aa3fc1703b57c76c1e81`, `main`, 2026-08-20, `Make Tabulator edits more robust (#8731)` |
| Panel version boundary at revision | Panel JS `1.9.4`; Python `bokeh >=3.7,<3.10`; JavaScript `@bokeh/bokehjs ^3.9.2` |
| Completed API inspection | Python `embed`, `embed_server`, `notebook_content(live=True)`, artifact renderers/resource policies; BokehJS `mount`, `BokehMount`, declaration target handles, server ownership, attach/detach/dispose; EMBED 05 protocol-2 and `StandaloneMount` decisions |
| Downstream inventory | static HTML/state/PNG, templates and multi-root placement, notebook/PyViz/Jupyter preview, Panel Tornado/Django/FastAPI server paths, Pyodide/PyScript conversion, custom extension resources, React/ReactiveESM/AnyWidget models, disposal, docs/Sphinx/JupyterLite, packaging, and CI |
| Applicable diff | `outputs/panel-bokeh-4.0.patch`; 35 files, 497 insertions, 381 deletions; clean `git apply --check`, apply, and `git diff --check` |
| Draft boundary | Python `bokeh >=4.0.0.dev1,<4.1.0`; JavaScript `@bokeh/bokehjs ^4.0.0-dev.1`; intended for a breaking Panel line, not Panel 1.9 maintenance |
| Explicit residual | Bokeh 4 Pyodide/PyScript conversion raises a targeted migration error until its RenderItem/JsonItem worker transport becomes artifact/mount based |
| Runtime import | Bokeh `/Users/bryan/work/trees/e94b/bokeh-embed/src/bokeh/__init__.py`, `4.0.0.dev1+42.ga6485cdf`; Panel imported from each disposable patched snapshot using temporary dependency files, without an editable install |

Final source evidence corrected the conceptual gap list:

- `embed_server(token=..., roots=...)` already supports an existing session;
- `mount_artifact_declaration()` already exposes its handle as
  `target.bokehMount`;
- Panel static state can select protocol-full serialization rather than adding
  a blanket static-ID exception.

The remaining reusable Bokeh requirements are:

1. payload-level satisfaction of named, host-owned extensions (not only
   `resources="none"` at execution time);
2. a public protocol-2 resource lease/display/transport seam for third-party
   connected notebook hosts;
3. a public owning scheduler/loop accessor on `ServerContext` for handlers that
   may initialize in a worker.

The extension finding is measured: a single Panel Button artifact included a
768,401-byte inline `panel.min.js` requirement and was 787,958 bytes even though
the Panel page separately owned the same bundle.

## EMBED 06 validation evidence

### Worktree and history

- worktree: `/Users/bryan/work/trees/e94b/bokeh-embed`;
- branch: `codex/embed-06-panel`;
- finalized parent: `codex/embed-05-jupyter` at
  `cbabeb0d9f2fbf9971a6ca747fc17b6fe292db1f`;
- pre-final assessment commit: `6f0cb9211b3ae90efe5aa3f2a1685796673f0afb`,
  retained as `backup/embed-06-panel-pre-final-6f0cb9211b`;
- final tip and coherent assessment/patch/validation commits are reported at
  handoff because the verification commit cannot contain its own SHA.

### Patch applicability

An independent clean Panel clone at the pinned revision passed:

- `git apply --check outputs/panel-bokeh-4.0.patch`;
- `git apply outputs/panel-bokeh-4.0.patch`;
- `git diff --check`.

Temporary wheel-built Panel distribution assets were copied only into the
disposable validation clones. No Panel checkout under `/Users/bryan/work` was
created or modified.

### Python validation

| Check | Result |
|---|---|
| Bokeh import | exact worktree path and `4.0.0.dev1+42.ga6485cdf` |
| Panel import | exact independent temporary patched checkout |
| Ruff on changed Python/tests | passed |
| `python -m compileall -q panel` | passed |
| final affected suite: artifact/save/notebook/server | 133 passed, 77 skipped in 29.72s |
| isolated rerun of `test_server_thread_pool_bokeh_event[tornado]` | 1 passed in 0.85s |

One prior complete run reported `131 passed, 77 skipped, 1 failed` because it
timed out while observing a transient `_pending_edits` marker after the event
had already completed; captured logs showed all five events were processed, and
the isolated rerun passed. A separate clean snapshot initially produced 16
failures because generated `panel/dist` fixtures were absent. After copying the
same temporary wheel-built assets used in the first clean clone, it produced the
final 133/77 result. These attempts are retained here rather than hidden.

### JavaScript/build validation

| Check | Result |
|---|---|
| BokehJS `npm ci` | passed; 924 packages; audit reported 12 existing vulnerabilities |
| completed local BokehJS build | passed |
| Panel `npm ci` | passed; 162 packages; audit reported one existing high vulnerability |
| Panel extension build against completed local BokehJS source | passed |
| full `tsc --noEmit --pretty false` | passed |
| ESLint | passed with 0 errors and 261 pre-existing warnings |

On a clean Panel build, the build bootstrap initially replaced the local
BokehJS symlink with the published npm development package. That published
snapshot lacked APIs present at the completed Bokeh tip. Restoring the local
completed-source link after build metadata generation produced the passing
independent build and avoids misclassifying package drift as a patch failure.

### Browser validation

Playwright used locally available Chrome and failed on unexpected console
errors. It exercised two-root static output, a three-root direct Panel server
session, and Panel autoload output. Final observation:

```json
{"server":{"autoload":{"after":{"disposed":true,"state":"disposed","views":0},"before":{"session":true,"state":"ready","views":3}},"direct":{"after":{"disposed":true,"state":"disposed","views":0},"before":{"roots":["p1011","p1020","p1021"],"session":true,"views":3}},"errors":[]},"static":{"after":{"disposed":true,"state":"disposed","views":0},"before":{"handles":1,"roots":["root-0","root-1"],"views":2},"errors":[]}}
```

Browser validation found two issues that non-browser checks missed:

- direct `new Tooltip()` had to become `Tooltip.create()`;
- Panel's host-owned resource bundle had to include `bokeh-api` so
  `Bokeh.mount_artifact_declaration()` exists.

### Environment-limited release checks

Not run: the full Panel suite, full Sphinx/docs/JupyterLite build, hosted
classic Notebook/JupyterLab/VS Code/Colab UI, Django, FastAPI, and
Pyodide/PyScript browser matrices. The 77 skipped cases correspond to optional
dependencies/integrations and are not claimed as coverage. npm audit findings
were observed but are pre-existing dependency-tree issues outside this patch.

All project Git, Python, Node, test, and build commands used the required
`bokeh-embed` Conda environment. No editable install, push, PR, or GitHub
mutation occurred.
