# Spellstorm — Android & Windows builds

This repo turns the Spellstorm web game (`www/index.html`) into an installable **Android APK**
and a **Windows `.exe`**. GitHub builds both automatically; nothing needs to be installed on your computer.

## Getting the latest build

Open the **Releases** page of this repo (right-hand sidebar → Releases). The newest release has:

- **Spellstorm.apk** — Android. Download it on your phone (or copy it over), tap it, allow installs from that source, then **Install**.
  New versions install over the old one and keep your stats and achievements.
- **Spellstorm.exe** — Windows. Double-click to play; no installer. The first time, Windows may say
  "Windows protected your PC": click **More info → Run anyway**. F11 toggles fullscreen.

Each release is numbered (Spellstorm 1.0.N) so you can tell versions apart.

## How updates work

Any change pushed to `main` (except README edits) runs **Actions → Build Spellstorm**, which:

1. builds the Android APK (Linux runner) and the Windows exe (Windows runner) in parallel, then
2. publishes both files as a new release.

Usually the only file that changes is `www/index.html` (the game itself). You can also start a build by hand:
**Actions → Build Spellstorm → Run workflow**. A build takes about 5–7 minutes.

## What's in here

| Path | Purpose |
|---|---|
| `www/index.html` | The whole game (engine, UI, card art, fonts) in one file |
| `package.json`, `capacitor.config.json` | Android app setup (Capacitor) |
| `branding/res/` | Android icons, splash screens and theme colors |
| `branding/debug.keystore` | Signing key, so new APKs install over old ones. Keep it in the repo. |
| `desktop/` | Windows app setup (Electron): window, icon, F11 fullscreen |
| `.github/workflows/build.yml` | The build script |

If a build fails (red X in Actions), open the failed step and send the error text to Claude.
