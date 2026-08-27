# EMBED replacement stack verification

This report is completed as branches and replacement tasks evolve. It supplements the verification protocol in `outputs/embed-stack-context.md`. The 2026-09-01 recovered-stack section is current. Later sections preserve the earlier replay and publication evidence as historical context. A parent commit cannot stably record the final SHAs of its own descendants, so the coordinator handoff and live PR readback remain authoritative for the final rewritten tips.

## 2026-09-01 recovered-stack rebase

The recovered EMBED 00–08 stack is being replayed sequentially onto the fetched
`bryevdv/branch-4.0` tip
`76cdca4f973e1bc1e0e18c3491afb9e8524d8e55`. The source stack was clean, its
adjacent ancestry was exact, and every local source tip matched its fork remote
tracking ref before the replay. Immutable source refs live under
`refs/codex/embed-stack-pre-rebase-20260901/`:

| Layer | Source tip | Recovered task | Worktree |
|---|---|---|---|
| EMBED 00 | `37a00df2422caec273fe6d31ef279c5d1655a857` | `01a05f16-6155-76d1-ba26-87a7a0deb308` | `/Users/bryan/work/trees/36a5/bokeh-embed` |
| EMBED 01 | `cd0f54573c78c51f78ae8698f787ff8de1c1855f` | `01a05f16-69d3-7600-abc2-265c576d0fc5` | `/Users/bryan/work/trees/60ba/bokeh-embed` |
| EMBED 02 | `3d94c5a34eb1f964b0bdb475539a1ba31b7ead62` | `01a05f16-72d0-7031-bbb2-40114ac8cf21` | `/Users/bryan/work/trees/77d5/bokeh-embed` |
| EMBED 03 | `890181aa712d737269748efa5f6667e64dd0e0a0` | `01a05f16-7a79-7cd3-b96c-9125b141456d` | `/Users/bryan/work/trees/2ece/bokeh-embed` |
| EMBED 04 | `28736cabafd90201b115d27fc34ecb5e4c7bc1c2` | `01a05f16-8a7c-7f81-8b70-89e1627c3121` | `/Users/bryan/work/trees/6c53/bokeh-embed` |
| EMBED 05 | `167e75b03e4111ee5f74a1e51e1f262671698531` | `01a05f16-8209-7b23-b25d-c8c255cdc31e` | `/Users/bryan/work/trees/c488/bokeh-embed` |
| EMBED 06 | `9117e083f53cea7ba488c671ffc9cda1794f5709` | `01a05f16-9154-7991-84cd-a89dec22093a` | `/Users/bryan/work/trees/166b/bokeh-embed` |
| EMBED 07 | `ccdb06b46463a3603e0e66abcb4313cab76ed6b5` | `01a05f16-97ea-74e1-880c-c9080e002238` | `/Users/bryan/work/trees/90af/bokeh-embed` |
| EMBED 08 | `14283682994f881f39de8c0f30723eeef4252a5a` | `01a05f16-a0f0-7c01-9470-af5c8c686193` | `/Users/bryan/work/trees/502b/bokeh-embed` |

### EMBED 05/06 semantic order correction

The recovered source stack originally placed Sphinx before Jupyter. The final
review order instead makes Jupyter EMBED 05, directly on EMBED 04, and makes
Sphinx EMBED 06 so its output-capture hooks target Jupyter's final `show()`,
`save()`, and `output_file()` APIs. Existing remote branch names are preserved
to preserve the published branch identities; their numeric prefixes therefore
remain opposite to their semantic task numbers.

| Semantic layer | Responsibility | Preserved remote branch | Recovered task | Parent | Reordered tip |
|---|---|---|---|---|---|
| EMBED 05 | Jupyter and notebook hosts | `codex/embed-06-jupyter` | `01a05f16-9154-7991-84cd-a89dec22093a` | EMBED 04 | `0b5bfbf11c914d5045afce512c3c2e7dbdeb924f` |
| EMBED 06 | Sphinx and `bokeh-embed` | `codex/embed-05-sphinx` | `01a05f16-8209-7b23-b25d-c8c255cdc31e` | EMBED 05 | `15c0e7824f39eff22117823dd9855043895d049a` |
| EMBED 07 | global view-index cleanup | `codex/embed-07-view-index-cleanup` | `01a05f16-97ea-74e1-880c-c9080e002238` | EMBED 06 | `20ea756f3f13d6c8ac6c8c6d5949b465eaefc065` |

