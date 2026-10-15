# NIGHTSHIFT//OS — Design Spec

Date: 2026-10-15
Status: draft, awaiting review

## Purpose

A native desktop app (Tauri) that looks and feels like a fake cyberpunk
operating system — part Zachtronics' *Last Call BBS* dial-up board, part
Cyberpunk 2077 netrunner cyberdeck — that you actually code in every day.
Real shells, real files, real git, real system data, wrapped in a
fantasy of ICE, daemons, fixers and eddies.

**Success looks like:** you launch `nightshift`, jack in through (or skip) a
modem boot and breach, and then do a normal coding session — edit files, run
`git`, run `claude`, run tests — without ever needing to leave the app, while
the OS makes it feel like a netrun.

**Non-goals (v1):** LSP / autocomplete, debugger, third-party plugins, remote
machines, Windows/macOS packaging. Linux (Arch + Hyprland) only.

## Ground rules

1. **Everything is an app.** Every feature is a launchable window with an
   icon, a name, a category and a hotkey. Only a few things are system-wide
   *modes* (listed in "System layer"), and each of those also has an app for
   configuring it.
2. **Real underneath.** Every hacking effect is either a cyberpunk skin over
   a real action/data on your own machine, or clearly decorative.
3. **Never touch other people's machines.** No port scanning, probing or
   attacking other hosts. Network apps read your own machine's state or talk
   to URLs you explicitly type.
4. **Original names and art.** Inspired by Cyberpunk 2077 / Last Call BBS;
   no copied assets, logos or text.
5. **Destructive actions confirm.** Anything that kills, deletes, stashes,
   rewrites or changes system config asks first, in-world.

## Stack

- **Tauri 2** shell, Rust backend in `src-tauri/`.
- **Frontend:** Vite + plain TypeScript, no UI framework. Hand-written window
  manager and app framework.
- **Terminal:** xterm.js (+ fit, search, web-links addons).
- **Editor:** CodeMirror 6 with TS/JS, Rust, Python, HTML, CSS, JSON,
  Markdown, YAML, TOML, Shell.
- **Graphics:** Canvas 2D for most visualizations; WebGL (raw, no library)
  only for NET MAP.
- **Rust crates:** `portable-pty`, `sysinfo`, `notify`, `ignore`, `serde` /
  `serde_json`, `age`, `reqwest` (UPLINK, NIGHT NEWS), `sha2` / `base64` /
  `hex` (DECRYPTOR). System tools invoked as CLIs when present: `git`, `rg`,
  `gh`, `ss`, `ip`, `nmcli`, `ufw`, `journalctl`, `docker`, `nvidia-smi`,
  `traceroute`. Missing tool → app shows `MODULE NOT INSTALLED` with the
  package name instead of crashing.

## Architecture

```
src-tauri/src/
  main.rs        Tauri setup, command registration
  pty.rs         spawn / write / resize / kill; output streamed as events
  fs.rs          list / read / write / rename / delete inside workspace root
  search.rs      fuzzy file list + content search (ripgrep)
  git.rs         status, branch, log, stage, commit, stash (git CLI)
  jobs.rs        detect + run project tasks (package.json, Cargo, Makefile)
  sys.rs         CPU / RAM / disk / GPU / process snapshots, kill
  net.rs         ss, ip neigh, nmcli, traceroute, ufw status (read-only)
  tools.rs       hashing, encoding, encryption, HTTP requests
  logs.rs        journalctl / file tail streams
  watch.rs       daemon runtime: file watchers that trigger jobs
  state.rs       ~/.config/nightshift/ load/save
src/
  main.ts        boot → breach → login → desktop
  kernel/        app registry, event bus, permissions/confirm dialogs,
                 notifications, eddies ledger
  wm/            windows, focus, drag/resize, snap, nodes, taskbar, desktop
                 icons, JACK menu
  apps/<id>/     one folder per app; each exports an AppManifest + open()
  system/        overlay modes: scan mode, quickhack wheel, glitch fx,
                 screensaver, sysop pop-ups
  fx/            CRT shader (CSS), themes, WebAudio sfx + synth
  ipc.ts         typed wrappers around Tauri invoke/listen
```

### App framework

```ts
interface AppManifest {
  id: string            // 'term', 'icebreak', ...
  name: string          // 'TERM'
  glyph: string         // 2-3 char ASCII icon, e.g. '>_'
  category: 'core' | 'netrun' | 'tools' | 'system' | 'street' | 'doors'
  hotkey?: string       // e.g. 'Ctrl+Alt+T'
  multi: boolean        // can open several windows
  needs?: string[]      // CLI tools; missing → MODULE NOT INSTALLED
  open(ctx: AppContext, args?: unknown): AppWindow
}
```

