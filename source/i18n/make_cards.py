"""Build cards_<lang>.json (the text printed on the cards) from cards_<lang>.tsv.
Card titles come from the dictionary's names (<lang>.txt), so a card is called the same everywhere.
The .tsv has one line per card: key<TAB>text lines separated by " / "<TAB>flavour<TAB>extra
(extra = Robot Boy's speech bubble, or a trap's trigger). Lines starting with @ set the rest:
  @sub<TAB>English line above the title<TAB>translation      @label<TAB>TRIGGER:|EFFECT:<TAB>translation
  @toxic<TAB>TOXIC<TAB>…   @toxicnote<TAB><TAB>…   @after<TAB><TAB>…   @weather<TAB><TAB>…
  @upper<TAB><TAB>1 (titles in capitals, like the English cards)   @quote<TAB>“<TAB>” (around potion names)
  @hl<TAB>word<TAB>#colour (words drawn in colour, e.g. Storm Shard)
usage: python3 make_cards.py es"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
lang = sys.argv[1]
eng = {}
for line in open(os.path.join(HERE, 'strings.txt'), encoding='utf-8'):
    if line.startswith('#') or '\t' not in line: continue
    i, k, en = line.rstrip('\n').split('\t', 2); eng[i] = en
names = {}
import glob, re
for f in sorted(glob.glob(os.path.join(HERE, lang + '*.txt'))):
    if not re.match(lang + r'(_\d+)?\.txt$', os.path.basename(f)): continue
    for line in open(f, encoding='utf-8'):
        if '\t' in line and not line.startswith('#'):
            i, tr = line.rstrip('\n').split('\t', 1)
            if i in eng: names[eng[i]] = tr
N = json.load(open(os.path.join(HERE, 'card_names.json'), encoding='utf-8'))   # card key -> English name
E = json.load(open(os.path.join(HERE, 'cards_en.json'), encoding='utf-8'))
out = {'_subs': {}, '_labels': {}, '_toxic': {}, '_hl': {}}
q = ('“', '”')
rows = {}
for line in open(os.path.join(HERE, f'cards_{lang}.tsv'), encoding='utf-8'):
    line = line.rstrip('\n')
    if not line or line.startswith('#'): continue
    p = line.split('\t') + ['', '', '', '']
    if p[0] == '@sub': out['_subs'][p[1]] = p[2]
    elif p[0] == '@label': out['_labels'][p[1]] = p[2]
    elif p[0] == '@toxic': out['_toxic']['TOXIC'] = p[2]
    elif p[0] == '@toxicnote': out['_toxic']['note'] = p[2]
    elif p[0] == '@after': out['_after'] = p[2]
    elif p[0] == '@weather': out['_weather'] = p[2]
    elif p[0] == '@upper': out['_upper'] = bool(p[2])
    elif p[0] == '@quote': q = (p[1], p[2])
    elif p[0] == '@hl': out['_hl'][p[1]] = p[2]
    else: rows[p[0]] = p
missing = []
for k, e in E.items():
    if k.startswith('_'): continue
    if k not in rows: missing.append(k); continue
    p = rows[k]
    en_name = N.get(k, e['title'])
    title = names.get(en_name, en_name)
    c = {'title': title}
    if p[1]: c['text'] = [s.strip() for s in p[1].split(' / ')]
    if p[2]: c['flavor'] = p[2]
    if k.startswith('pot_'): c['title'] = q[0] + title + q[1]
    if k.startswith('rb_'): c['title'] = names.get('Robot Boy', 'Robot Boy'); c['sub'] = q[0] + title + q[1]
    if p[3]:
        if k.startswith('rb_'): c['bubble'] = p[3]
        if k.startswith('trap_'): c['trigger'] = p[3]
    if k.startswith('trap_'): c['after'] = out.get('_after', '')
    out[k] = c
json.dump(out, open(os.path.join(HERE, f'cards_{lang}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(lang, len(rows), 'cards', 'missing:', missing)
