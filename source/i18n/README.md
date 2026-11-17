# Translations

The game is written in English. `../i18n.js` translates what is on screen as it appears, from a dictionary per
language. The player picks a language on first run or in Options (English is the default).

Languages: Simplified Chinese `zh`, Spanish `es`, French `fr`, German `de`, Brazilian Portuguese `pt`, Japanese `ja`.
To add one: list it in `LANGS` in `../i18n.js` and `I18N_LANGS` in `../build.py`, then write the files below.

## Interface text

- `strings.txt` — every English string with an ID: `ID<TAB>N|U<TAB>English`. `N` is a name that can appear inside
  sentences (cards, wizards, weather, "You"…), `U` is everything else.
- `<lang>.txt`, `<lang>_2.txt` … `<lang>_9.txt` — the translations, one `ID<TAB>translation` per line. In a pattern,
  `{c}` is a name, `{0}` a number and `{s}` any text; write `{c1}`, `{1}` in the translation to change the order.
  A name left out stays as in English. (Chinese keeps its older files: `zh_names.txt`, `zh_ui*.txt`, keyed by the
  English text instead of an ID.)
- `python3 make_dict.py <lang>` builds `<lang>.json`, reports placeholder mistakes and untranslated IDs, and for
  `zh`/`ja` cuts the CJK font (`<lang>_font.woff2`) down to the characters used. Run `python3 ../build.py` after.
- A new English string: add it to the end of `strings.txt` with the next ID, and add that ID to each language.

## Card text

Card art has English baked in, so for other languages the game draws the text itself (`../card_art.js`):

- `../imgs_base.json` — every card with its English removed, plus layout and icons. Made by
  `python3 render_cards.py base`; only needs redoing if the card art changes.
- `cards_<lang>.tsv` — the translated card text: header lines (`@sub`, `@label`, `@toxic`, `@weather`, `@upper`,
  `@quote`, `@hl` …) then `key<TAB>text / lines<TAB>flavor<TAB>extra`. Titles come from the dictionary's names.
  `python3 make_cards.py <lang>` turns it into `cards_<lang>.json`. (Chinese: `cards_zh.json` is edited directly.)
- The wizard boards and the printed rulebook pages stay in English; in other languages the wizard board is
  followed by its rules as text.

To find strings still in English: play in the language and look for untranslated text (the harvest/coverage
scripts used for the first pass crawl every menu and play bot games in each mode).
