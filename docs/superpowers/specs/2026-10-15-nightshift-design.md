# NIGHTSHIFT//OS — Design Spec

Date: 2026-10-15
Status: draft, awaiting review

## Purpose

A native desktop app (Tauri) that looks and feels like a fake cyberpunk
operating system in the style of Zachtronics' *Last Call BBS*, but that you
actually code in every day. Real shells, real files, real git — wrapped in a
dial-up BBS fantasy.

**Success looks like:** you launch `nightshift`, sit through (or skip) a modem
boot, and then do a normal coding session — edit files, run `git`, run
`claude`, run tests — without ever needing to leave the app.

**Non-goals (v1):** LSP / autocomplete, debugger, extensions/plugins, remote
machines, Windows/macOS packaging. Linux (Arch + Hyprland) only.

## Stack

- **Tauri 2** shell, Rust backend in `src-tauri/`.
- **Frontend:** Vite + plain TypeScript, no UI framework. Small hand-written
  window manager.
- **Terminal:** xterm.js (+ fit, search, web-links addons).
- **Editor:** CodeMirror 6 with language packs for TS/JS, Rust, Python, HTML,
  CSS, JSON, Markdown.
- **Rust crates:** `portable-pty` (shells), `sysinfo` (system monitor),
  `notify` (file watching), `ignore` + `grep` crates or shelling out to `rg`
  (search), `serde`/`serde_json`.

## Architecture

```
src-tauri/src/
  main.rs        Tauri setup, command registration
  pty.rs         spawn / write / resize / kill; output streamed as events
  fs.rs          list / read / write / rename / delete inside workspace root
  search.rs      fuzzy file list + content search (ripgrep)
  git.rs         status, branch, ahead/behind, recent log (via `git` CLI)
  jobs.rs        detect + run project tasks (package.json, Cargo, Makefile)
  sys.rs         CPU / RAM / disk / process list snapshots
  state.rs       load/save ~/.config/nightshift/state.json
src/
  main.ts        boot → login → desktop
  wm/            window manager: create, focus, drag, resize, snap, minimize,
                 virtual desktops, taskbar
  apps/          one folder per app (see Features), each exports
                 `open(opts): AppWindow`
  fx/            CRT shader (CSS), themes, WebAudio sfx + music synth
  bbs/           ANSI menu renderer, lore text, sysop messages
  ipc.ts         typed wrappers around Tauri invoke/listen
```

Each app talks to Rust only through `ipc.ts`. Apps do not know about each
other; they communicate through a tiny event bus (`bus.emit('file:open', path)`)
so, e.g., the file finder can ask the editor to open a file.

