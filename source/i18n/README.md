# Translations

The game is written in English. `../i18n.js` translates what is on screen as it appears, from a dictionary per
language. The player picks a language on first run or in Options (English is the default).

Simplified Chinese (`zh`):

- `zh_names.txt` — names that appear inside sentences (cards, wizards, weather, "You"…).
- `zh_ui*.txt` — everything else. One line per string: `English<TAB>Chinese`. In a pattern, `{c}` is a name,
  `{0}` a number and `{s}` any text; write `{c1}`, `{1}` in the Chinese to change the order.
- `python3 make_dict.py zh` turns these into `zh.json` and cuts the Chinese font (`zh_font.woff2`) down to the
  characters used. Run it after editing, then `python3 ../build.py`.

Card art has English text baked in, so translated cards are separate images:

- `cards_en.json` — the text on every card image (transcribed), `cards_zh.json` — its translation.
- `python3 render_cards.py zh [keys…] [--png DIR]` removes the English text from each card image, typesets the
  Chinese with the same icons and writes `../imgs_zh.json`. The game uses those images when Chinese is on.
- The wizard boards and the printed rulebook pages stay in English; in Chinese the wizard board is followed by
  its rules as text.

To find strings still in English: play in Chinese and look for Latin text (the harvest/coverage scripts used
for the first pass crawl every menu and play bot games in each mode).
