# NIGHTSHIFT//OS

A fake cyberpunk BBS operating system you actually code in. Tauri 2 + TypeScript.

## Run

    npm install
    WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri dev   # dev
    sh scripts/install.sh                                # release build + `nightshift` launcher

## Keys

| Key | Action |
|---|---|
| Ctrl+Shift+K | SYSOP CMD palette |
| Ctrl+Shift+P / Ctrl+Shift+S | find file / search text |
| Ctrl+Alt+T / E / F | TERM / EDIT / FILES |
| Ctrl+Alt+O | open workspace |
| Ctrl+Alt+1..4 | switch node (Shift: move window) |
| Ctrl+Alt+Arrows | snap window · Ctrl+Alt+G tile · Ctrl+Alt+W close · Ctrl+Alt+M minimize |
| Ctrl+Shift+F / C / V (in TERM) | find scrollback / copy / paste |

## Test

    npm test && (cd src-tauri && cargo test)