**Workspace root:** all fs/search/git/jobs commands are scoped to one opened
folder. `fs.rs` canonicalizes paths and rejects anything outside the root.
Terminals are not sandboxed (they're your real shell) but start in the root.

## Features

### Core (the "real coding" part)

1. **TERM — terminal windows.** Real `$SHELL` in a PTY. Multiple windows,
   split panes (horizontal/vertical) inside one window, scrollback search
   (Ctrl+Shift+F), clickable links, copy/paste.
2. **EDIT — code editor.** File tree sidebar, tabs, split view, syntax
   highlighting, find/replace, Ctrl+S save, dirty markers, reload prompt when a
   file changes on disk (via `notify`).
3. **SYSOP CMD — command palette (Ctrl+K).** Fuzzy list of every action: open
   app, open file, run job, switch theme, switch desktop. Styled as a BBS
   prompt (`SYSOP> _`).
4. **SCAN — file finder & search.** Ctrl+P fuzzy file open; Ctrl+Shift+S
   project-wide text search with results that open in EDIT at the line.
5. **NETWATCH — git panel.** Branch, ahead/behind, changed files (click to
   open), recent commits. Stage/unstage/commit from the panel. Polls every few
   seconds and on save.
6. **JOBS — task runner.** Auto-detects `package.json` scripts, `cargo`
   targets, `Makefile` targets. One click runs the task in a new TERM pane;
   shows running/passed/failed status lights.
7. **CONSTRUCT — AI terminal.** A TERM preset that launches `claude` in the
   workspace root, framed as a jacked-in AI construct. (Just a terminal; no
   API integration.)
8. **Markdown preview.** Live side-by-side preview for `.md` files in EDIT.

### OS chrome

9. **Boot sequence.** BIOS POST text → modem dial tones/handshake (synthesized)
   → BBS ANSI title screen → login (any name; remembered). Esc skips;
   `boot: false` in config disables it.
10. **Window manager.** Drag, resize, minimize, maximize, close; DOS-style
    box-drawing frames; snap with Super+arrows; tile-all shortcut.
11. **Virtual desktops ("NODES").** 4 nodes, Ctrl+1..4 to switch; taskbar shows
    node lights.
12. **Taskbar.** Open windows, node lights, clock, CPU/RAM blips, git branch,
    shift timer.
13. **CRT effects.** Scanlines, phosphor glow, slight curvature/vignette,
    occasional flicker. Intensity slider; fully off for long sessions.
14. **Themes.** Green phosphor, amber, neon magenta, "Last Call" purple/cyan,
    and a low-glare "day shift". Applies to chrome, xterm palette, and
    CodeMirror theme together.
15. **Sound.** Keyclicks (optional), window open/close blips, error buzz, modem
    sounds — all WebAudio-synthesized, no asset files. Master mute.
16. **Screensaver.** After N idle minutes: starfield / falling glyphs / "NO
    CARRIER" bounce. Any key returns.
17. **Layout persistence.** Windows, nodes, open files, theme, last workspace
    restored on launch.

### BBS & flavor

18. **BBS main menu.** ANSI art launcher: `[T]erminal [E]dit [N]etwatch
    [J]obs [M]essages [D]oors [S]ettings [G]oodbye`. Hotkeys work.
19. **MESSAGES — message board.** Fake threads from other "users" with lore;
    plus your own real notes (create/edit, saved to config dir) — doubles as a
    scratchpad/todo list.
20. **SYSOP chat.** Occasional sysop pop-ups reacting to real events ("caught
    your commit, nice", "tests failing again, choom?"). Toggleable.
21. **CREDITS — achievements.** Earn BBS credits for real events: commits,
    saves, passing jobs, late-night sessions. Shown on your user profile.
22. **SHIFT timer.** Pomodoro-style focus timer; sysop calls break time.
23. **RADIO.** Generative ambient/chiptune synth loop (WebAudio), a few
    stations, volume knob.
24. **DOORS.** One small BBS door game (snake-like "DATA WORM") for breaks.
25. **SYSMON.** Real CPU / RAM / disk graphs and a process list, rendered as
    "ICE" intrusion meters.

## Data & persistence

- `~/.config/nightshift/state.json`: theme, fx settings, login name, last
  workspace, window layout per node, open files.
- `~/.config/nightshift/notes/*.md`: MESSAGES notes.
- `~/.config/nightshift/credits.json`: achievement counters.
- Corrupt or missing state → start fresh with defaults and log a warning.

## Error handling

- Any failed IPC call surfaces as an in-world **SYSTEM FAULT** dialog showing
  the real error text, with OK / copy-details.
- PTY exit shows `NO CARRIER (exit N)` in the pane with a [R]econnect key.
- Saving over a file changed on disk asks before overwriting.
- Path outside workspace root → rejected in Rust, never reaches disk.

## Testing

- **Rust unit tests:** path guard (`..`, symlinks, absolute paths); PTY spawn
  + echo round-trip; git status parsing; job detection on fixture projects;
  state load with corrupt JSON.
- **Frontend unit tests (Vitest):** window manager (focus order, snap math,
  node switching), command palette fuzzy match, event bus, credits rules.
- **Manual smoke test:** boot → login → open workspace → TERM `git status` →
  EDIT a file, save → NETWATCH shows it changed → JOBS runs a script → restart
  app and layout is restored.

## Build order (for the plan)

1. Tauri scaffold, `pty.rs` + TERM window, `fs.rs` + EDIT (usable core).
2. Window manager, taskbar, nodes, persistence.
3. Themes + CRT fx + sound, boot sequence, BBS menu.
4. SYSOP CMD, SCAN, NETWATCH, JOBS, CONSTRUCT, markdown preview.
5. Flavor: MESSAGES, sysop chat, CREDITS, SHIFT, RADIO, DOORS, SYSMON,
   screensaver.
6. `nightshift` launcher command + `.desktop` entry.

## Prerequisite

`/home` has ~3 GB free; a Tauri build needs ~2–4 GB for `target/`. Space must
be freed before step 1 builds.
