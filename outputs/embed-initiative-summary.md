/Users/bryan/.zlogin:9: nice(5) failed: operation not permitted
# Initiative summary: coherent embedding across Python, BokehJS, docs, frameworks, and notebooks

## Proposed initiative

Replace Bokeh's accumulated embedding paths with one versioned artifact contract, one browser mount/lifecycle API, and one resource resolution model. Use the Bokeh 4.0 breaking-release boundary to retain only useful thin conveniences, remove architecture-shaping legacy machinery, and make Sphinx, JavaScript framework adapters, and Jupyter first-class consumers of the same layers.

The detailed design and full legacy API inventory are in `outputs/embedding-architecture-proposal.md`. The implementation stack and preserved source-task context are in `outputs/embed-stack-context.md`.

## Problem

`components()`, `file_html()`, `json_item()`, `autoload_static()`, server embedding, notebook display, BokehJS `embed_item(s)()`, framework mounts, and the `bokeh-plot` directive were built at different times. Most eventually manufacture some variation of `docs_json` plus `RenderItem`, but resource ownership, DOM targeting, loading, error handling, and disposal differ by path.

Consequences include duplicate schemas, order-sensitive resource loading, weak lifecycle ownership, hard-to-observe failures, random IDs and assets, notebook leaks, and a docs directive that emits a full loader and all BokehJS bundles for every plot. Framework and notebook work risk making this worse if they each stabilize a different lifecycle.

## Outcome

The initiative establishes four shared layers:

1. A Python `EmbedSpec` compiler produces an immutable, versioned `EmbedArtifact` describing standalone or server source, logical roots, resource requirements, metadata, and buffers.
2. Output renderers turn that artifact into a page, typed fragment, JSON, external payload reference, or notebook MIME bundle without changing its meaning.
3. BokehJS `mount()` accepts models/documents or artifacts, caller-owned keyed targets, and a resource resolver, and returns a `BokehMount` with readiness, errors, root access, session ownership, and idempotent disposal.
4. A promise-based resource loader deduplicates exact requirements and separates required components from CDN/inline/server/relative/host-owned policy.

Minimal model IDs become the default for static artifacts while live server, patch, comm, and notebook boundaries retain protocol-required IDs. React, Vue, Angular, Web Components, Sphinx, and Jupyter become adapters/consumers of the same runtime rather than alternate embedding implementations.

## User-visible Bokeh 4.0 migration

- Keep `file_html()`, `components()`, `save()`, and `show()` when they remain useful facades, and route them through the shared compiler/runtime.
- Keep any other adapter only when it is clean, isolated, cheap, and unable to constrain the new artifact, resource, mount, or lifecycle contracts.
- Remove `JsonItem`, `RenderItem`, per-embed autoload programs, wrapping flags, and notebook-private rendering machinery when a shim would preserve duplicate architecture. Prefer an explicit 4.0 migration error to a misleading compatibility layer.
- Map server-document and existing-session use cases to a server-source artifact. Retain familiar functions only if their complete semantics, including selective roots, reduce cleanly to that source.
- Do not promise a one- or two-major-release compatibility window for 3.x envelopes. `EmbedArtifact` receives independent, explicit schema-version rules.
- Provide a before/after cookbook for every supported use case: complete pages, template fragments, named multi-root layouts, fetched JSON, external static payloads, new/existing server sessions, framework roots, static/live notebooks, custom templates, custom extensions, and host-owned resources.

## Primary in-tree success case: documentation builds

Change `bokeh-plot` from a per-plot autoload generator into an explicit output-capture and page-aggregation pipeline. A page with plots receives one page artifact/payload, one lightweight bootstrap, and each actually required bundle once. A page without plots receives no BokehJS. Generated names are deterministic, incremental and parallel builds are supported, stale assets are tracked, and non-HTML builders receive an accessible fallback.

This makes the docs build both a major performance win and the strongest static integration test for the new artifact/resource architecture.

