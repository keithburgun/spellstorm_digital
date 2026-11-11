# Spellstorm on Reddit (Devvit Web)

The game itself is built from `../source` by `npm run build` (runs `source/build.py`, which writes `public/game.html` and its scripts).
The server (`src/server`) only stores each Reddit user's save (`api/me`, `api/save`, `api/save/put`) and creates posts.
Not in the Reddit version: online play, the Spellstorm account login, update checks.

- Uploads: GitHub Actions (`.github/workflows/reddit.yml`) uploads a private version on every push, using the
  `DEVVIT_AUTH_TOKEN` secret, and installs it in the subreddit named by the `REDDIT_TEST_SUB` variable.
- Going public: `npx devvit publish` (Reddit reviews the app first).
