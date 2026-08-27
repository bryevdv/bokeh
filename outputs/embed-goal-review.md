# Embedding stack goal review

Status: active review. This ledger defines disjoint task goals, evaluates each
branch only against its own goal, and records documentation, test, and demo
work. The 2026-09-01 order correction numbers Jupyter as EMBED 05 and Sphinx as
EMBED 06; the detailed review sections retain their original narrative order.

## Disjoint task goals

| Task | Exclusive goal | Explicitly out of scope |
| --- | --- | --- |
| EMBED 00 | Define the normative cross-language vocabulary, schema rules, ownership rules, compatibility policy, canonical fixture inventory, and verification ledger. | Production implementation, host integration, or consumer-specific behavior. |
| EMBED 01 | Make construction of BokehJS models and views lifecycle-aware, failure-atomic, and enforceable from initial allocation through readiness. | DOM mount targeting, artifact envelopes, resource loading, or framework adapters. |
| EMBED 02 | Mount already-decoded standalone or server sources into keyed DOM targets with explicit readiness, replacement, lookup, and disposal, and expose that lifecycle through thin framework adapters. | Artifact serialization/decoding, resource resolution/loading, or host-specific aggregation. |
| EMBED 03 | Define and implement graph-minimal static serialization, including logical root addressing and cross-language graph fixtures, without changing ID-full live protocols. | Artifact envelopes/renderers, DOM mounting, resources, or host integration. |
| EMBED 04 | Compile embedding inputs into versioned artifacts, render/decode them, resolve and load declared resources, and adapt retained Python embedding facades to the shared mount runtime. | Sphinx page aggregation, notebook synchronization, framework component lifecycle, or Panel-specific compatibility. |
| EMBED 05 | Implement notebook-host adapters, bounded revisioned synchronization, output ownership, and correlated export on top of shared artifacts and mounts. | General framework adapters, global discovery compatibility, or Panel migration. |
| EMBED 06 | Make Sphinx a deterministic per-page consumer of the shared artifact/resource/mount contracts through the canonical `bokeh-embed` directive. | Generic artifact/runtime features or notebook/downstream-host behavior. |
| EMBED 07 | Remove global BokehJS view/document discovery and migrate remaining Bokeh-owned lookup/export paths to target-local mount handles. | New mount lifecycle behavior, artifact/resource policy, or third-party host migration. |
| EMBED 08 | Evaluate and demonstrate Panel's migration against the completed Bokeh 4 stack, separating Panel-owned changes from reusable Bokeh gaps. | Redefining Bokeh's core contract or adding Panel-only compatibility shims to Bokeh. |

The fixture boundary is deliberate: EMBED 00 specifies the canonical fixture
inventory and invariants; EMBED 03 implements graph/minimal-ID vectors; EMBED
04 implements artifact/resource vectors. Test adapters live with the code they
exercise.

## Review method

For every task:

1. Compare only the task's adjacent stack range, not the cumulative branch.
2. Check every changed production surface against the exclusive goal above.
3. Review public documentation and source docstrings for ownership, lifecycle,
   errors, cleanup, and migration behavior.
4. Add tests that directly prove the goal rather than merely increasing broad
   regression coverage.
5. Provide one compact, runnable or inspectable demonstration for core-team
   review.
6. Record validation separately from claims of publication or merge readiness.

## EMBED 00 review

Goal assessment: the four durable handoff documents cover the intended
cross-layer contract and validation history. The current wording overlaps with
implementation branches when it says EMBED 00 "owns shared fixtures" without
distinguishing normative fixture ownership from branch-local test adapters.
The table above supplies that boundary.

Documentation gap: add a compact reviewer path through the architecture and
link each contract concept to the branch that proves it. The existing proposal
is comprehensive but not a quick demonstration.

Test gap: EMBED 00 has no production tests by design. Its appropriate checks
are Markdown structure, internal-link/schema-term consistency, adjacent
ancestry, and ledger accuracy.

Demo material: add one small end-to-end flow showing Python input becoming an
artifact, declared resources, a keyed mount, a retained handle, and disposal.
The flow should link to the owning task at each transition.

## EMBED 01 review

Exclusive goal: lifecycle-aware, failure-atomic, enforceable BokehJS model and
view construction.

Goal assessment: the three-commit implementation establishes `HasProps.create`,
defers property/finalization work until subclass initialization completes,
rolls back partially constructed models/views/documents/deserialization, makes
destruction idempotent, and makes library model constructors protected. The
implementation is directly aligned with the goal.

Boundary finding: commit `ed829d1d34` adds five lines about
`node make test:frameworks` to the BokehJS developer guide. That command and
its framework/HMR matrix belong to EMBED 02. Move those lines to EMBED 02 while
retaining all factory-related call-site migrations in EMBED 01.

