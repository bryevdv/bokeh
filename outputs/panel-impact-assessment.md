# Panel downstream impact of the final Bokeh 4 embedding stack

Status: final local EMBED 08 assessment. It evaluates the complete stack through
`codex/embed-07-view-index-cleanup`, now at
`21931d5ac3fad225abb68f3b3e7564bd42404e10`, including removal of public global
view/document discovery. It is not part of a public Bokeh pull request.

The final EMBED 07 review commit after the downstream browser/build validation
contains documentation, TSDoc, and tests only; the runtime exercised by this
assessment is unchanged.

## Inspection anchor and version assumption

The authoritative downstream source is `holoviz/panel` at:

- revision: `be0b5e2b0955a38a8871aa3fc1703b57c76c1e81`;
- branch/date/subject: `main`, 2026-08-20, `Make Tabulator edits more robust (#8731)`;
- Panel JavaScript version: `1.9.4`;
- original Python boundary: runtime `bokeh >=3.7.0,<3.10.0`, build
  `bokeh >=3.8.0,<3.10.0`;
- original JavaScript boundary: `@bokeh/bokehjs ^3.9.2`.

Inspection and patch validation used disposable snapshots under `/private/tmp`.
No user Panel checkout was modified. Consequential Python imports resolved to:

```text
/Users/bryan/work/trees/e94b/bokeh-embed/src/bokeh/__init__.py
4.0.0.dev1+42.ga6485cdf
```

This assessment assumes a breaking Panel release that pins Bokeh 4. Panel does
not need one wheel or JavaScript bundle to support Bokeh 3 and Bokeh 4 at the
same time. That assumption removes dual-version conditionals, global-index
fallbacks, and legacy conversion code. Panel 1.9 maintenance can remain on
Bokeh 3; the proposed Panel 2 line is Bokeh 4-only.

## Executive result

Changing dependency bounds is insufficient. The pinned Panel source has four
high-impact classes of breakage against the final Bokeh stack:

1. Static, notebook, and server output still assemble legacy render items and
   call legacy browser embedding functions instead of compiling and mounting an
   `EmbedArtifact`.
2. Bokeh 4 removes its autoload handler, `Bokeh.index`, `Bokeh.documents`, and a
   public global view manager. Panel imports the removed handler and several
   components/tests rediscover views through those globals.
3. Panel's BokehJS extension needs ordinary Bokeh 4 constructor, child-view,
   stylesheet, nullable MathJax, Tabs, and component-view ownership changes.
4. Pyodide/PyScript conversion still transports `RenderItem`/`JsonItem` data.
   Its import-time legacy dependencies also prevent `panel serve` from starting
   unless the unavailable converter is isolated.

The applicable draft patch addresses the normal static, template, notebook,
server, extension, component, PNG-wait, readiness, error, and disposal paths.
It makes the Bokeh 4 WASM converter deliberately unavailable with an actionable
error; it does not retain a Bokeh 3 implementation behind a version branch.

## Final Bokeh APIs Panel can consume

- `bokeh.embed.embed()` compiles graph-minimal standalone artifacts.
- `bokeh.embed.notebook.notebook_content(..., live=True)` compiles
  protocol-full output for patches and comms.
- `bokeh.embed.embed_server(url, token=..., roots=...)` declares a new or
  existing server source without reconstructing a `RenderItem`.
- `EmbedArtifact.fragment(resources="none")` lets Panel own its page/template
  resource tags while reusing Bokeh's artifact declarations.
- `Bokeh.mount()` returns a retained `BokehMount`; declarations publish the same
  handle on every owned target as `target.bokehMount`.
- `Bokeh.when_mounted(target, {signal})` provides target-local asynchronous
  discovery without a registry.
- `BokehMount` exposes `ready`, structured `error`/`errors`, `root_keys`,
  `root(key)`, `view(key)`, `target(key)`, `models`, `views`, `document`,
  `session`, `view_lookup`, `attach()`, `detach()`, `replace_target()`,
  `when_disposed`, and idempotent `dispose()`.
- External page code uses a retained handle or target-local discovery. Model
  lookup uses logical root keys or semantic `Model.name` through
  `mount.document.get_model_by_name()`. Callback code receives models through
  explicit `CustomJS.args`.
- Bokeh's export helper now discovers the target-local mount and selects SVG
  roots through it. Panel must not replace Bokeh's private wait script.

There is no justification for restoring `RenderItem`, `JsonItem`, autoload,
`Bokeh.index`, `Bokeh.documents`, or a public global view registry for Panel.

## Workflow inventory and result