- `AppContext` gives each app: `ipc`, `bus`, `notify()`, `confirm()`,
  `eddies.earn()`, `theme`, and a per-app settings store.
- Apps never import each other; they talk through `bus` events
  (`file:open`, `job:run`, `job:done`, `git:changed`, `gig:new`, ...).
- Launch surfaces, all fed by the registry: desktop icons, **JACK menu**
  (start menu grouped by category), BBS main menu, SYSOP CMD palette,
  hotkeys.

**Workspace root:** fs/search/git/jobs/watch commands are scoped to one opened
folder. `fs.rs` canonicalizes paths and rejects anything outside the root.
Terminals are real shells (not sandboxed) and start in the root.

## App catalog

### CORE — real coding

| App | What it is |
|---|---|
| **TERM** `>_` | Real `$SHELL` in a PTY. Multiple windows, split panes, scrollback search, clickable links, copy/paste. |
| **EDIT** `{}` | Code editor: file tree, tabs, split view, find/replace, Ctrl+S, dirty markers, reload-on-external-change prompt, live markdown preview. |
| **CONSTRUCT** `AI` | TERM preset that launches `claude` in the workspace, framed as a jacked-in AI construct with a pulsing engram border. |
| **SCAN** `?/` | Ctrl+P fuzzy file open; Ctrl+Shift+S project-wide search, results open EDIT at the line. |
| **NETWATCH** `<>` | Git: branch, ahead/behind, changed files, diff viewer, stage/unstage, commit, recent log, branch switcher. |
| **JOBS** `!!` | Auto-detected npm/cargo/make tasks; runs them in TERM panes with pass/fail status lights and run history. |
| **OPTICS** `()` | Built-in browser window for `localhost` dev servers and docs (Tauri webview), with HUD frame and reload hotkey. |

### NETRUN — cyberdeck apps

| App | What it is |
|---|---|
| **ICEBREAK** `1C` | Code-matrix breach game: hex grid, alternating row/column picks, buffer, 1–3 daemon sequences, timer. Daily breach + endless mode; difficulty scales with street cred. Optional boot jack-in gate. |
| **QUICKHACK** `QH` | Deck loadout: choose which quickhacks are on your wheel, see RAM costs, cooldowns and usage stats. (The wheel itself is a system overlay.) |
| **DAEMONS** `Dm` | Upload / kill background watchers: test-on-save, lint-on-save, auto git fetch, TODO watcher, build-on-save, custom "on change of glob X run command Y". Live status + log per daemon. |
| **GIGS** `$$` | Fixer contracts generated from `TODO`/`FIXME`/`HACK` in the repo and GitHub issues (`gh`). Payout in eddies; removing the TODO / closing the issue completes the gig. Holocall animation for new gigs. |
| **CYBERDECK** `[#]` | Your machine as a deck: CPU core clock/temp, RAM slots, disk shards, battery, GPU (`nvidia-smi`), process list with SHORT CIRCUIT (kill, confirm). |
| **NET MAP** `/\` | WebGL wireframe cyberspace of the project: dirs as subnets, files as nodes sized by lines, git-hot files glowing, branches as routes. Fly-through camera; click to open. |
| **SUBNET** `::` | Read-only own-network view: listening ports as access points, active connections as data streams, ARP-table neighbors as passive nodes. |
| **TRACEROUTE** `~>` | Type a host → animated hop map with latency per hop and a "trace" path across a fake city grid. |
| **SIGNAL** `))` | Wi-Fi radar: nearby networks from `nmcli` as blips by signal strength, channel, security. Read-only. |
| **BLACKWALL** `##` | Your firewall (`ufw status`) rendered as a wall of ICE with rule bricks. Read-only by default; edits run `pkexec ufw ...` after confirm. |
| **BRAINDANCE** `BD` | Record TERM sessions with timing; replay with scrubbable timeline, speed control, input/output layers. Export as asciicast. |
| **SHARDS** `<|>` | Encrypt/decrypt files with a passphrase (`age`), packing animation into a data shard. |
| **HEXVIEW** `0x` | Hex/ASCII viewer for any file, glitchy scrubber, jump-to-offset, highlight selection as int/float/string. |
| **OVERCLOCK** `>>>` | Hacker-typer: mash keys, it types real code from your repo fullscreen with scrolling hex side panels. For streams. |
| **TRACE LOG** `T!` | History of NetWatch trace runs: each long task's time vs trace limit, evasions, best times. |

### TOOLS — dev utilities, cyberpunk-skinned

