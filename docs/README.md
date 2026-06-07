# Rune Documentation

In-depth guides that go beyond the [project README](../README.md).

## Getting Started

| Guide | What's inside |
|---|---|
| **[Installation & Setup](./installation.md)** | Install + per-stack setup (Vite/webpack/Rollup/esbuild, plain HTML/CDN, React/Next.js, Vue, Svelte, Angular, web component), enabling collaboration, and troubleshooting |

## Collaborative Editing

Real-time, multi-user editing built on Yjs CRDTs (opt-in, in `collab/`).

| Guide | What's inside |
|---|---|
| **[Collaboration overview](./collaboration.md)** | What you get, quick start, the live demo, architecture, the document model, every feature in depth, testing, and limitations |
| **[API reference](./collaboration-api.md)** | Every `collab/` module — transport, binding, schema, presence, comments, suggestions, persistence — with signatures and examples |
| **[Server & deployment](./collaboration-server.md)** | Running the reference sync server, the wire protocol, the `authorize()` auth hook, persistence options, and going to production |

> New here? Start with the [overview](./collaboration.md), then the
> [API reference](./collaboration-api.md) when you're wiring it up.
