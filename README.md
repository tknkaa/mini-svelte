# Build your own Svelte

Welcome!

Here are the source files for the [video "Build your own Svelte"](https://www.youtube.com/watch?v=mwvyKGw2CzU).

## Getting started

Requires Node.js 22.18+ (runs TypeScript directly) and [pnpm](https://pnpm.io/).

```sh
pnpm install
pnpm dev        # http://localhost:8000
```

`pnpm dev` compiles `app.svelte` into `app.js` (client) and `ssr.js` (server), serves the page with server-side rendering, and hot-reloads on every change to `app.svelte` while keeping the component state.

Other scripts:

```sh
pnpm build      # compile app.svelte once (writes app.js and ssr.js)
pnpm typecheck  # type-check src/ with tsc
```

## Project layout

```
app.svelte          the component to compile
src/compiler/       parse -> analyse -> generate (DOM / SSR)
src/build.ts        writes app.js and ssr.js
src/server.ts       dev server (SSR + WebSocket HMR)
```

## Follow ups

Here are the series of follow up videos, and the source code for them in respective branches:

| Video | Branch |
|-------|--------|
| [Build your own Svelte](https://youtu.be/mwvyKGw2CzU) | [the-original-1](https://github.com/tanhauhau/mini-svelte/tree/the-original-1) |
| [Making it complete: support more expressions](https://youtu.be/5zR1F7NiLUU) | [follow-up-2](https://github.com/tanhauhau/mini-svelte/tree/follow-up-2) |
| [Adding Reactive Declarations into our mini Svelte](https://youtu.be/dTPW0zwibHc) | [reactive-declaration-3](https://github.com/tanhauhau/mini-svelte/tree/reactive-declaration-3) |
| [Server-side Rendering](https://youtu.be/5aunM7q8Ykc) | [server-side-rendering-4](https://github.com/tanhauhau/mini-svelte/tree/server-side-rendering-4) |
| [Hydration = SSR + CSR](https://youtu.be/LsKDzGHinSo) | [hydration-5](https://github.com/tanhauhau/mini-svelte/tree/hydration-5) |