| App | What it is |
|---|---|
| **DECRYPTOR** `#?` | Base64/hex/URL encode-decode, SHA-1/256/512 and MD5 hashes, JWT decoder, UUID and password generator, Unix-time converter. |
| **PATTERN ICE** `.*` | Regex tester: live matches, capture groups, replace preview, flags. |
| **UPLINK** `=>` | HTTP client: method, URL, headers, body, saved requests, response viewer with timing. Only URLs you enter. |
| **DATASTREAM** `[]` | JSON/YAML/TOML viewer: collapsible tree, path query, pretty/minify, diff two documents. |
| **RELAY** `@` | SSH launcher from `~/.ssh/config`: pick a host → opens TERM running `ssh host`, with a "secure relay" connect animation. |
| **BIOCHIP** `$E` | `.env` manager for the workspace: list vars with values masked, reveal on click, edit, compare with `.env.example`. |
| **CACHE** `C:` | Clipboard history (in-app copies + system clipboard polling), pin, search, re-copy. |
| **SNIPLIB** `</>` | Snippet library: save code snippets with tags, insert into EDIT or TERM. |
| **BLACKBOX** `LOG` | Log tail: `journalctl -f` (unit filter) or any log file, with level highlighting, filter, pause. |
| **SAFEHOUSES** `[D]` | Docker containers/images: status, start/stop/restart (confirm), logs into BLACKBOX, shell into TERM. |

### SYSTEM — the OS itself

| App | What it is |
|---|---|
| **SYSOP CMD** `>` | Ctrl+K palette for every app and action, styled `SYSOP> _`. |
| **JACK** `JK` | Start menu: apps by category, recent files, workspace switcher, logout ("Goodbye"). |
| **RIPPERDOC** `+` | Settings as a cyberware body scan: Optics (CRT/glitch/theme), Audio Cortex (sound/radio), Neural Link (keybindings), Kiroshi (scan mode), OS (boot, nodes, sysop). |
| **NODES** `1234` | Overview of the 4 virtual desktops with live thumbnails; drag windows between them. |
| **NOTIFY** `!` | Notification center: daemon alerts, job results, gigs, sysop messages, with history. |
| **FILES** `/` | File manager for the workspace: grid/list, rename, move, delete (confirm), new file/folder. |

### STREET — your identity and the world

| App | What it is |
|---|---|
| **PROFILE** `ID` | Your netrunner ID card: handle, street cred level, eddies, achievements, coding stats (commits, saves, jobs, gigs, hours jacked in). |
| **AGENT** `Ag` | Phone-style hub: contacts (sysop, fixer, ripperdoc, a rival netrunner), message threads mixing lore with reactions to your real activity. |
| **MESSAGES** `Ms` | BBS message board: fake lore threads plus your real notes/todo (markdown, saved to config dir). |
| **NIGHT NEWS** `N` | News ticker app: in-world fake headlines + real RSS feeds you configure (e.g. HN), shown as a scrolling broadcast. |
| **SHIFT** `:30` | Pomodoro focus timer; sysop calls break time; tracks focus streaks. |
| **RADIO** `~~` | Generative synthwave/chiptune stations (WebAudio), plus a local music folder player, with a visualizer. |
| **VENDOR** `VD` | Spend eddies on cosmetics: themes, window chrome, boot screens, cursor trails, ICEBREAK skins. |

### DOORS — BBS door games

