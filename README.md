# Spellstorm — Android, Windows & Linux (Steam Deck) builds

This repo turns the Spellstorm web game (`www/index.html`) into an installable **Android APK**,
a **Windows `.exe`** and a **Linux `.AppImage`** (for the Steam Deck). GitHub builds them automatically; nothing needs to be installed on your computer.

## Getting the latest build

Open the **Releases** page of this repo (right-hand sidebar → Releases). The newest release has:

- **Spellstorm.apk** — Android. Download it on your phone (or copy it over), tap it, allow installs from that source, then **Install**.
  New versions install over the old one and keep your stats and achievements.
- **Spellstorm.exe** — Windows. Double-click to play; no installer. The first time, Windows may say
  "Windows protected your PC": click **More info → Run anyway**. F11 toggles fullscreen.

- **Spellstorm.AppImage** — Linux and Steam Deck. See *Steam Deck* below.

Each release is numbered (Spellstorm 1.0.N, and every file name has the number in it) so you can tell versions apart.

## Controllers

Every version plays with a controller: the Steam Deck's own controls, Xbox and PlayStation controllers,
and Android handhelds' built-in controls. Press any button and a highlight appears; D-pad or left stick moves it,
**A** selects or plays a card, **B** goes back, **Y** looks at a card, **X** asks for an Expert tip, **LB/RB** switch tabs
(or rounds in a replay), **Start** opens the menu, **View/Select** opens the battle log, the right stick scrolls.
Touching the screen or moving the mouse hides the highlight again. The keyboard works too: arrow keys move, Enter selects, Esc goes back or opens the menu, Space looks at a card,
T asks for a tip, Q/E switch tabs (or replay rounds), L opens the log. The on-screen prompts switch between
keyboard keys, Xbox and PlayStation symbols to match whatever you pressed last.
The same list is in the game under **Options → Controller**.

## Steam Deck

1. In **Desktop Mode**, download **Spellstorm-1.0.N.AppImage** (from itch.io or the Releases page).
2. Right-click it → **Properties → Permissions → Is executable**.
3. In Steam: **Games → Add a Non-Steam Game to My Library…**, pick the AppImage.
4. Back in **Gaming Mode**, launch it from your library. It opens fullscreen and uses the Deck's controls.
   Steam's default "Gamepad" controller layout is right; sign-in text fields can use the Steam on-screen keyboard (**Steam + X**).

(The Windows `.exe` also runs on the Deck through Proton, but the AppImage is the native version.)

## How updates work

Any change pushed to `main` (except README edits) runs **Actions → Build Spellstorm**, which:

1. builds the Android APK, the Linux AppImage (Linux runners) and the Windows exe (Windows runner) in parallel, then
2. publishes them as a new release and uploads them (plus the browser version) to itch.io.

Starting **Run workflow** on a branch other than `main` only builds (a test build: no release, no upload).

Usually the only file that changes is `www/index.html` (the game itself). You can also start a build by hand:
**Actions → Build Spellstorm → Run workflow**. A build takes about 5–7 minutes.

## What's in here

| Path | Purpose |
|---|---|
| `www/index.html` | The whole game (engine, UI, card art, fonts) in one file |
| `package.json`, `capacitor.config.json` | Android app setup (Capacitor) |
| `branding/res/` | Android icons, splash screens and theme colors |
| `branding/debug.keystore` | Signing key, so new APKs install over old ones. Keep it in the repo. |
| `branding/java/MainActivity.java` | Android: passes controller buttons and sticks to the game |
| `desktop/` | Windows and Linux app setup (Electron): window, icon, F11 fullscreen, fullscreen on Steam Deck |
| `.github/workflows/build.yml` | The build script |

If a build fails (red X in Actions), open the failed step and send the error text to Claude.

## Source code

The full source (rules engine, AI, interface, card art, fonts, automated tests and a build script) is in [`source/`](source/). See `source/README.md` to build or test it on your own machine. Only changes to `www/index.html` trigger new app builds.