Documentation findings:

- `HasProps.create()` has no source-level API documentation explaining its
  lifecycle order, failure cleanup, or why direct construction is forbidden.
- The internal lifecycle methods are labelled internal but do not document
  their state transitions or deserializer-only use.
- Extension documentation gives the migration syntax but does not explain
  what extension authors should place in field initializers, property defaults,
  `initialize()`, and `connect_signals()`.
- The custom extension source removes its forwarding constructor but never
  contains an actual `Custom.create(...)` call for reviewers to inspect.

Directly aligned test additions:

- Prove that a failure in `View.initialize()` removes the partial view; current
  coverage begins at `lazy_initialize()` and `connect_signals()`.
- Add a compile-time fixture proving `Custom.create({...})` accepts declared
  attributes while `new Custom(...)` is rejected. If the repository has no
  stable negative-TypeScript-test convention, document this as build-verified
  rather than inventing one.
- Consider a focused rollback-order test with two finalized references. The
  current set-based test proves cleanup but not reverse-order ownership.

Demo material: extend the existing custom-extension example or add a compact
BokehJS example that visibly constructs a model through `create()`, records
the lifecycle order, renders its view, and disposes it. Keep mounting mechanics
out of this task; EMBED 02 owns the mount demonstration.

## EMBED 02 review

Exclusive goal: keyed DOM mount ownership plus thin framework adapters for an
already-decoded `MountSource`.

Goal assessment: the branch supplies an immediate `BokehMount`, awaitable
readiness and disposal, caller-versus-mount document ownership, keyed root
attach/detach/target replacement, target-local publication, structured errors,
React/Vue/Svelte/Angular/Web Component adapters, package builds, HMR tests, SSR
import checks, and nine small demonstration applications. This is strong and
direct evidence for the goal.

Boundary finding: the acceptance wording currently asks EMBED 02 to leak-test
"deserialization rollback." Model/deserializer rollback belongs to EMBED 01.
EMBED 02 should test only rollback of mount-created documents, views, target
publication, framework controllers, and listeners. Resource loading and server
session ownership begin in EMBED 04.

Documentation findings:

- The BokehJS user guide and framework README are unusually complete and the
  examples are already suitable for demonstration.
- The public TypeScript surface in `api/io.ts` is under-documented. `RootKey`,
  `MountTargets`, `DocumentOwnership`, `MountOwnership`, `MountError`,
  `MountOptions`, and most `BokehMount` properties/methods lack TSDoc that states
  ownership, preconditions, state transitions, and failure behavior.
- Adapter option/result types and most exported framework functions need short
  TSDoc linking their mount/dispose behavior to the common handle.

Directly aligned test additions:

- Prove `when_disposed` resolves after initialization failure as well as normal
  and early disposal.
- Add one adapter-level assertion that replacement disposes the previous mount
  before publishing the next handle; core stale-handle coverage already exists.
- Do not add serializer or resource-loader tests here.

Demo material: the nine framework projects already exceed the requirement.
For core review, add a one-page index describing the visible interaction and
the lifecycle event each project proves, and reuse the existing framework
screenshot rather than creating another implementation.

## EMBED 03 review

Exclusive goal: graph-minimal serialization and logical static-root addressing,
without changing ID-full live protocols.

Goal assessment: Python and BokehJS expose an explicit static serialization
path, retain IDs for shared/cyclic identity and externally named identities,
leave anonymous roots ID-free, deserialize anonymous objects safely, and share
one strict JSON fixture. Tests prove keyed roots, anonymous/shared/cyclic
graphs, deterministic repeated serialization, runtime ID replacement, and
canonical/patch ID retention. The work fits the goal.

Boundary finding: the static-addressing documentation may mention the positive
mount APIs from EMBED 02, but EMBED 07 must own the explicit 4.0 removal and
migration statement for `Bokeh.index`/`Bokeh.documents`. EMBED 03 owns only the
reason static model IDs are not durable addresses.

Documentation findings:

- Python `Document.to_static_json()` and its BokehJS counterpart are documented
  well.
- The serializer option and internal graph-reference collector lack concise
  comments explaining the minimal-ID invariant and why live callers must not
  select it.
- The user guide explains the new addressing paradigm, but there is no compact
  before/after payload example showing which IDs disappear and which remain.

Directly aligned test additions:

- Add a fixture case in which a shared object is reached through a mapping as
  well as a model property, guarding container traversal in both runtimes.
- Add a negative test that `models_with_ids` cannot make a model outside the
  serialized document appear in the artifact; the option retains identity, it
  does not expand the graph.

Demo material: add a small Python example that prints canonical versus static
JSON model-ID counts and then reconstructs the same logical roots. Keep artifact
rendering out of this demo; that belongs to EMBED 04.