| Workflow | Pinned Panel dependency | Final Bokeh 4 route | Draft result |
|---|---|---|---|
| Static HTML and `Viewable.save()` | `panel/io/save.py:file_html()`, legacy document/render-item helpers | `embed()` plus `artifact.fragment(resources="none")` | Migrated and browser exercised |
| Static `embed=True` replay | recorded PATCH-DOC messages and model IDs | protocol-full `notebook_content(..., live=True)`; state models passed through `CustomJS.args` | Migrated and asserted |
| PNG/SVG export | Panel overrides private `_WAIT_SCRIPT` and reads `Bokeh.documents[0]` | Bokeh's mount-aware exporter and root selection | Private override removed |
| Templates and named multi-root | model IDs double as placement IDs | logical artifact keys plus Panel-owned template adapters; one shared mount | Migrated; two-root probe passed |
| Notebook initial/live display | legacy notebook render items and `embed_items_notebook()` | protocol-full artifact, `Bokeh.mount()`, `when_mounted()`, readiness/error markers, DOM-removal disposal | Migrated while retaining current PyViz comms |
| `show_server()` in notebooks | `server_document()` | retained thin Bokeh facade emits server artifact output | No new Panel path needed |
| Direct Panel Tornado page | local legacy session page helper | `embed_server()` plus Panel's page/resource shell | Migrated and session exercised |
| Panel `/autoload.js` | imports Bokeh's removed handler; emits legacy program | Panel-owned `BkSessionHandler` response mounting a server artifact | Migrated; Bokeh `/embed.json` preserved |
| Django/FastAPI | retained server-document facade or optional adapters | retained facade/shared Panel server adapter | Source-audited; optional integrations not run |
| Custom extensions/resources | Panel compiler, bundle, routes, third-party assets | exact artifact requirements plus Panel host bundle containing `bokeh-api` | Builds and browser path pass; duplicate-payload gap remains |
| React/ReactiveESM/AnyWidget | global view rediscovery and older view APIs | pass the owning view directly; use target mount only at host boundaries | Migrated and TypeScript-built |
| `CustomJS` state callbacks | generated callback searches a model ID | explicit `args={'state': state_model}` | Migrated |
| Pyodide/PyScript and worker | `RenderItem`/`JsonItem`, global clearing, legacy worker transport | artifact snapshots, revisioned remount, `mount.document`, disposal | Explicitly unavailable on Bokeh 4 pending dedicated rewrite |
| Cleanup/disposal | Python cleanup plus browser paths without a common owner | retained handle; explicit or DOM-removal disposal; session owned by mount | Static, direct server, and autoload exercised |
| Sphinx/docs/JupyterLite | Bokeh Sphinx extension plus WASM examples | completed Bokeh Sphinx artifact consumer; JupyterLite waits for converter rewrite | No Sphinx code change; full docs build not run |
| Packaging/CI | Bokeh 3 bounds and npm dependency | breaking Bokeh 4-only Python/npm line and Bokeh 4 jobs | Bounds/lock patched; workflow matrix remains release work |

## Panel-owned changes

Panel should own:

- the artifact-to-Panel-template adapter and preservation of Panel template
  names, tags, themes, resource ordering, and shell variables;
- its optional `/autoload.js` compatibility endpoint and its deprecation path;
- direct component-view threading in React, ReactiveESM, AnyWidget, Tabulator,
  and comm code;
- explicit `CustomJS.args`, semantic names, and logical-key usage;
- all normal BokehJS 4 extension migrations (`.create()`,
  `_children_views()`, `_apply_stylesheets()`, DOM stylesheet ownership,
  nullable MathJax, and obsolete Tabs overrides);
- the Bokeh 4-only dependency boundary, CI, release notes, and temporary WASM
  migration error;
- the eventual artifact/revision rewrite of Pyodide/PyScript conversion.

None of these warrants a Bokeh compatibility shim.

## Reusable Bokeh contract gaps

Three narrow gaps remain after the final stack audit:

1. **Payload-level host extension satisfaction.** `resources="none"` prevents
   duplicate execution but an artifact can still carry extension bytes already
   supplied by Panel's host bundle. The compiler needs a public named-extension
   satisfaction/manifest input that preserves identity, integrity, order, and
   validation while omitting satisfied payload content.
2. **Third-party connected-notebook host seam.** Panel can use protocol-full
   artifacts and `BokehMount.document`, but Bokeh's protocol-2 display/resource
   lease and transport binding are not yet a reusable public host API. Panel can
   retain PyViz comms temporarily rather than copy Bokeh's private host code.
3. **Public owning server scheduler.** Worker-initialized Panel applications
   need the owning application loop. The patch defensively reaches
   `session_context.server_context.application_context.io_loop`, then falls back
   to `IOLoop.current()`. `ServerContext` should expose the owning scheduler.

The existing-session, declaration-observability, root discovery, global-view
cleanup, and protocol-ID concerns are closed by the final Bokeh APIs.

## Supported boundary and migration notes

The draft changes the development line to:

- Python build/runtime: `bokeh >=4.0.0.dev1,<4.1.0`;
- JavaScript: `@bokeh/bokehjs ^4.0.0-dev.1`.

Use final release spellings before publication. Do not merge these bounds into
Panel 1.9. A Panel 2/Bokeh 4 release should tell custom template authors that
placement keys are not model IDs, external code must retain/discover mounts
from targets, semantic lookup uses `Model.name`, and callbacks receive models
through `CustomJS.args`. Bokeh 4 WASM conversion must be documented as
temporarily unavailable.

## Validation summary

The final patch is 45 files, 657 insertions, and 631 deletions. Validation used
only disposable Panel/BokehJS snapshots and the `bokeh-embed` environment:

- independent clean Panel snapshot at the pinned SHA: `git apply --check`,
  apply, and `git diff --check` passed;
- exact Bokeh source import and patched Panel/`panel.command` import passed;
- Ruff over all `panel`: passed; `compileall`: passed;
- broad affected Python suite: `137 passed, 77 skipped in 29.49s`;
- independent applied-snapshot converter migration test: `1 passed`;
- final BokehJS source library/full build: passed;
- Panel extension compiler: 85 TypeScript files compiled; full `tsc` passed;
- ESLint: zero errors and 261 pre-existing warnings;
- Playwright: two-root static, direct server, and Panel autoload mounts reached
  ready with zero errors; root/view/target/view-lookup and semantic-name access
  passed; explicit and DOM-triggered disposal unpublished the targets; no
  `Bokeh.index`, `Bokeh.documents`, or public `view_manager` existed.

Generated `panel/dist` and vendor bundles were required as disposable test
fixtures. The full Panel suite, full Sphinx/docs/JupyterLite build, hosted
Jupyter matrices, Django/FastAPI, and Pyodide/PyScript browser execution were
not run. The 77 skips are optional-dependency coverage gaps, not release proof.

No Panel commit, push, pull request, gist, or GitHub mutation was made.