The reordered EMBED 06 tree is byte-for-byte identical to the pre-swap
combined Sphinx-plus-Jupyter tree. Immutable pre-swap refs live under
`refs/codex/embed-stack-pre-05-06-swap-20260901/`.

Open draft demonstration PRs map EMBED 01–04 to
[#2](https://github.com/bryevdv/bokeh/pull/2) through
[#5](https://github.com/bryevdv/bokeh/pull/5), EMBED 05 to
[#11](https://github.com/bryevdv/bokeh/pull/11), EMBED 06 to
[#6](https://github.com/bryevdv/bokeh/pull/6), and EMBED 07 to
[#10](https://github.com/bryevdv/bokeh/pull/10). EMBED 00 and EMBED 08 are
supporting stack branches without open PRs.

GitHub automatically closed and marked the former Jupyter PR
[#7](https://github.com/bryevdv/bokeh/pull/7) merged when the reorder made its
head an ancestor of its pre-reorder Sphinx base. This did not move
`branch-4.0`, which remained at
`76cdca4f973e1bc1e0e18c3491afb9e8524d8e55`. Replacement PR #11 preserves the
Jupyter review diff, and the seven open drafts are linked in corrected order as
GitHub stack #12.

The current repository workflow is the committed `pixi.toml`/`pixi.lock`
environment. Each fresh recovered worktree runs `pixi run --locked setup`
after it inherits those files from the new base and before project tests or
builds. The replay must preserve each layer's reviewable commit range, pass a
range-diff and `git diff --check`, preserve exact adjacent ancestry, audit all
outgoing full commit messages for an exact `checkpoint`, and publish the nine
branches atomically to `github.com/bryevdv/bokeh` with exact remote leases.
Final rewritten branch and PR tips, test evidence, and remote readback belong in
the coordinator handoff because recording descendant SHAs here would change
their parent and invalidate those same SHAs.

## Historical 2026-08-27 source-stack restack

## Source baselines

| Source | Tip | Status |
|---|---|---|
| `branch-4.0` | `ae1c4bc298c16f0c375fc0ea88392351200b55f7` | latest `bryevdv/bokeh` tip after the 2026-08-27 upstream sync |
| `bokehjs-framework-integration` | `25d555da5b3919a8b70bc3e40fa991840f1be0e5` | recorded and retained |
| `minimal-ids` | `4b54c421bc747a42a802c70093aaa8f6c5fc9bab` | recorded and retained |
| `poc/jupyter-integration-4.0` | `00136fe8f59b6f2498efcacd7012ea6b19d97a32` | recorded and retained |

## Branch and task mapping

| Task | Task ID | Branch | Parent | Worktree | Current reviewed state |
|---|---|---|---|---|---|
| EMBED 00 | `01a0211a-448a-74f2-a484-edd558f855af` | `codex/embed-00-contract` | `branch-4.0` | `/Users/bryan/work/trees/53c9/bokeh-embed` | clean tip `37a00df2422c`; eight coordination/review commits |
| EMBED 01 | `01a024dc-64df-7d10-9de5-f37814af9441` | `codex/embed-01-model-factories` | `codex/embed-00-contract` | `/Users/bryan/work/trees/780c/bokeh-embed` | clean tip `cd0f54573c78`; six reviewable commits |
| EMBED 02 | `01a0211a-4486-7e82-bba7-9d282d76fa5c` | `codex/embed-02-mount-frameworks` | `codex/embed-01-model-factories` | `/Users/bryan/work/trees/623b/bokeh-embed` | clean tip `3d94c5a34eb1`; 19 reviewable commits |
| EMBED 03 | `01a0211a-4488-7df0-bfa7-5c22b4c971dc` | `codex/embed-03-minimal-ids` | `codex/embed-02-mount-frameworks` | `/Users/bryan/work/trees/0014/bokeh-embed` | clean tip `890181aa712d`; nine reviewable commits |
| EMBED 04 | `01a0211a-4484-7940-9c23-bdf06ed1ea90` | `codex/embed-04-artifact-runtime` | `codex/embed-03-minimal-ids` | `/Users/bryan/work/trees/feaa/bokeh-embed` | clean tip `28736cabafd9`; 13 reviewable commits |
| EMBED 05 | `01a0211a-448c-7972-a2f4-a520c273bb1b` | `codex/embed-05-sphinx` | `codex/embed-04-artifact-runtime` | `/Users/bryan/work/trees/1395/bokeh-embed` | clean tip `167e75b03e41`; seven reviewable commits |
| EMBED 06 | `01a0211a-4485-7252-bac5-69f9c48ab768` | `codex/embed-06-jupyter` | `codex/embed-05-sphinx` | `/Users/bryan/work/trees/ad10/bokeh-embed` | clean tip `9117e083f53c`; ten reviewable commits |
| EMBED 07 | coordination handoff | `codex/embed-07-view-index-cleanup` | `codex/embed-06-jupyter` | `/Users/bryan/work/trees/4840/bokeh-embed` | clean tip `ccdb06b46463`; four reviewable commits |
| EMBED 08 | `01a02132-f4ed-7d20-a67c-0db3e4478ef6` | `codex/embed-08-panel` | `codex/embed-07-view-index-cleanup` | `/Users/bryan/work/trees/e94b/bokeh-embed` | six-commit assessment/patch/verification series; final tip reported at handoff |

The reusable coordination worktree `/Users/bryan/work/trees/bokeh-embed` is
detached after each branch is returned to its task worktree and owns no stack
branch at handoff.

## Dedicated environment

Every project command on all nine tasks uses:

```text
/Users/bryan/anaconda3/bin/conda run -n bokeh-embed ...
```

The environment came from `conda/environment-test-3.13.yml` and contains Python 3.13.15, Node.js 24.19.0, npm 11.17.0, and pytest 9.1.1. Its installed local Bokeh 4.0 proof-of-concept wheel is distribution metadata/static baseline only. Do not run `pip install -e` against any task. Before consequential Python validation, verify the imported Bokeh path; from a task root use `python -m pytest -o pythonpath=src ...`.

## Replay/equivalence audit

| Branch | Source comparison | Result | Notes |
|---|---|---|---|
| 01 + 02 | framework source range | passed | All ten source commits are accounted for. Factory/rollback/enforcement hunks were extracted into three prerequisite commits; mount/framework work was reshaped into 12 reviewable commits. The combined final tree equals the validated pre-split replay outside coordination outputs. |
| 03 | minimal-ID source range | passed | All six source commits are accounted for; only documented lifecycle-aware semantic conflict resolutions differ. |
| 06 | Jupyter source range | replay accounted for; replacement complete | All ten source commits are represented. The review series deliberately replaces the source POC's private document/render lifecycle with EMBED 04/05 artifacts, resource policies, and mounts; the blocker-by-blocker disposition is in `embed-stack-context.md`. |

## Ancestry and hygiene

| Check | Result |
|---|---|
| Every adjacent branch is an ancestor of the next | passed after the 2026-08-27 `branch-4.0` restack |
| `git diff --check` for every branch range | passed after the 2026-08-27 `branch-4.0` restack |
| No accidental wheel/build output committed | passed: no wheel, egg-info, distribution, or generated `frontend/build` tree; packaged Jupyter labextension static files belong to the preserved source POC |
| Source branches retained | passed |
| Old tasks retained until audit complete | required; no deletion authorized |

## Branch-local validation

| Branch | Required validation | Result |
|---|---|---|
| 00 | Markdown/context audit, source-tip verification, environment-policy check | passed; task-local import path and the four durable Markdown files verified |
| 01 | BokehJS lifecycle-aware construction, rollback, protected constructors, call-site migration, build/lint/focused units | passed: library build and lint plus 98 focused construction/deserialization/lifecycle tests; the synced upstream test additions use `.create()` consistently |
| 02 | lifecycle core tests; React/Vue/Angular/Web Component fixtures; docs/type/package checks | passed: core mount units 19/19, all focused lint targets, and the full framework package/runtime suite including the #15305 public examples plus a dedicated test-only packed Angular lifecycle contract; readiness now also observes document idle |
| 03 | 02 smoke tests plus Python/BokehJS minimal-ID and cross-language round trips | completion suite passed; see the detailed EMBED 03 evidence below |
| 04 | schema fixtures, Python compiler/renderers, BokehJS mount/loader, retained-facade and migration matrix | passed; see the detailed EMBED 04 evidence below |
| 05 | Sphinx unit tests, incremental/parallel/full docs builds, browser tests, size/request budgets | passed; see the detailed EMBED 05 evidence below |
| 06 | source frontend units, packaged-runtime tests, notebook Python/protocol tests, AnyWidget/marimo CI, Playwright, common mount smoke | passed; see the detailed EMBED 06 evidence below |
| 07 | remove global view/document registries and migrate discovery/export/docs to target-local mounts | reviewed at `ccdb06b46463a3603e0e66abcb4313cab76ed6b5`; framework tests use mount-local `view_lookup`; exact ancestry verified by EMBED 08 |
| 08 | Panel impact inventory, Bokeh 4.0 workflow mapping, applicable diff, focused and browser downstream validation | complete against Panel `be0b5e2b0955a38a8871aa3fc1703b57c76c1e81`; applicable 45-file patch, 137 focused passes/77 optional skips, extension/TypeScript/lint/build checks, and static/server/autoload browser lifecycle probes |

### 2026-08-27 `branch-4.0` sync validation

The fork base advanced by fast-forward from
`e40959e7da00157ff732a82e0bd428889c18e471` to
`ae1c4bc298c16f0c375fc0ea88392351200b55f7`. EMBED 00–08 were replayed in
order, with every source branch retained and a safety ref at
`backup/embed-stack-pre-branch4-sync-20260827`. Conflicts were resolved at the
owning layer: EMBED 01 adapted new upstream tests to model factories; EMBED 02
aligned mount readiness with document idle; EMBED 04 adopted current ASGI and
Tornado lifecycle signatures and kept decoder-owned dynamic-model payloads
opaque to the artifact reference pre-scan; EMBED 06 adopted protocol message
factories; and EMBED 07 moved framework discovery to the mount-local view
lookup.

Validation used only the `bokeh-embed` environment and the task checkout's
source; no editable install was made:

| Validation | Result |
|---|---|
| Clean BokehJS build | passed: library, compiler, examples, and framework packages |
| BokehJS lint | passed: library, unit tests, and framework tests |
| Full BokehJS unit suite | 2,383 passed, 5 skipped, 0 failed; Chrome 152 ran despite the runner's Chrome 141 support warning |
| Full framework matrix | passed: React, Vue, Svelte, Web Component, Angular, Vite, Rspack, Webpack, Node SSR, lifecycle, type, and bundle-budget checks |
| Focused cross-language Python suite | 123 passed; import resolved to this checkout's `src/bokeh/__init__.py` |
| Python import sorting | passed after the EMBED 04 resource imports were normalized in their owning commit |
| Stack ancestry and whitespace | every adjacent ancestor check and the full-stack `git diff --check` passed |

### 2026-08-22 goal review and ownership pass

The sequential review added public documentation/docstrings, task-aligned
negative tests, and core-review examples without broadening task ownership:

| Branch | New focused evidence | Review result |
|---|---|---|
| 00 | Markdown/diff checks | disjoint task goals and ownership moves recorded |
| 01 | BokehJS library build; 52 focused factory/view/serialization browser tests | construction phases, reverse rollback, and earliest view failure documented/tested |
| 02 | framework build; framework ESLint; 25 plotting/mount browser tests | mount ownership, readiness, disposal, and adapter contracts documented |
| 03 | 7 Python minimal-ID tests; 5 cross-language browser tests | shared mapping references and non-expanding extra-ID boundary added |
| 04 | 18 Python artifact tests; 20 artifact-runtime browser tests | resource union/fingerprint code moved here; compiler/renderers/policies documented with a multi-renderer tour |
| 05 | 21 Sphinx unit tests | quick/non-HTML fallback and incremental no-embed cleanup strengthened; runnable two-file fixture documented |
| 06 | 3 Python notebook compiler tests; 4 BokehJS patch tests; 16 frontend Vitest tests | failed patches cannot advance revision; comm/reconnect/release boundary and reviewer walkthrough documented |
| 07 | 75 focused BokehJS browser tests | removed exports and two-mount `CustomJS` isolation tested; external two-mount discovery migration documented |
| 08 | Markdown/diff checks plus preserved downstream matrix above | reviewer map and current reviewed branch/test ledger added; Panel patch itself unchanged |

The invalid EMBED 06 Python command started from `bokehjs/` and resolved the
installed wheel; it is excluded from evidence. Its immediate rerun from the
repository root resolved `src/bokeh/__init__.py` and passed.

The earlier EMBED 03 `dev313` run that failed five tests imported an editable primary checkout. It is classified as wrong-source contamination, not a branch failure. The clean 129/129 result above is the valid branch evidence.

## EMBED 06 Jupyter host decisions and evidence

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
downstream propagation decisions are recorded in this section and the Jupyter
sections of `outputs/embed-stack-context.md`.

## EMBED 05 Sphinx consumer decisions and evidence

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

Review series introduced by EMBED 05:

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
the 9,337,415-byte data-payload high-water mark are preserved here as the
durable Sphinx measurement record.

Cross-layer decisions for EMBED 00/06/07 to propagate:

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

## EMBED 04 embedding compiler and delivery decisions

The branch implements one immutable `bokeh.embed/v1` envelope in Python and
BokehJS, graph-minimal standalone compilation, structural logical roots,
server-source bootstrap, typed output renderers, exact standalone requirements,
conservative dynamic server requirements, resource policies, and a deterministic
promise registry. Artifact decoding feeds EMBED 02's `MountSource` and
`BokehMount`; repeated/early/failing mounts use that lifecycle's rollback and
idempotent disposal.

The shared fixture at
`bokehjs/test/unit/embed/artifact_fixtures.json` is read directly by Python and
BokehJS tests. It covers keyed standalone roots without forced IDs, metadata,
server source fields and selected roots, resource manifests,
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

Payload/build measurements, schema and lifecycle decisions, the resource
policy, and the migration matrix are recorded in this section and the EMBED 04
implementation record in `outputs/embedding-architecture-proposal.md`.

## EMBED 03 minimal-ID decisions and evidence

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

`Document.to_json()` remains canonical and ID-full in both runtimes. The new `Document.to_static_json()` is the explicit low-level compiler seam: it uses graph-minimal IDs and accepts an additional externally referenced model set without changing canonical or patch/session behavior. Static roots are described by logical key plus document/root ordinal in the shared fixture, then resolved into EMBED 02's keyed `MountSource`; roots do not retain IDs merely for DOM mounting. The legacy standalone bridge calls the same seam but temporarily requests root IDs because `RenderItem` still requires them; EMBED 04 must not inherit that compatibility requirement.

The single fixture payload in `bokehjs/test/unit/document/minimal_ids_fixture.json` is consumed directly by both Python and BokehJS tests. It covers anonymous models, shared identity, a two-model cycle, deterministic map/root order, two logical root keys, Python serialization, Python and BokehJS deserialization, keyed `MountSource` normalization, canonical serialization, and live patch IDs.

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

Payload sizes, ID counts, repeated determinism, and equivalent-rebuild behavior
were recorded during the branch validation summarized above. The line-plot
measurement confirms that graph-required IDs may remain allocation-dependent
across equivalent rebuilds; EMBED 04 therefore derives artifact/build
fingerprints from normalized source and options rather than raw retained model
IDs.

Cross-layer decisions for EMBED 00/04 to propagate:

- the artifact root descriptor is structural (`key`, document ordinal, root ordinal), not a mandatory model-ID reference;
- the artifact compiler calls `Document.to_static_json()` and supplies extra ID-bearing models only for an actual external protocol reference;
- canonical documents, server/session state, patches, comms, and live notebook transports use ID-full serialization;
- the artifact decoder resolves structural roots after deserialization and constructs the existing keyed `MountSource`/`BokehMount` lifecycle;
- deterministic artifact/build identity must be computed independently of allocation-dependent graph-required IDs.

## EMBED 02 lifecycle decisions and evidence

- The public runtime input is `MountSource`, containing one document, keyed
  logical roots, and document ownership. Serialized `EmbedArtifact` decoding,
  resource loading, and server sessions remain EMBED 04 responsibilities and
  must feed this seam and the existing `BokehMount`, not create another handle.
- Initial `ready` includes target resolution plus construction and readiness of
  selected root views. Unselected roots in a shared document do not block it;
  each later `attach()` is independently awaitable.
- Targets are caller-owned, views are mount-owned, and document ownership is
  explicit. Selective detach and target replacement preserve the shared
  document and sibling roots. Disposal is synchronous in its DOM/model cleanup,
  returns an awaitable completion promise, and is idempotent.
- Structured errors currently cover source, target, render, abort, and early
  disposal failures with logical root keys where applicable. EMBED 04 extends
  the vocabulary for decode, resource, HTTP, WebSocket, and session failures.
- Focused DOM units exercise readiness, keyed/multi-root placement, shared
  caller documents, selective detach/reattach, target replacement, dynamic root
  add/remove failures, abort/supersession, failure rollback, global-index
  cleanup, and repeated disposal.
- The test-only framework fixtures use the shared base controller for error, callback
  rollback, exact-once disposal, and selective lifecycle assertions. React,
  Vue, Svelte, and Web Component production and development fixtures run the
  complete shared contract. The packed Angular fixture independently exercises
  linked roots in separate Angular-owned targets, native-control updates,
  selective detach/reattach, provider unmount/remount, structured target-error
  rollback, and exact-once final disposal. All packages build from packed npm
  artifacts and stay within their bundle budgets.

The original ten source commits remain fully accounted for. Their factory and
rollback hunks were extracted into EMBED 01, and EMBED 02 was first rewritten
into 12 concern-focused mount/framework commits above that prerequisite. That
12-commit tree is exact against the validated pre-split replay. Six subsequent
review commits bring the branch to 18 commits total; the latest restores PR
#15305's user-facing Angular example and example index byte-for-byte while
moving only lifecycle instrumentation to a test-only packed application. The
public example is simpler without reducing browser coverage.

### Lifecycle-aware factory extraction boundary

EMBED 00 has no dependency on the lifecycle-aware model factory. The completed
prerequisite therefore sits immediately after EMBED 00 and before EMBED 02. It
was hunk-split from three interleaved source commits:

- `ef43625b05` (`Add BokehJS lifecycle and framework integration`, 470 files)
  contains the start of the prerequisite: `HasProps.create()`, the guarded
  construction stack, explicit property/initialization/signal lifecycle states,
  deferred construction for deserialization, failure cleanup, and the first
  broad conversion from direct model constructors to lifecycle-aware factories.
  The same commit also introduces the mount runtime, adapters, fixtures,
  package/lockfile changes, and generated baselines that belong to EMBED 02.
- `69a69c749b` (`Harden lifecycle cleanup and deserialization rollback`, 16
  files) is the second prerequisite slice. Its `has_props.ts`, deserializer,
  document, and general view-construction changes make destruction idempotent
  and make failed construction/deserialization/view initialization reversible.
  Its `api/io.ts` and `embed/*` hunks are mount-specific and remain EMBED 02.
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
and `embed/*` work remains in EMBED 02.

### Recorded EMBED 02 commands

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
and evidence in `outputs/embed-stack-context.md` and the EMBED 06 evidence
above. Hosted Colab browser automation is
the only environment-limited check; the exact production static and connected
adapter contracts are unit-tested and the documentation labels the hosted
smoke test as pending rather than claiming it passed.

EMBED 08 was rerun against the completed EMBED 01–07 Python and BokehJS APIs.
Its reviewed exact parent is
`ccdb06b46463a3603e0e66abcb4313cab76ed6b5`. The earlier
Panel assessment remains provenance only. Final evidence includes removal of
`Bokeh.index`, `Bokeh.documents`, and public global view-manager discovery.

## Bokeh 4.0 compatibility evidence

Every 3.x embedding use case must have a tested 4.0 route and migration recipe. Familiar APIs are retained only as useful thin facades; any other adapter must be isolated, cheap, and architecture-neutral. There is no promised one- or two-major compatibility window for `JsonItem`, `RenderItem`, autoload programs, wrapping flags, or notebook-private rendering machinery.

## Panel downstream inspection

| Evidence | Result |
|---|---|
| Local checkout preference | no Panel checkout found under `/Users/bryan/work` |
| Authoritative source | disposable shallow clone of `https://github.com/holoviz/panel.git`; independent clean snapshots used for apply/test validation; no user checkout or GitHub mutation |
| Revision | `be0b5e2b0955a38a8871aa3fc1703b57c76c1e81`, `main`, 2026-08-20, `Make Tabulator edits more robust (#8731)` |
| Panel version boundary at revision | Panel JS `1.9.4`; Python `bokeh >=3.7,<3.10`; JavaScript `@bokeh/bokehjs ^3.9.2` |
| Completed API inspection | Python `embed`, `embed_server`, `notebook_content(live=True)`, artifact renderers/resource policies and mount-aware export; BokehJS `mount`, `when_mounted`, target `bokehMount`, `BokehMount` root/view/target/document/session/view-lookup access, attach/detach/dispose; EMBED 06 protocol-2 and `StandaloneMount`; EMBED 07 global-registry removal |
| Downstream inventory | static HTML/state/PNG, templates and multi-root placement, notebook/PyViz/Jupyter preview, Panel Tornado/Django/FastAPI server paths, Pyodide/PyScript conversion, custom extension resources, React/ReactiveESM/AnyWidget models, disposal, docs/Sphinx/JupyterLite, packaging, and CI |
| Applicable diff | `outputs/panel-bokeh-4.0.patch`; SHA-256 `e6a8e70fb31fc21e22801c66895a0a97b37f3aca77d6bccd0bfb247ec79122fd`; 45 files, 657 insertions, 631 deletions; clean independent `git apply --check`, apply, and `git diff --check` |
| Draft boundary | Python `bokeh >=4.0.0.dev1,<4.1.0`; JavaScript `@bokeh/bokehjs ^4.0.0-dev.1`; intended for a breaking Panel line, not Panel 1.9 maintenance |
| Explicit residual | Bokeh 4 Pyodide/PyScript conversion raises a targeted migration error until its RenderItem/JsonItem worker transport becomes artifact/mount based; no Bokeh 3 compatibility branch remains |
| Runtime import | Bokeh `/Users/bryan/work/trees/e94b/bokeh-embed/src/bokeh/__init__.py`, `4.0.0.dev1+42.ga6485cdf`; Panel imported from each disposable patched snapshot using temporary dependency files, without an editable install |

Final source evidence corrected the conceptual gap list:

- `embed_server(token=..., roots=...)` already supports an existing session;
- `mount_artifact_declaration()` already exposes its handle as
  `target.bokehMount`;
- `Bokeh.when_mounted(target, {signal})`, retained handles, `root()`/`view()`/
  `target()`, `root_keys`, `document`, and `view_lookup` replace global view
  discovery; semantic names and explicit `CustomJS.args` replace model-ID
  searches;
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

## EMBED 08 validation evidence

### Worktree and history

- worktree: `/Users/bryan/work/trees/e94b/bokeh-embed`;
- branch: `codex/embed-08-panel`;
- exact parent: `codex/embed-07-view-index-cleanup` at
  `ccdb06b46463a3603e0e66abcb4313cab76ed6b5`;
- parent is based on EMBED 06 at
  `9117e083f53cea7ba488c671ffc9cda1794f5709`;
- pre-restack Panel series retained as
  `backup/embed-08-panel-pre-view-index-7378a1fd31`;
- final tip and coherent assessment/patch/validation commits are reported at
  handoff because the verification commit cannot contain its own SHA.

### Patch applicability

An independent clean Panel clone at the pinned revision passed:

- `git apply --check outputs/panel-bokeh-4.0.patch`;
- `git apply outputs/panel-bokeh-4.0.patch`;
- `git diff --check`.

The final hygiene pass normalized 136 patch-file lines containing only a
unified-diff context-prefix space to empty lines. This changes outer EMBED
additions from `+ ` to `+` without changing meaningful indentation or Panel
content. The independently applied tree passed the same checks at patch
SHA-256 `e6a8e70fb31fc21e22801c66895a0a97b37f3aca77d6bccd0bfb247ec79122fd`.

Generated Panel distribution/vendor assets and a final-source BokehJS build
were supplied only inside disposable validation directories. No user Panel
checkout was created or modified.

### Python validation

| Check | Result |
|---|---|
| Bokeh import | exact worktree path and `4.0.0.dev1+42.ga6485cdf` |
| Panel import | exact independent temporary patched checkout; `panel.command` also imported |
| Ruff over all `panel` | passed |
| `python -m compileall -q panel` | passed |
| final affected suite: artifact/converter/save/notebook/state/server | 137 passed, 77 skipped in 29.49s |
| independent applied-snapshot converter migration test | 1 passed in 0.02s |

Initial save/notebook fixture runs failed because generated BokehJS/Panel
distribution and vendor assets were absent from the clean source snapshot.
After supplying those normal generated assets in the disposable validation
tree, the same tests passed. The first browser server launch exposed a genuine
import-time `RenderItem` dependency in `panel/io/convert.py`; removing that dead
Bokeh 3 implementation from the Bokeh 4-only path fixed `panel.command` and
`panel serve` startup and added an explicit converter-boundary test.

### JavaScript/build validation

| Check | Result |
|---|---|
| completed final BokehJS library build | passed |
| completed final BokehJS full build | passed |
| Panel extension compiler against completed local BokehJS source | passed; 85 TypeScript files |
| full `tsc --noEmit --pretty false` | passed |
| ESLint | passed with 0 errors and 261 pre-existing warnings |

On a clean Panel build, the build bootstrap initially replaced the local
BokehJS symlink with the published npm development package. That published
snapshot lacked APIs present at the completed Bokeh tip. Restoring the local
completed-source link after build metadata generation produced the passing
independent build and avoids misclassifying package drift as a patch failure.

### Browser validation

Playwright used headless Chromium and failed on unexpected console errors. It
exercised two-root static output, a direct Panel server session, and Panel
autoload output. Final observation:

```json
{"server":{"autoload":{"after":{"disposed":true,"state":"disposed","unpublished":true},"before":{"errors":0,"session":true,"state":"ready"}},"direct":{"after":{"disposed":true,"state":"disposed","unpublished":true},"before":{"errors":0,"root":true,"session":true,"state":"ready","target":true,"view":true}},"errors":[],"globals":{"documents":false,"index":false,"view_manager":false}},"static":{"after":{"disposed":true,"shared_handle":true,"sibling_state":"disposed","sibling_unpublished":true,"state":"disposed","unpublished":true},"before":{"distinct_handles":1,"document_matches":true,"errors":0,"key":"root-0","root_matches":true,"semantic_name":true,"state":"ready","target_matches":true,"targets":["root-0","root-1"],"view_matches":true},"errors":[],"globals":{"documents":false,"index":false,"view_manager":false}}}
```

The final browser check additionally proves:

- one shared multi-root handle is published on both targets;
- logical-key root/view/target access, `view_lookup`, and semantic `Model.name`
  lookup succeed;
- direct and DOM-triggered disposal unpublish every target;
- `Bokeh.index`, `Bokeh.documents`, and public `view_manager` are absent.

### Environment-limited release checks

Not run: the full Panel suite beyond the broad affected set, full
Sphinx/docs/JupyterLite build, hosted
classic Notebook/JupyterLab/VS Code/Colab UI, Django, FastAPI, and
Pyodide/PyScript browser matrices. The 77 skipped cases correspond to optional
dependencies/integrations and are not claimed as coverage. npm audit findings
were observed but are pre-existing dependency-tree issues outside this patch.

All project Git, Python, Node, test, and build commands used the required
`bokeh-embed` Conda environment. No editable install, push, PR, or GitHub
mutation occurred.