## EMBED 04 review

Exclusive goal: compile, render, deliver, validate, and mount versioned
artifacts with explicit resource policy, while adapting retained Python
facades and rejecting removed envelopes.

Goal assessment: the branch implements the Python/JavaScript artifact envelope,
structural and server roots, normalized fingerprints, exact requirements,
delivery policy, a promise-deduplicating browser loader, standalone/server
preparation, page/fragment/external/MIME renderers, `/embed.json`, retained
facades, and actionable migration errors. Its tests directly cover the schema,
cross-language fingerprint, all renderers, resource modes/conflicts, additive
loading, repeated mounts, early disposal, server bootstrap, facades, and
removed APIs. The implementation strongly fits the goal.

Boundary finding: commit `f43528b781` currently lives in the Sphinx layer, now EMBED 06, but adds
`ResourceRequirements.union()`, integral-number fingerprint parity, and generic
artifact tests. Those are reusable artifact-contract behavior and should move
to EMBED 04. The Sphinx branch should merely consume the union.

Documentation findings:

- The embedding user guide provides a good architectural and migration
  overview.
- Public Python dataclasses and methods are mostly undocumented:
  `ArtifactRoot`, `EmbedArtifact`, `EmbedSpec`, artifact serialization and
  renderer helpers, resource requirement/asset/extension records,
  `ResolvedResource(s)`, and `ResourcePolicy` fields need API docstrings.
- Public BokehJS artifact/resource types, validation/preparation functions,
  `ResourceLoader`, artifact-aware `MountError` phases, and declaration
  bootstrap need TSDoc.
- The docs need one table contrasting *requirements* (artifact-owned) with
  *policy* (host-owned), including the exact meaning of `none` and `offline`.

Directly aligned test additions:

- Existing behavior coverage is broad. Add documentation examples as doctests
  or focused tests rather than another general matrix.
- Add a public-shape test for `ArtifactFragment`/`ExternalArtifact` fields so
  typed renderer results cannot drift undocumented.
- Add one declaration test for two artifacts whose requirements overlap only
  partially, demonstrating union plus browser promise deduplication together.

Demo material: add a runnable multi-root example that creates a plot, widget,
and table, compiles once, and writes page, fragment, JSON, and external forms.
Comments should explain what each renderer is for and how the resource policy
changes without recompiling the artifact.

## EMBED 06 review

Exclusive goal: deterministic Sphinx page aggregation as a consumer of the
shared artifact/resource/mount contracts.

Goal assessment: the directive uses context-local output capture, compiles
ordinary Bokeh outputs, unions exact page requirements, emits one deterministic
payload/bootstrap, tracks dependencies and stale assets, supports parallel and
incremental builds, produces non-HTML fallbacks, and gives actionable 4.0
rename diagnostics. Unit and browser tests cover no-plot pages, multi-output,
logical roots, resource budgets, CSP/host-owned/offline policies, custom
extensions, failures, remount, and stale cleanup. It fits the goal well.

Boundary findings:

- Move the generic `f43528b781` artifact/resource hardening to EMBED 04.
- Keep `9724e71901` here only if framed as enabling custom-extension examples
  during Bokeh's development Sphinx build. It changes generic compiler plumbing
  but its acceptance criterion is specifically the documentation consumer.
- Context-local output capture belongs here because it is the host-capture seam
  used by this directive, not a second embedding runtime.

Documentation findings:

- The Sphinx reference page is comprehensive for users and migration.
- `BokehEmbedDirective` itself needs a class docstring summarizing input forms,
  captured outputs, and builder behavior. Public `setup()` should document the
  registered directive/configuration/events.
- Internal page schema and asset manifest constants should have comments that
  explicitly mark them docs-private and distinguish them from `bokeh.embed/v1`.

Directly aligned test additions:

- Add a focused configuration test proving `alt` reaches both non-HTML and
  quick-builder fallback paths; current tests cover fallback behavior but not
  the same explicit text through both paths.
- Add an incremental-build test where a page changes from having embeds to no
  embeds, proving its prior payload and page resource references disappear.

Demo material: the Bokeh documentation is itself a large live demonstration.
Add a tiny self-contained Sphinx fixture under examples or developer docs that
core members can build quickly, plus one screenshot and a generated-file tree
showing one page payload/bootstrap/resource union.

## EMBED 05 review

Exclusive goal: notebook-host adaptation, bounded revisioned synchronization,
output ownership, and correlated export over shared artifacts and mounts.

