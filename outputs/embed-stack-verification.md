# EMBED replacement stack verification

This report is completed as branches and replacement tasks evolve. It supplements the verification protocol in `outputs/embed-stack-context.md`. Dynamic branch tips are reported at handoff rather than embedded here because every EMBED 00 commit intentionally rewrites descendant stack tips.

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
| EMBED 00 | `codex/embed-00-contract` | `branch-4.0` | `/Users/bryan/work/trees/53c9/bokeh-embed` | attached and clean at `a40787bc42` before this policy handoff |
| EMBED 01 | `codex/embed-01-mount-frameworks` | `codex/embed-00-contract` | `/Users/bryan/work/trees/623b/bokeh-embed` | attached and clean at `92b7bd5d74` |
| EMBED 02 | `codex/embed-02-minimal-ids` | `codex/embed-01-mount-frameworks` | `/Users/bryan/work/trees/0014/bokeh-embed` | attached and clean at `239cbf8a64` |
| EMBED 03 | `codex/embed-03-artifact-runtime` | `codex/embed-02-minimal-ids` | `/Users/bryan/work/trees/feaa/bokeh-embed` | attached and clean at `239cbf8a64`; implementation layer is empty |
| EMBED 04 | `codex/embed-04-sphinx` | `codex/embed-03-artifact-runtime` | `/Users/bryan/work/trees/1395/bokeh-embed` | attached and clean at `239cbf8a64`; implementation layer is empty |
| EMBED 05 | `codex/embed-05-jupyter` | `codex/embed-04-sphinx` | `/Users/bryan/work/trees/ad10/bokeh-embed` | attached and clean at `5ba3baa165` |
| EMBED 06 | `codex/embed-06-panel` | `codex/embed-05-jupyter` | Codex-managed worktree, recorded by the new task at initialization | downstream impact/patch task starts from the final 05 tip |

The project worktree `/Users/bryan/work/trees/bokeh-embed` is detached at the pre-handoff EMBED 00 contract tip and owns no stack branch.

## Dedicated environment

Every project command on all seven tasks uses:

```text
/Users/bryan/anaconda3/bin/conda run -n bokeh-embed ...
```

The environment came from `conda/environment-test-3.13.yml` and contains Python 3.13.15, Node.js 24.19.0, npm 11.17.0, and pytest 9.1.1. Its installed local Bokeh 4.0 proof-of-concept wheel is distribution metadata/static baseline only. Do not run `pip install -e` against any task. Before consequential Python validation, verify the imported Bokeh path; from a task root use `python -m pytest -o pythonpath=src ...`.

## Replay/equivalence audit

| Branch | Source comparison | Result | Notes |
|---|---|---|---|
| 01 | framework source range | passed | Range-diff is exact for all ten commits; the tree equals `bokehjs-framework-integration` outside `outputs/`. |
| 02 | minimal-ID source range | passed | All six source commits are accounted for; only documented lifecycle-aware semantic conflict resolutions differ. |
| 05 | Jupyter source range | replay passed; feature review open | All ten source commits are accounted for with only documented mount/embed semantic conflict resolutions. The branch remains **not merge-ready**. |

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
| 01 | lifecycle core tests; React/Vue/Angular/Web Component fixtures; docs/type/package checks | replay/tree audit passed; focused validation remains to be recorded |
| 02 | 01 smoke tests plus Python/BokehJS minimal-ID and cross-language round trips | focused minimal-ID tests passed 129/129 in `bokeh-embed` with `-o pythonpath=src` |
| 03 | schema fixtures, Python compiler/renderers, BokehJS mount/loader, retained-facade and migration matrix | not implemented yet |
| 04 | Sphinx unit tests, incremental/parallel/full docs builds, browser tests, size/request budgets | not implemented yet |
| 05 | source frontend units, packaged-runtime tests, notebook Python/protocol tests, AnyWidget/marimo CI, Playwright, common mount smoke | source replay accounted for; latest-review blockers remain unresolved |
| 06 | Panel impact inventory, Bokeh 4.0 workflow mapping, patch proposal/draft diff, focused and end-to-end downstream test matrix | new final-layer task; pending evaluation after 00–05 |

The earlier EMBED 02 `dev313` run that failed five tests imported an editable primary checkout. It is classified as wrong-source contamination, not a branch failure. The clean 129/129 result above is the valid branch evidence.

## Known unresolved review blockers

The Jupyter blockers and required tests are copied in full into `outputs/embed-stack-context.md`. A branch containing the proof-of-concept commits remains **not merge-ready** until those items are resolved and verified.

## Bokeh 4.0 compatibility evidence

Every 3.x embedding use case must have a tested 4.0 route and migration recipe. Familiar APIs are retained only as useful thin facades; any other adapter must be isolated, cheap, and architecture-neutral. There is no promised one- or two-major compatibility window for `JsonItem`, `RenderItem`, autoload programs, wrapping flags, or notebook-private rendering machinery.
