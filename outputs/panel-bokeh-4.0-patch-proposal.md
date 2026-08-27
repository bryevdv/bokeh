# Applicable Panel patch proposal for the final Bokeh 4 embedding APIs

Target Panel revision:
`be0b5e2b0955a38a8871aa3fc1703b57c76c1e81` (`main`, 2026-08-20).

Bokeh architecture source-validation parent:
`codex/embed-07-view-index-cleanup` at
`ccdb06b46463a3603e0e66abcb4313cab76ed6b5`.

The recovered EMBED 08 branch is now based on EMBED 07 at
`20ea756f3f13d6c8ac6c8c6d5949b465eaefc065`. Jupyter is EMBED 05 and Sphinx
is EMBED 06; reordering those layers left their combined tree unchanged. The
patch remains byte-identical and passes `git apply --check` at the pinned Panel
revision.

The downstream browser and build validation ran before the final review-only
documentation, TSDoc, and test commit on that branch. No Bokeh runtime behavior
used by this patch changed in that commit.

Patch artifact: `outputs/panel-bokeh-4.0.patch`.

SHA-256: `e6a8e70fb31fc21e22801c66895a0a97b37f3aca77d6bccd0bfb247ec79122fd`.

Status: applicable local downstream draft for a breaking Panel 2/Bokeh 4-only
line. It is not published, not applied to a user Panel checkout, and not part of
a public Bokeh pull request.

## Apply and inspect

From a clean Panel checkout at the target revision:

```bash
git rev-parse HEAD
git apply --check /Users/bryan/work/trees/e94b/bokeh-embed/outputs/panel-bokeh-4.0.patch
git apply /Users/bryan/work/trees/e94b/bokeh-embed/outputs/panel-bokeh-4.0.patch
git diff --check
```

The first command must print:

```text
be0b5e2b0955a38a8871aa3fc1703b57c76c1e81
```

The full-index unified diff changes 45 files with 657 insertions and 631
deletions. It contains no generated Bokeh or Panel build tree.

## Boundary decision

The patch does not support Bokeh 3 and Bokeh 4 simultaneously. It changes the
development dependency line to:

- Python build/runtime: `bokeh >=4.0.0.dev1,<4.1.0`;
- JavaScript: `@bokeh/bokehjs ^4.0.0-dev.1`.

Panel 1.9 remains the Bokeh 3 maintenance line. A breaking Panel release uses
the Bokeh 4 path directly, with no `Version(bokeh)` branches, `Bokeh.index`
fallbacks, or dormant legacy render-item implementation. Final release version
spellings must replace the development specifiers before publication.

## Runtime behavior after the patch

### Static pages, templates, and state replay

1. Panel builds its normal roots, document, theme, and template variables.
2. `panel/io/save.py:file_html()` uses graph-minimal `bokeh.embed.embed()` for
   ordinary output.
3. If a reachable `panel.models.state.State` records PATCH-DOC IDs, it uses
   protocol-full `notebook_content(..., live=True)`.
4. `panel/io/artifact.py:render_artifact_page()` renders
   `artifact.fragment(resources="none")` through Panel's existing page shell.
5. Logical artifact keys drive placement. `ArtifactTemplateRoot` retains Panel
   names, tags, and compatibility metadata without making model IDs placement
   IDs.
6. One declaration mounts the multi-root artifact and publishes its shared
   handle as `target.bokehMount` on each owned target.
7. Embedded-state `CustomJS` receives the state model through explicit `args`.

### Notebook display

1. `render_model()` and `render_template()` compile protocol-full content.
2. Panel's resource loader supplies the host bundle, including `bokeh-api`.
3. `_templates/doc_nb_js.js` calls `Bokeh.mount()` with keyed targets and an
   `AbortController.signal`.
4. It calls `Bokeh.when_mounted(target, {signal})`, verifies the returned handle
   is the one it created, awaits `ready`, and writes readiness/error state.
5. JupyterLab keyboard suppression happens after render.
6. Target removal aborts the waiter and disposes the mount idempotently.

The current PyViz comm transport remains. Replacing it with Bokeh's complete
protocol-2 host/lease machinery is a separate change once that seam is public.

### Direct Panel server page

1. Panel creates/reuses its normal `ServerSession` and token.
2. `server_html_page_for_session()` calls
   `embed_server(".", token=session.token, roots=...)`.
3. Panel renders the artifact through its template/resource shell.
4. Bokeh's server source owns the browser session and the retained mount.

### Panel-owned `/autoload.js`

Bokeh 4 removes its autoload handler. Panel therefore owns a small
`AutoloadJsHandler(BkSessionHandler)` which preserves Panel's endpoint while
using the new architecture:

1. authorize and create/reuse the session;
2. compile a server-source artifact with proxy-aware URLs;
3. emit Panel resource tags and call `Bokeh.mount(artifact, target, ...)`;
4. discover the same handle with `when_mounted()`;
5. expose readiness/errors and dispose when the caller target is removed.

Panel's route rewrite explicitly retains Bokeh 4's `/embed.json`. Bokeh does not
regain a legacy autoload route or browser program.

### Components and external view access

Panel component renderers receive their owning view directly:

- `reactive_esm.ts` and `anywidget_component.ts` pass `this` to the renderer;
- `react_component.ts` passes the root/child view through generated component
  functions instead of looking up a model ID globally;
- `comm_manager.ts` drops its `Bokeh.index` fallback;
- UI integration code with only a host element uses
  `Bokeh.when_mounted(target)` and then `mount.views`, `mount.document`, or
  `mount.view_lookup`;
- notification callbacks use the callback object's document;
- semantic cross-root lookup uses `Model.name`; callback-owned model access uses
  explicit `CustomJS.args`.

There is no public `Bokeh.index`, `Bokeh.documents`, or global `view_manager` in
the target architecture.

### Export and disposal

Panel removes its assignment to Bokeh's private export `_WAIT_SCRIPT`. Bokeh 4's
exporter already discovers the target-local mount, awaits readiness/document
idle, and selects SVG roots from the mount.

Static callers retain the shared multi-root handle. Direct server pages dispose
it explicitly/page-locally. Notebook and autoload paths add DOM-removal
observers. `dispose()` closes owned sessions/views, resolves `when_disposed`,
and unpublishes `target.bokehMount`.

## File- and symbol-specific patch

### Common artifact/template adapter

New `panel/io/artifact.py` provides:

- `ArtifactTemplateRoot` and `ArtifactTemplateRoots` for ordered/name lookup;
- `ArtifactTemplateDocument` for Panel's small template-facing document shape;
- `render_artifact_page()` for key/model/mount validation, rootless server
  wildcard handling, host resource ownership, and existing Panel template
  variables.

This is Panel-specific adaptation. Bokeh should not restore `RenderRoot` or a
Panel-aware Jinja macro.

### Python embedding paths

- `panel/io/save.py:file_html()` compiles artifacts and removes the private
  export-wait override.
- `panel/io/notebook.py:{render_model,render_template}` use protocol-full
  notebook artifacts and the common adapter.
- `panel/io/server.py:{server_html_page_for_session,autoload_js_script}` use
  server artifacts; `AutoloadJsHandler` replaces the removed Bokeh handler;
  `/embed.json` is preserved.
- `panel/io/embed.py:STATE_JS` uses explicit `CustomJS.args`.
- `panel/io/resources.py:bundle_resources()` includes `bokeh-api` in the
  host-owned Bokeh components.
- `panel/io/state.py:_state._ioloop` prefers the owning application loop from
  the current session context, with an `IOLoop.current()` fallback.

The guarded access to `application_context.io_loop` is the one server contract
gap recorded for Bokeh: `ServerContext` should expose the owning scheduler.

### BokehJS extension compatibility

The patch updates:

- `button`, `checkbox_button_group`, `file_download`, `icon`, and
  `radio_button_group` views for `_children_views()`;
- `icon`, `tooltip_icon`, `trend`, and VTK colorbar code for `.create()` model
  factories;
- layout, Card, ReactiveHTML, ReactiveESM, and ReactComponent for
  `_apply_stylesheets()` and DOM stylesheet ownership;
- HTML/MathJax for a nullable MathJax provider;
- Tabs by removing a rendering override obsolete in Bokeh 4;
- `panel/_param.py` and `panel/models/vega.py` for
  `enumeration(*typing.get_args(...))`;
- test cleanup for the context-local patched-document capture.

These are Panel-owned migrations, not missing Bokeh compatibility APIs.

### Explicit WASM boundary

`panel/io/convert.py` no longer imports removed render-item APIs at module load,
so `panel.command` and `panel serve` import normally. `script_to_html()`,
`convert_app()`, and `convert_apps()` immediately raise an error explaining that
the worker transport must move to `bokeh.embed/v1` and `BokehMount`.

`panel/io/pyodide.py` applies the same Bokeh 4-only boundary at initialization,
document write, and model-linking entry points. Dead-path linking is expressed
in terms of `when_mounted()`, `mount.document`, and `mount.view_lookup`, and the
worker handler disposes any retained mount. There is no Bokeh 3 fallback.

The eventual replacement should send artifact snapshots with correlated
revisions, remount or patch through the retained handle, and dispose the prior
mount on worker/page replacement.

## Resource ownership and remaining Bokeh gaps

Panel owns the page resource bundle and therefore asks artifact fragments for
`resources="none"`. This prevents double execution. It does not remove
extension bytes already embedded in an artifact payload. Bokeh still needs a
public named-extension satisfaction/manifest input at compile time.