Goal assessment: the branch replaces private notebook rendering machinery with
artifact MIME/fallback output, source-tested and packaged Jupyter frontends,
AnyWidget and marimo adapters, revisioned patches and resync, explicit output
ownership/release, resource ownership, safe saved-file links, and correlated
Playwright export. Tests cover queue byte/count bounds, revision gaps and
buffers, reconnect, replacement/deletion/trust changes, mount failures,
resource serialization, static fallback, JupyterLab, marimo, and export. This
is directly aligned and unusually complete.

Boundary finding: protocol-full initial serialization is owned here only as a
notebook consumer of the artifact compiler; the generic compiler seam belongs
to EMBED 04. Panel may consume it in EMBED 08 but must not make notebook code
the general API.

Documentation findings:

- User and developer guides are extensive and include a screenshot and host
  support matrix.
- `NotebookPatch`, `NotebookPatchError`, and
  `create_notebook_patch_receiver()` need fuller TSDoc for revision ownership,
  stale replay, gap recovery, buffer ordering, and thrown errors.
- The public Python `notebook_content()` docstring should document return
  ownership and why `resources="none"` is mandatory for host adapters.
- Private AnyWidget classes do not need public API docs, but module comments
  should summarize reconnect and release ownership for maintainers.

Directly aligned test additions:

- Add a receiver test proving a failed `Document.apply_json_patch()` does not
  advance the revision, so a corrected replay can be applied.
- Add one end-to-end assertion that two concurrently exported views cannot
  consume each other's correlated snapshots; unit coverage exists for keys,
  but this concurrency claim deserves a browser or server integration test.

Demo material: the committed notebooks, marimo app, host screenshot, and
JupyterLab lifecycle browser test already satisfy the requirement. Add a short
core-review script listing exactly which three examples demonstrate static,
connected/reconnect, and export behavior.

## EMBED 07 review

Exclusive goal: remove global view/document discovery and migrate remaining
Bokeh-owned consumers to target-local mount handles.

Goal assessment: the branch removes public `Bokeh.index`, `Bokeh.documents`,
the global-parent behavior in `ViewManager`, migrates callback context to the
current document's manager, and updates integration/export tooling to discover
mounts from `data-bokeh-mounted` targets. Focused tests verify exports disappear
and callback lookup is document-scoped. This is a small, coherent cleanup that
fits the goal.

Documentation finding: the adjacent range contains no documentation. Positive
target-local acquisition is documented earlier because EMBED 02 introduces
it, and static ID guidance is documented in EMBED 03, but this task still owns
an explicit Bokeh 4 migration note stating that `Bokeh.index`,
`Bokeh.documents`, and public `view_manager` are removed. It must show how code
that did not create the mount uses `Bokeh.when_mounted(target)` and how code
with a handle uses `root()`, `view()`, `document`, and `view_lookup`.

Directly aligned test additions:

- Use two simultaneously mounted documents to prove `CustomJS` receives only
  its own document's view lookup, not merely an object equal to one assigned
  manager.
- Add a public-package type/export assertion that `index`, `documents`, and
  `view_manager` are absent while `when_mounted` and `BokehMount` remain.
- Keep resource, serialization, and general mount lifecycle tests out of this
  cleanup branch.

Demo material: add one browser example with two independent mounts and external
page JavaScript that acquires one handle from its target, changes a named model,
then disposes only that mount. This is the clearest demonstration of why the
global registry is no longer needed.

## EMBED 08 review

Exclusive goal: assess and demonstrate Panel's downstream migration after the
Bokeh stack is complete, without changing Bokeh to preserve Panel internals.

Goal assessment: the local-only branch pins a Panel revision, inventories
affected workflows, separates three reusable Bokeh gaps from Panel-owned work,
provides an applicable 45-file patch, records explicit Bokeh-4-only version
support, and reports focused Python, extension-build, TypeScript, lint,
compileall, and browser-lifecycle evidence. It satisfies the assessment and
patch-proposal goal; it is not a Panel publication branch or Bokeh PR.

Documentation findings:

- The assessment and patch proposal are detailed, but they need a one-page
  reviewer map from each Panel patch area to the exact completed EMBED API it
  consumes.
- The validation evidence is embedded in two long documents. Add a concise
  validation index with environment, source paths, commands, results, and
  known non-claims.
- The three remaining reusable Bokeh gaps need proposed API shapes and owning
  future work items, not just prose descriptions.

Directly aligned test additions:

- The patch already adds downstream tests. Add one browser scenario combining
  two Panel components, target-local lookup, replacement, and selective
  disposal; this directly exercises the final EMBED 07 boundary.
- Add a patch-application smoke test against the pinned Panel commit so drift
  fails immediately before the expensive suite begins.

Demo material: add a short Panel application plus capture instructions showing
static/template output, one connected update, external handle acquisition, and
disposal. Include a screenshot or short recording and state clearly that it is
evidence from a patched Panel checkout, not shipped Bokeh functionality.
