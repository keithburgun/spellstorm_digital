# Spellstorm

A tactical deckbuilding card game by Keith Burgun, with art by Christina Zhong, playable right inside a Reddit post.

Each round, every wizard picks a card in secret and plays it face-down, then everyone reveals at once. Fire counters Earth,
Earth counters Water, Water counters Fire. Gain new spells from the ever-changing Storm Cloud, climb from Tier I to Tier III,
and unleash your wizard's Ultimate at the right moment. The first to collect 8 Storm Shards wins.

- Eight very different wizards, each with their own powers
- Duel computer wizards at Easy, Normal, Hard or Expert
- Tournament, Ranked (Elo), Daily Challenge, Puzzles, Free-for-All, Two-on-Two and Co-op against Robot Boy
- A guided tutorial, match history and replays, and a full card library

Your progress is saved to your Reddit account, so it follows you to any device.

## For moderators

Install the app, then use **New Spellstorm post** in your subreddit's mod menu to post a game. You choose the post's title.

## Data

The app stores one thing per player: their Spellstorm save (profile, settings, achievements and match history), so
progress carries across devices. Nothing is shared with anyone else, and there are no ads, purchases or outside services.
Privacy policy: https://github.com/keithburgun/spellstorm_digital/blob/main/PRIVACY.md

## Source

The game is built from https://github.com/keithburgun/spellstorm_digital (`source/`): `npm run build` runs
`source/build.py`, which writes `public/game.html` and its scripts. The server (`src/server`) only stores each player's
save and creates posts.
