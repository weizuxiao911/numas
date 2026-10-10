<h1 align="center">Numas · 牛马 AI</h1>
<p align="center">Your cyber workhorse 🐮</p>
<p align="center">
  English | <a href="README.zh.md">简体中文</a>
</p>

---

Numas is a locally-run AI workbench for coding and everyday tasks, made of three parts:

- **opencode engine** — the AI agent runtime (tool calls / sessions / model & provider integration); CLI name is `numas`
- **webapp IDE** — the browser workbench (editor / terminal / extension market)
- **Desktop shell** — a macOS app (lives in the tray, hosts the local server)

Runs locally by default — your files and data stay on your machine. It also supports split deployment (UI in the cloud, connecting directly to the numas running on the visitor's own machine).

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
cd packages/opencode && bun run build --single   # build the numas CLI (embeds webapp)
cd packages/tauri    && bun run build            # package the desktop shell (syncs the sidecar)
```

See [`packages/tauri/README.md`](packages/tauri/README.md) for details.

### Split deployment (UI in the cloud)

Serve the UI as static files while it connects directly to the **visitor's own** numas:

```bash
cd packages/webapp && npm run build:site        # output in packages/webapp/site/
```

- Put `site/` on nginx at the **domain root** with SPA fallback `try_files $uri /index.html;`
- The page connects to the visitor's local numas via the build-time `APP_BASE_URL` (default `http://127.0.0.1:24096`)
- The local numas must be running and allow cross-origin (`numas` / `numas serve` default to `--cors *`, and handle the Chrome Private Network Access preflight)

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
