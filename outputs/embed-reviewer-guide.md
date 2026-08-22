# Embedding stack reviewer guide

Status: local 2026-08-22 review of EMBED 00–08 after sequential restacking.
This is the shortest path for a core reviewer who wants to understand why the
stack is split this way, what each branch alone promises, and which examples
demonstrate the result.

## The boundary in one page

| Task | One specific goal | Explicitly not owned here |
|---|---|---|
| EMBED 00 | Define and coordinate the cross-language schema, root/resource/lifecycle vocabulary, compatibility policy, fixtures, and verification ledger. | Runtime implementation or a host adapter. |
| EMBED 01 | Make BokehJS model construction lifecycle-safe through `HasProps.create()`, deferred finalization, and exact rollback. | DOM targets, mounts, artifacts, or resources. |
| EMBED 02 | Define `BokehMount` and thin framework adapters over its target, readiness, ownership, attachment, error, and disposal lifecycle. | Static identity policy or artifact/resource compilation. |
| EMBED 03 | Make static serialization graph-minimal while preserving canonical IDs at live protocol boundaries. | Browser mounting, resource delivery, or host behavior. |
| EMBED 04 | Compile and deliver versioned embedding values across Python/BokehJS: renderers, requirements/policy, loading, server source, facades, and migration errors. | Sphinx, notebook, or downstream-host policy. |
| EMBED 05 | Make Sphinx a deterministic per-page consumer of the shared compiler, resources, and mount lifecycle. | A second artifact schema, loader, or view registry. |
| EMBED 06 | Adapt Jupyter hosts to shared artifacts/mounts while owning only MIME, transport, reconnect/release, and export behavior. | Core global-discovery cleanup or another render lifecycle. |
| EMBED 07 | Remove `Bokeh.index`, `Bokeh.documents`, and public global view discovery after all consumers have target-local routes. | New compiler, framework, or notebook features. |
| EMBED 08 | Assess Panel last and propose a Panel-owned Bokeh 4 migration patch against the completed contract. | Restoring Bokeh 3 envelopes or implementing Panel concerns in Bokeh core. |

“Embedding compiler and delivery runtime” is the preferred review name for
EMBED 04. “Artifact” remains the correct name of the immutable
`EmbedArtifact` value, but it is too narrow as a branch label because the task
also owns renderers and resource delivery.

“Mount” is used for the browser act and owning handle that attach a logical
Bokeh value to caller-owned DOM. The term matches the lifecycle distinction
reviewers will recognize from major JavaScript UI systems: create/construct is
not the same operation as attach/mount, and unmount/dispose closes that
ownership. In this stack it has a precise Bokeh meaning rather than referring
to arbitrary DOM insertion.

## Review result by task

### EMBED 00 — contract and coordination

The contract now gives reviewers a ten-minute Python-to-browser path and an
explicit acceptance boundary for every child task. It records the Bokeh 4
breaking-release stance: keep a familiar API only when it is still useful as a
thin facade; otherwise provide a documented new route and an explicit migration
error. Start with `outputs/embedding-architecture-proposal.md`, then use
`outputs/embed-stack-context.md` for task ownership and
`outputs/embed-stack-verification.md` for evidence.

### EMBED 01 — lifecycle-aware factories

The three implementation commits isolate `.create()` before any mount work.
TSDoc now names construct, deferred reference resolution, initialize, and
finalize phases. Tests prove reverse-order deserialization rollback and cleanup
when a view fails at the earliest initialize phase. The extension-author docs
use a real `NewActionTool.create()` example and explicitly destroy it.

Best review paths: `bokehjs/src/lib/core/has_props.ts`,
`bokehjs/src/lib/core/serialization/deserializer.ts`, and the focused
has-props/view/serialization unit suites.

### EMBED 02 — mount lifecycle and frameworks

The public `mount()`/`BokehMount` TSDoc now explains target and document
ownership, immediate handle return, readiness, structured failure, selective
attach/detach/replace, and idempotent disposal. React, Vue, Svelte, Angular,
and Web Component adapters state that they delegate to this common handle.
The public framework examples stay focused on ordinary application code. The
packed-package test matrix overlays private lifecycle controls where deeper
mount, disposal, and rollback assertions are needed.

Best demo: `bokehjs/examples/frameworks`. Best contract test:
`bokehjs/test/unit/api/io.ts`. Best adapter lifecycle fixture:
`bokehjs/test/frameworks/apps/angular/src/main.ts`.

### EMBED 03 — graph-minimal static identities

The serializer comments distinguish graph identity from browser addressing and
live protocol identity. New Python and BokehJS cases cover one shared model
reached both directly and through a mapping, plus the negative rule that an
extra ID request cannot pull an unrelated model into the graph. The embedding
guide includes a runnable canonical-versus-static model-ID count.

