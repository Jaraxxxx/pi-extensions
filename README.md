# pi-extensions 🧩

A comprehensive collection of extensions for [pi](https://github.com/earendil-works/pi) — the coding agent.

**One install, ten extensions.** Individual extensions are also available as standalone packages.

## Quick Start

```bash
# Install everything
pi install github:Jaraxxxx/pi-extensions

# Or individual extensions
pi install github:Jaraxxxx/pi-token-guard
pi install github:Jaraxxxx/pi-system-context
```

## Extensions

| Icon | Extension | What it does |
|------|-----------|-------------|
| 🛡️ | **pi-token-guard** | Context usage bar with warnings. Never hit context limits silently again. |
| 🔬 | **pi-system-context** | Tells the LLM about your OS, git branch, shell, runtime. Better answers. |
| ⏱️ | **pi-tool-profiler** | Per-tool latency and call count stats. Know what's slow. |
| 📦 | **pi-project-detector** | Auto-detects Next.js, Rust, Python, Go. LLM uses correct conventions. |
| 🔒 | **pi-dirty-guard** | Warns about uncommitted git changes before the LLM edits files. |
| 🚫 | **pi-permission-gate** | Blocks dangerous commands (`rm -rf`, `.env` access, credential leaks). |
| 📋 | **pi-prompt-customizer** | Per-project `.pi/guidelines.md` that injects custom system instructions. |
| 💾 | **pi-auto-commit** | Git checkpoint after every turn. Roll back anything. |
| ⏳ | **pi-turn-clock** | Session timer, turn counter, cost estimator in footer. |
| 🌲 | **pi-branch-navigator** | Visualize session tree branches. Never lose a fork. |

## Architecture

```
pi-extensions/
├── index.ts                    # Extension manager — loads all sub-extensions
├── package.json
└── extensions/
    ├── pi-token-guard/
    │   ├── index.ts
    │   └── package.json
    ├── pi-system-context/
    │   ├── index.ts
    │   └── package.json
    ├── pi-tool-profiler/
    ├── pi-project-detector/
    ├── pi-dirty-guard/
    ├── pi-permission-gate/
    ├── pi-prompt-customizer/
    ├── pi-auto-commit/
    ├── pi-turn-clock/
    └── pi-branch-navigator/
```

The manager (`index.ts`) auto-discovers and loads all extensions. Each sub-extension is self-contained and installable standalone.

## Commands

```
/extensions                    List all extensions and their status
/ext:toggle <name>             Enable/disable an extension
/ext:enable <name>             Enable an extension
/ext:disable <name>            Disable an extension
/ext:reload                    Reload all extensions
```

## Requirements

- pi >= 0.75.4

## License

MIT