# PostCompass desktop app

The PostCompass app: a React UI (`src/`) running in a Tauri 2 shell with a Rust backend (`src-tauri/`).

From the repository root:

```bash
pnpm dev:desktop   # run the app with hot reload
pnpm build:app     # build installers for your current OS
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for prerequisites, architecture and the release process.

## Recommended IDE setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
