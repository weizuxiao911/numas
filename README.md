<h1 align="center">Numas · 牛马 AI</h1>
<p align="center">Your cyber workhorse 🐮</p>
<p align="center">
  English | <a href="README.zh.md">简体中文</a>
</p>

---

Numas is a locally-run AI workbench for coding and everyday tasks, made of three parts:

- **opencode engine** — the AI agent runtime (tool calls / sessions / model & provider integration); CLI name is `numas`
- **codeblitz IDE** — the browser workbench (editor / terminal / extension market)
- **Desktop shell** — a macOS app (lives in the tray, hosts the local server)

Runs locally by default — your files and data stay on your machine.

---

## Install

### Desktop (macOS)

Download `numas-darwin-arm64.dmg` from [Releases](https://github.com/weizuxiao911/numas/releases/latest) and drag it into `Applications`.

Or install with the script (kills old processes → installs → clears quarantine → launches):

```bash
bash packages/tauri/scripts/install-macos.sh <numas_x.y.z_arch.dmg>
```

The `numas` CLI is symlinked to `~/.local/bin/numas` after install.

### CLI

```bash
numas            # start the TUI (terminal UI) by default
numas web        # start the server and open the web workbench
numas serve      # start the local server only (headless)
```

> The CLI binary ships inside the desktop app (`numas.app/Contents/MacOS/numas`); you can also build it from source.

### Build from source

```bash
cd packages/opencode && bun run build --single   # build the numas CLI (embeds codeblitz)
cd packages/tauri    && bun run build            # package the desktop shell (syncs the sidecar)
```

See [`packages/tauri/README.md`](packages/tauri/README.md) for details.

---

## Agents

Two built-in agents, switch with `Tab`:

- **build** — default, full access, for development work
- **plan** — read-only, for analysis and planning (denies edits by default, asks before running bash)

Plus a **general** subagent for complex search and multi-step tasks — invoke with `@general`.

---

## Repository

- GitHub: <https://github.com/weizuxiao911/numas>

## Credits

Numas is built on the open-source project [opencode](https://github.com/anomalyco/opencode).
