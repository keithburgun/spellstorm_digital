# Spellstorm — Android APK build

This folder turns the Spellstorm web game into an installable Android app (APK).
GitHub builds it for you on its free servers, so you don't need Android Studio or Java.

## One-time setup (about 10 minutes)

1. **Make a GitHub account** at https://github.com if you don't have one.
2. **Create a repository:** click **+** (top right) → **New repository**. Name it `spellstorm-android`.
   Choose **Private** if you like. Click **Create repository**.
3. **Upload the files:** on the new repo page click **uploading an existing file**.
   Drag in everything from this folder **except the `.github` folder** (Mac hides it anyway):
   `www`, `branding`, `package.json`, `package-lock.json`, `capacitor.config.json`, `README.md`, `build-apk.yml`.
   Click **Commit changes**.
4. **Add the build script:** click **Add file → Create new file**. For the name, type exactly:
   `.github/workflows/build-apk.yml`
   Open `build-apk.yml` from this folder in any text editor, copy everything, paste it into the big box,
   and click **Commit changes**. This starts the first build automatically.

## Getting the APK (every build)

1. In your repo, click the **Actions** tab. You'll see **Build Spellstorm APK** running (yellow dot).
   It takes about 4–6 minutes. When it shows a green check, click it.
2. Scroll to **Artifacts** and click **Spellstorm-APK** to download a zip. Unzip it to get `Spellstorm.apk`.
3. Put `Spellstorm.apk` on your phone (email it to yourself, Google Drive, USB cable — anything).
4. Tap it on the phone. Android will ask you to allow installing apps from that source
   (Files, Chrome or Drive): allow it, then tap **Install**.

## Updating the game later

Replace `www/index.html` in the repo with a newer version (open the file on GitHub → pencil/upload),
commit, and a new APK builds automatically. Because every build uses the same signing key
(`branding/debug.keystore`), new versions install **over** the old one and your stats and achievements are kept.
You can also start a build by hand: **Actions → Build Spellstorm APK → Run workflow**.

## Notes

- The app works offline. Stats and achievements are stored on the phone.
- Android's Back button closes menus, goes back to the title screen, and exits from the title screen. **Exit** quits the app.
- Works on Android 7.0 and newer.
- If a build fails (red X), click into it, open the failed step, and copy the error text back to Claude.
