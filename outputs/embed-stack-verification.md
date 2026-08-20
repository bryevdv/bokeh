# EMBED replacement stack verification

This report is completed as branches and replacement tasks are created. It supplements the verification protocol in `outputs/embed-stack-context.md`.

## Source baselines

| Source | Tip | Status |
|---|---|---|
| `branch-4.0` | `e40959e7da00157ff732a82e0bd428889c18e471` | recorded |
| `bokehjs-framework-integration` | `25d555da5b3919a8b70bc3e40fa991840f1be0e5` | recorded |
| `minimal-ids` | `4b54c421bc747a42a802c70093aaa8f6c5fc9bab` | recorded |
| `poc/jupyter-integration-4.0` | `00136fe8f59b6f2498efcacd7012ea6b19d97a32` | recorded |

## Branch and task mapping

| Branch | Parent | Replacement task | Worktree | Status |
|---|---|---|---|---|
| `codex/embed-00-contract` | `branch-4.0` | pending | `/Users/bryan/work/trees/bokeh-embed` | coordination worktree created |
| `codex/embed-01-mount-frameworks` | `codex/embed-00-contract` | pending | pending Codex worktree | pending |
| `codex/embed-02-minimal-ids` | `codex/embed-01-mount-frameworks` | pending | pending Codex worktree | pending |
| `codex/embed-03-artifact-runtime` | `codex/embed-02-minimal-ids` | pending | pending Codex worktree | pending |
| `codex/embed-04-sphinx` | `codex/embed-03-artifact-runtime` | pending | pending Codex worktree | pending |
| `codex/embed-05-jupyter` | `codex/embed-04-sphinx` | pending | pending Codex worktree | pending |

## Replay/equivalence audit

| Branch | Source comparison | Result | Notes |
|---|---|---|---|
| 01 | framework source range | pending | Preserve all ten source commits/capabilities. |
| 02 | minimal-ID source range | pending | Record lifecycle-aware resolutions, especially `has_props.ts` and document tests. |
| 05 | Jupyter source range | pending | Record mount/embed export resolutions and preserve the complete feature set before refactoring. |

## Ancestry and hygiene

| Check | Result |
|---|---|
| Every adjacent branch is an ancestor of the next | pending |
| `git diff --check` for every branch range | pending |
| No wheel/build output committed | pending |
| Old source branches retained | pending |
| Old tasks retained until audit complete | pending |

## Branch-local validation

| Branch | Required validation | Result |
|---|---|---|
| 00 | Markdown/context audit and source-tip verification | pending |
| 01 | lifecycle core tests; React/Vue/Angular/Web Component fixtures; docs/type/package checks | pending |
| 02 | 01 smoke tests plus Python/BokehJS minimal-ID and cross-language round trips | pending |
| 03 | schema fixtures, Python compiler/renderers, BokehJS mount/loader, legacy adapter matrix | not implemented yet |
| 04 | Sphinx unit tests, incremental/parallel/full docs builds, browser tests, size/request budgets | not implemented yet |
| 05 | source frontend units, packaged-runtime tests, notebook Python/protocol tests, AnyWidget/marimo CI, Playwright, common mount smoke | pending replay and review fixes |

## Known unresolved review blockers

The Jupyter blockers and required tests are copied in full into `outputs/embed-stack-context.md`. A branch containing the proof-of-concept commits must remain labeled **not merge-ready** until those items are resolved and verified.