The other reusable gaps are a public protocol-2 transport/resource lease for
third-party connected notebook hosts and a public owning scheduler on
`ServerContext`. Existing-session server sources, target-local mount discovery,
root/view lookup, protocol-full IDs, error/readiness, and disposal are complete.

## Tests included in the diff

- `panel/tests/io/test_artifact.py`: wildcard server mount and semantic
  name/logical-key separation;
- `panel/tests/io/test_convert.py`: actionable Bokeh 4 converter boundary;
- `panel/tests/io/test_save.py`: artifact MIME/declarations, no removed globals,
  protocol-full state replay;
- `panel/tests/io/test_notebook.py`: mount discovery, readiness, and disposal;
- `panel/tests/io/test_embed.py`: explicit state model in `CustomJS.args`;
- `panel/tests/test_server.py`: artifact pages, Panel autoload behavior, and
  coexistence of `/embed.json` plus Panel `/autoload.js`;
- UI test migrations for notifications, markup, React components, and
  Tabulator target-local discovery.

## Validation performed

Every Bokeh/Panel Git, Python, Node, test, and build command ran through
`/Users/bryan/anaconda3/bin/conda run -n bokeh-embed ...`. Bokeh was never
installed editable.

### Applicability and source precedence

- independent clean Panel snapshot at the exact SHA;
- `git apply --check`: passed; apply: passed; `git diff --check`: passed;
- 136 unified-diff separator lines containing only the context-prefix space
  were normalized to empty lines; no meaningful indentation or content changed;
- imported Bokeh:
  `/Users/bryan/work/trees/e94b/bokeh-embed/src/bokeh/__init__.py`,
  `4.0.0.dev1+42.ga6485cdf`;
- patched Panel and `panel.command` imported from each disposable snapshot;
- independent applied-snapshot converter test: `1 passed`.

### Python

- Ruff over all `panel`: passed;
- `python -m compileall -q panel`: passed;
- broad affected suite covering artifact, converter, notebook, save, state
  replay, and full Panel server tests: `137 passed, 77 skipped in 29.49s`.

### BokehJS and Panel extension

- final BokehJS source library build: passed;
- final BokehJS full build: passed;
- Panel compiler built 85 TypeScript files against that source: passed;
- full `tsc --noEmit --pretty false`: passed;
- ESLint: zero errors, 261 pre-existing warnings;
- built Panel bundles contain none of `Bokeh.index`, `Bokeh.documents`, or a
  public `view_manager` dependency.

Generated `panel/dist` and third-party vendor assets were supplied only inside
the disposable validation snapshot. A missing generated asset caused the first
save/notebook fixture attempts to fail; with the normal distribution assets
present, those tests passed.

### Browser

Playwright exercised an inline two-root static page, a direct Panel server page,
and Panel's autoload response. Final observation:

```json
{"server":{"autoload":{"after":{"disposed":true,"state":"disposed","unpublished":true},"before":{"errors":0,"session":true,"state":"ready"}},"direct":{"after":{"disposed":true,"state":"disposed","unpublished":true},"before":{"errors":0,"root":true,"session":true,"state":"ready","target":true,"view":true}},"errors":[],"globals":{"documents":false,"index":false,"view_manager":false}},"static":{"after":{"disposed":true,"shared_handle":true,"sibling_state":"disposed","sibling_unpublished":true,"state":"disposed","unpublished":true},"before":{"distinct_handles":1,"document_matches":true,"errors":0,"key":"root-0","root_matches":true,"semantic_name":true,"state":"ready","target_matches":true,"targets":["root-0","root-1"],"view_matches":true},"errors":[],"globals":{"documents":false,"index":false,"view_manager":false}}}
```

The browser produced no page or console errors.

## Release gates and sequencing

Suggested upstream sequence:

1. dependency boundary plus Python/BokehJS compatibility;
2. artifact/template adapter, static save, and protocol-ID replay;
3. notebook artifact mount, errors/readiness, and disposal;
4. server artifact pages, Panel autoload handler, `/embed.json` preservation,
   and owning-loop repair;
5. direct component-view and explicit callback-argument migrations;
6. Bokeh host-extension satisfaction, then remove duplicate payload bytes;
7. public third-party protocol-2 host seam, then migrate PyViz ownership;
8. Pyodide/PyScript artifact/revision transport and removal of migration
   errors;
9. optional Django/FastAPI, docs/JupyterLite, hosted Jupyter, release notes,
   and complete CI matrices.

Not run: full Panel suite, full Sphinx/docs/JupyterLite build, hosted Jupyter
frontends, Django/FastAPI, or Pyodide/PyScript browser execution. The 77 skips
represent optional integrations, not release coverage.

No Panel commit, push, pull request, gist, or GitHub mutation was made.