Best review paths: `src/bokeh/core/serialization.py`,
`bokehjs/src/lib/core/serialization`, and
`docs/bokeh/source/docs/user_guide/output/embed.rst`.

### EMBED 04 — embedding compiler and delivery runtime

The shared integral-number fingerprint and `ResourceRequirements.union()`
logic is owned here, not by Sphinx. Python docstrings and BokehJS TSDoc cover
the artifact, spec, renderers, policy resolver, asset records, loader, and
structured errors. The user guide explains requirements versus delivery policy
and includes a plot/widget/table tour through page, fragment, JSON, external,
and MIME renderers.

Best review paths: `src/bokeh/embed/artifact.py`,
`src/bokeh/embed/compiler.py`, `src/bokeh/embed/renderers.py`,
`src/bokeh/embed/resources.py`, and `bokehjs/src/lib/embed`.

### EMBED 05 — Sphinx consumer

The directive and `setup()` now document their page-scoped ownership. Comments
mark `bokeh.embed-page/v1` as a docs-private envelope around public
`bokeh.embed/v1`, and mark the generated manifest as cleanup ownership rather
than a host contract. Tests exercise explicit alternate-builder fallback and
an incremental transition from one embed to no embeds. The reference page has
a two-file fixture and expected generated tree for a quick core review.

Best demo: the “Core-review fixture” in
`docs/bokeh/source/docs/reference/sphinxext.rst`.

### EMBED 06 — Jupyter host adapters

Notebook patch TSDoc now specifies consecutive revisions, duplicate replay,
buffer correspondence, snapshot recovery, and the transactional rule that a
failed document patch does not advance revision. The Python compiler docstring
separates the returned artifact/fragment from host-owned resources, comms,
mounts, and release. AnyWidget comments show where bounded pre-render queues,
reconnect snapshots, and abort-driven release belong.

Best demos: the static, connected/reconnect, and export “Core-review
walkthrough” in `docs/bokeh/source/docs/user_guide/output/jupyter.rst`.

### EMBED 07 — target-local discovery cleanup

The public package no longer exposes global `index` or `documents`; public
mount discovery remains. A new test mounts two independent documents and proves
that `CustomJS` receives distinct document-local view lookups. The advanced
BokehJS guide has an explicit migration table and a two-mount example in which
external code runs before either bootstrap, selects stable host targets, and
awaits `Bokeh.when_mounted(target)`.

Best review paths: `bokehjs/src/lib/api/io.ts`,
`bokehjs/src/lib/core/view_manager.ts`, and “Discovering declarative mounts
from page JavaScript” in
`docs/bokeh/source/docs/user_guide/advanced/bokehjs.rst`.

### EMBED 08 — Panel downstream assessment

The assessment pins Panel at
`be0b5e2b0955a38a8871aa3fc1703b57c76c1e81` and supplies an unchanged 45-file
patch. It maps static/template output, connected notebooks, direct server
pages, Panel-owned autoload, components, resources, export, disposal, and WASM
boundaries to the final Bokeh APIs. It intentionally proposes a Panel 2/Bokeh
4-only line instead of dual-version branches.

Review `outputs/panel-impact-assessment.md` first, then
`outputs/panel-bokeh-4.0-patch-proposal.md`. From a clean checkout at the pinned
Panel SHA, the mechanical entry point is:

```bash
git apply --check /absolute/path/to/outputs/panel-bokeh-4.0.patch
```

The preserved validation includes 137 focused Python passes, 77 optional
skips, BokehJS/Panel TypeScript and lint/build checks, and Playwright probes for
two-root static output, a direct server page, and Panel autoload. Pyodide,
PyScript, hosted Jupyter, Django/FastAPI, the full Panel suite, and the full
Panel docs build remain explicit release work rather than claimed support.

## Ownership moves made during review

- `.create()` remains wholly in EMBED 01, before mounts.
- Shared integral-number artifact fingerprinting and requirement union moved
  from the Sphinx range into EMBED 04. Git dropped the old Sphinx copy during
  restack because the patch content was already upstream.
- `node make test:frameworks` documentation belongs to EMBED 02, not EMBED 01.
- Implementation branches EMBED 01–07 continue to exclude coordination
  `outputs/`; EMBED 08 reintroduces only the final assessment/ledger artifacts.
- Panel remains last, after the global-index cleanup it is intended to consume.

## Suggested review order

1. Read the task table above and the contract's ten-minute path.
2. Review EMBED 01–03 as prerequisites: safe construction, owning mount, static
   identity.
3. Review EMBED 04 as the shared compiler/delivery API.
4. Use the Sphinx fixture as the compact static end-to-end demonstration.
5. Use the Jupyter walkthrough as the live-host stress test.
6. Confirm the EMBED 07 migration removes global discovery without removing
   external JavaScript access.
7. Read the Panel workflow table last; treat its three reusable gaps as
   follow-up API questions, not reasons to restore removed legacy machinery.
