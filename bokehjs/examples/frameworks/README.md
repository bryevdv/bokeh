# BokehJS framework examples

These projects are intentionally small enough to use as documentation examples.
Each browser project places the same plot in a modest application shell and uses
a native range input to update its `ColumnDataSource`. This demonstrates that the
framework owns the surrounding UI and state while BokehJS updates the existing
plot without a remount. The Node.js example remains DOM-free by design.

| Project | Integration | User-facing entry point | Lifecycle evidence |
| --- | --- | --- | --- |
| [React + Vite](react-vite/) | `@bokeh/react` component | [`App.tsx`](react-vite/src/App.tsx) | effect mount, prop update, cleanup, and HMR replacement |
| [Vue + Vite](vue-vite/) | `@bokeh/vue` component | [`App.vue`](vue-vite/src/App.vue) | composable mount, reactive update, unmount, and HMR replacement |
| [Svelte + Vite](svelte-vite/) | `@bokeh/svelte` action | [`App.svelte`](svelte-vite/src/App.svelte) | action update/destroy and HMR replacement |
| [Angular](angular-ng/) | `@bokeh/angular` standalone component | [`main.ts`](angular-ng/src/main.ts) | input changes, selective root removal, and component destruction |
| [Web Component + Webpack](web-component-webpack/) | `@bokeh/web-component` custom element | [`main.ts`](web-component-webpack/src/main.ts) | connect, model replacement, disconnect, and reconnect |
| [Vanilla + Vite](vanilla-vite/) | direct `mount()` | [`main.ts`](vanilla-vite/src/main.ts) | immediate handle, readiness, update, and disposal |
| [Vanilla + Webpack](vanilla-webpack/) | direct `mount()` | [`main.ts`](vanilla-webpack/src/main.ts) | package-format parity for the direct lifecycle |
| [Vanilla + Rspack](vanilla-rspack/) | direct `mount()` | [`main.ts`](vanilla-rspack/src/main.ts) | package-format parity for the direct lifecycle |
| [Node.js SSR compatibility](node-ssr-compat/) | DOM-free import and model construction | [`main.mjs`](node-ssr-compat/main.mjs) | importing packages does not claim a DOM target |

All projects are npm workspaces in the BokehJS repository. The framework test
matrix also copies these projects to an isolated directory, installs packed
BokehJS and adapter tarballs, and builds them there. This keeps the examples
readable while continuously checking that the published package shape works.
The browser smoke test also drives every range input and verifies that both the
page output and rendered Bokeh canvas change.

The local `file:` dependencies in these projects connect them to packages in
this repository. In an external application, install the corresponding
published packages from npm instead, for example
`npm install @bokeh/bokehjs @bokeh/react`.

After building BokehJS, run the Angular example locally with:

```bash
cd bokehjs/examples/frameworks/angular-ng
npm start
```