## Notebook and framework alignment

The existing framework work provides the core `mount()`/`BokehMount` direction and adapters. It should land first and be extended with artifact sources, keyed targets, explicit ownership, readiness/errors, and selective shared-document root lifecycle.

Jupyter follows the common artifact/runtime work. Static display, live handles, server apps, Colab, AnyWidget, marimo, saved output, and export remain supported, but notebook code owns only host integration and transport. The latest review's cleanup, bounded-history, source-test, export-safety, concurrency, and test-matrix blockers are explicit initiative deliverables rather than follow-up debt.

Panel is the final downstream validation layer. The completed audit pinned Panel
at `be0b5e2b0955a38a8871aa3fc1703b57c76c1e81` and produced an applicable
35-file migration diff. Static HTML, templates, protocol-full state replay,
notebook initial display, Tornado server pages/autoload compatibility, BokehJS
4 extension APIs, readiness/errors, and mount disposal are mapped to the common
stack. Pyodide/PyScript is explicitly rejected until its transport is rewritten;
no Bokeh legacy envelope was restored for Panel.

The audit also corrected earlier assumptions: token-bearing server artifacts and
declarative mount observability already exist. Remaining reusable gaps are
payload-level satisfaction of host-owned extensions, a public protocol-2 seam
for third-party notebook hosts, and a public owning loop/scheduler on
`ServerContext`.

## Delivery stack

```text
EMBED 00  Contract, fixtures, coordination, and verification
EMBED 01 Lifecycle-aware BokehJS model factories and rollback
EMBED 02  BokehJS mount lifecycle and framework adapters
EMBED 03  Minimal IDs integrated with lifecycle-safe construction
EMBED 04  Artifact compiler, renderers, resource resolver/loader, retained facades and migration errors
EMBED 05  Sphinx and bokeh-plot page aggregation
EMBED 06  Jupyter and notebook host adapters
EMBED 07  Panel downstream impact assessment and patch proposal
```

The branches are intentionally stackable in that order. Lifecycle-aware model construction is a factored prerequisite for framework mounting, which precedes minimal-ID conflict resolution; all three precede the artifact/runtime that consumes them. Sphinx is the first production static consumer. Jupyter validates the most demanding live-host cases. Panel runs last as a downstream compatibility audit against the completed design.

## Testing expectations

Treat cross-language fixtures and host lifecycle tests as part of the design, not cleanup. Required coverage includes schema compatibility and errors, anonymous/shared/cyclic graphs, keyed multi-root and shared-document mounting, sequential/concurrent additive resource loading, disposal and rollback leak tests, every retained facade and 4.0 migration diagnostic, page-level docs resource/request budgets, notebook output replacement and virtualization, bounded patch buffers, comm failures/timeouts, renderer rerender/disposal, trust/removal, safe and concurrent exports, and explicitly executed AnyWidget/marimo CI jobs.

All eight tasks run project commands through `/Users/bryan/anaconda3/bin/conda run -n bokeh-embed ...`. Python tests use `python -m pytest -o pythonpath=src ...` after verifying the import path; the shared environment must not be repointed with an editable install.

## Definition of done

- All currently supported embedding use cases have a tested 4.0 route through the shared layers, a useful thin facade, or an explicit migration recipe/error.
- Static and live ID policies are explicit and cross-language tested.
- Frameworks, docs, and Jupyter use the same mount/lifecycle and resource contracts.
- The docs no longer ship all BokehJS bundles for each directive and enforce page budgets.
- Bokeh 4.0 removes legacy envelopes and return-shape machinery that would distort the shared design while providing clear replacements for their use cases.
- Panel has an evidence-backed, applicable downstream patch and validation matrix against the completed stack; its remaining WASM and optional-host work is explicitly bounded rather than reported as supported.
- The replacement branch stack has recorded ancestry, range-diff/equivalence, conflict resolution, branch-local test results, and task/worktree mapping before old Codex tasks or source branches are removed.
