# Spellstorm — source

Everything needed to build and test the game. The playable result is one self-contained HTML file.

## Layout

| File | What it is |
|---|---|
| `engine.js` | Core rules: cards, weather, rounds, battles, counters, the Blast, the Storm Cloud |
| `engine2.js` | The six later wizards (Abragail, Croh, Omar, Bunny, Oren, May), traps, potions, the Journal |
| `engine3.js` | Game-event hooks for stats and achievements, the Blast Score ceremony, “what changed” summaries |
| `engine4.js` | CPU players: Easy / Normal / Hard / Expert, strategic plans, randomness, Ultimate decisions |
| `engine5.js` | 3–4 player Free-for-All rules (elimination, next-clockwise countering, tiebreaks) |
| `engine6.js` | Robot Boy (single-player opponent) |
| `engine7.js` | Team modes: Co-op vs Robot Boy and Two-on-Two |
| `engine8.js` | Ranked: CPU ranks 1–10, the ten secret personalities, Elo, matchmaking, bot profiles |
| `engine9.js` | Puzzle Mode (fixed positions, scripted opponents, goals) and seeded randomness |
| `engine10.js` | Stronger Hard / Expert: solves the simultaneous reveal as a small game (payoff table + regret matching) |
| `puzzles.json` | The puzzles. Check any edit with `node tests/solve.js` (it must report at least one winning line) |
| `daily_challenges.txt` | The Daily Challenges, one block per day (format explained at the top of the file) |
| `template.html` | The interface: layout, styles, animation, sound, menus, stats, achievements, tutorial, saving |
| `imgs.json` | All card art and graphics as embedded images |
| `corporata.css`, `fonts/` | Fonts (Corporata is embedded; Atkinson Hyperlegible is the fallback for missing glyphs) |
| `native_hooks.html` | Android-only additions (real Exit button, Back button, app version) |
| `build.py` | Assembles everything into the final files |
| `tests/` | Automated tests (see below) |

## Build

    python3 build.py

Writes `dist/spellstorm.html` (web version; just open it in a browser) and `../www/index.html` (what the Android and Windows apps package). Needs Python 3.9+, nothing else.

Pushing a changed `www/index.html` to `main` makes GitHub build a new APK and Windows `.exe` automatically (see `.github/workflows/build.yml`). Changes that only touch `source/` do **not** trigger a build.

## Test

Engine tests need Node.js 18+ (run `python3 build.py` first; it writes `tests/eng_all.js`):

    cd tests
    node regress.js check 40     # replays 40 recorded 2-player games; must print "identical: 40/40"
    node test_n.js 4 10          # 10 four-player Free-for-All games
    node test_rb.js              # Robot Boy at all three levels vs every wizard
    node test_team.js            # Co-op and Two-on-Two
    node test7.js                # save a match mid-game, reload it, finish it
    node test6.js normal hard 20 # AI difficulty ladder (Hard should beat Normal)
    node test_rank.js            # Ranked: every personality at several ranks, plus a rank ladder check
    node test_long.js            # Long Match: nobody wins below 12 Storm Shards
    node solve.js                # solves every puzzle; each must have at least one winning line
    node ab.js hard 40           # new Hard vs old Hard (MX=mix|br picks the variant); expect the new one to win more

If you intentionally change rules, re-record the 2-player baseline with `node regress.js record 40`.

Browser tests (layout at ten screen sizes, no overlaps or cut-off cards) use Python Playwright:

    pip install playwright && playwright install chromium
    python3 tests/crowd.py

## Building the apps yourself (optional)

GitHub does this for you, but locally:
- **Android:** Node.js 22, Java 21, Android SDK (via Android Studio). From the repo root: `npm ci`, `npx cap add android`, copy `branding/res/.` into `android/app/src/main/res/`, `npx cap sync android`, then `cd android && ./gradlew assembleDebug`.
- **Windows:** Node.js 22. Copy `www/index.html` to `desktop/app/index.html`, then in `desktop/`: `npm ci` and `npx electron-builder --win portable --x64`.