| App | What it is |
|---|---|
| **DATA WORM** `~o` | Snake in a data grid; eat packets, avoid ICE. |
| **ICEBREAK** | Also listed here (it's the main game). |
| **NETRUN DEFENSE** `TD` | Tiny tower defense: place ICE programs to stop intrusion packets crawling toward your core. |
| **TYPE BREACH** `Ty` | Typing-speed game using real code lines from your repo; WPM feeds street cred. |

## System layer (overlay modes)

These are global, not windows; each is configured in RIPPERDOC or its app.

- **Boot:** BIOS POST → modem handshake (synthesized) → optional ICEBREAK
  jack-in → BBS ANSI title → login. Esc skips; can be disabled.
- **Window manager:** drag, resize, min/max/close, box-drawing frames, snap
  with Super+arrows, tile-all, desktop icons, taskbar with node lights,
  clock, CPU/RAM blips, git branch, running daemons, trace meter.
- **Nodes:** 4 virtual desktops, Ctrl+1..4.
- **SCAN MODE (hold Alt):** desaturate + glitch; every window gets a HUD tag
  with real data (PID/cwd/command for TERM, size/language/last author for
  EDIT, etc.); corner reticles.
- **QUICKHACK wheel (Ctrl+Q / right-click title bar):** real actions with a
  regenerating fake RAM cost — `SHORT CIRCUIT` (kill foreground process),
  `PING` (highlight related windows), `REBOOT OPTICS` (clear terminal),
  `SYSTEM RESET` (`git stash`), `OVERHEAT` (run tests), `CONTAGION`
  (project search-and-replace with preview), `MEMORY WIPE` (close clean
  windows). Upload progress bar + glitch on hit.
- **TRACE meter:** long jobs fill a NetWatch trace bar; finishing first =
  "trace evaded" bonus eddies.
- **Eddies & street cred:** ledger in `kernel/`; earned from commits,
  passing jobs, gigs, door games, focus streaks; spent in VENDOR.
- **Sysop pop-ups:** in-world messages reacting to real events. Toggleable.
- **Glitch FX kit:** chromatic aberration, RGB split, datamosh transitions,
  scanline tearing on errors, "relic malfunction" easter egg after 3 a.m.
- **CRT:** scanlines, glow, curvature, flicker; intensity slider, off switch.
- **Themes:** Green phosphor, Amber, Neon magenta, Last Call purple/cyan,
  NIGHT CITY yellow/red/cyan, Day shift (low glare). Each themes chrome,
  xterm and CodeMirror together.
- **Sound:** keyclicks (opt.), blips, error buzz, modem, quickhack uploads —
  all synthesized. Master mute.
- **Screensaver:** starfield / falling glyphs / `NO CARRIER` bounce.
- **Persistence:** windows per node, open files, theme, workspace restored.

## Data & persistence

All under `~/.config/nightshift/`:

- `state.json` — theme, fx, login handle, workspace, layouts, open files
- `apps/<id>.json` — per-app settings (saved requests, daemons, feeds, ...)
- `notes/*.md` — MESSAGES notes
- `snippets/*.json` — SNIPLIB
- `bd/*.cast` — BRAINDANCE recordings
- `ledger.json` — eddies, street cred, achievements, stats

Corrupt or missing file → defaults + a NOTIFY warning; never crash.

## Error handling

- Failed IPC → in-world **SYSTEM FAULT** dialog with the real error text,
  OK / copy details.
- PTY exit → `NO CARRIER (exit N)` with [R]econnect.
- Missing CLI tool → `MODULE NOT INSTALLED: <pkg>` in the app window.
- Save conflicts → overwrite / reload / diff choice.
- Path outside workspace root → rejected in Rust.
- Privileged actions (BLACKWALL edits) → `pkexec`, after confirm; denial is
  shown, not retried.

## Testing

- **Rust unit tests:** path guard; PTY echo round-trip; git status/log
  parsing; job detection fixtures; TODO→gig extraction; `ss`/`ip neigh`/
  `nmcli`/`ufw` output parsers (fixture text); DECRYPTOR functions; `age`
  round-trip; corrupt state loading.
- **Frontend unit tests (Vitest):** app registry + launch surfaces, WM focus
  / snap / nodes, palette fuzzy match, bus, eddies ledger rules, ICEBREAK
  puzzle generator always solvable, quickhack RAM regen.
- **Manual smoke test per milestone** (listed in the plan).

## Milestones

The catalog is ~50 apps — too big for one plan. Each milestone gets its own
implementation plan and is usable on its own.

1. **Jack in (usable core):** Tauri scaffold, app framework, WM, nodes,
   taskbar, JACK menu, TERM, EDIT, FILES, SCAN, SYSOP CMD, persistence,
   `nightshift` launcher + `.desktop`.
2. **Look & feel:** themes, CRT, glitch kit, sound, boot, BBS menu,
   RIPPERDOC, NOTIFY, screensaver.
3. **Dev flow:** NETWATCH, JOBS, CONSTRUCT, OPTICS, DAEMONS, TRACE meter +
   TRACE LOG.
4. **Netrunner core:** SCAN MODE, QUICKHACK wheel + app, ICEBREAK,
   CYBERDECK, eddies/street cred, PROFILE, GIGS.
5. **Network:** SUBNET, TRACEROUTE, SIGNAL, BLACKWALL, NET MAP.
6. **Tools:** DECRYPTOR, PATTERN ICE, UPLINK, DATASTREAM, RELAY, BIOCHIP,
   CACHE, SNIPLIB, BLACKBOX, SAFEHOUSES, HEXVIEW, SHARDS.
7. **Street & doors:** AGENT, MESSAGES, NIGHT NEWS, SHIFT, RADIO, VENDOR,
   BRAINDANCE, OVERCLOCK, DATA WORM, NETRUN DEFENSE, TYPE BREACH.

## Prerequisite

`/home` has ~3 GB free; a Tauri build needs ~2–4 GB for `target/`. Space must
be freed before milestone 1 builds.
