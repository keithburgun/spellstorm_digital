"""Build i18n/<lang>.json from the tab-separated sources <lang>_names.txt and <lang>_ui*.txt.
usage: python3 make_dict.py zh
Each line is: English<TAB>Translation. Lines starting with # are comments.
{c} = a name (card, wizard, You…), {0} = a number, {s} = any text. Bare placeholders are numbered in order
of appearance ({c} -> {c0}, {c1}…, {0} -> {0}, {1}…). In the translation, write {c1}/{1} to reorder; bare ones
are numbered in order too."""
import glob, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))

def number(s, explicit_ok):
    out = s
    for kind, rx, fmt in (('c', r'\{c(\d?)\}', 'c{}'), ('s', r'\{s(\d?)\}', 's{}'), ('n', r'\{(\d)\}', '{}')):
        idx = [m.group(1) for m in re.finditer(rx, out)]
        explicit = explicit_ok and any(i not in ('', '0') for i in idx)
        k = iter(range(100))
        def rep(m):
            if explicit and m.group(1) != '': return m.group(0)
            if explicit: return m.group(0)  # bare {c} with explicit siblings: keep as {c} == {c0}? treat as 0
            return '{' + fmt.format(next(k)) + '}'
        out = re.sub(rx, rep, out)
        if explicit: out = re.sub(r'\{c\}', '{c0}', out) if kind == 'c' else out
    return out

def load(lang):
    names, t, p = {}, {}, []
    for f in [f'{lang}_names.txt'] + sorted(glob.glob(os.path.join(HERE, f'{lang}_ui*.txt'))):
        path = os.path.join(HERE, f)
        isnames = f.endswith('_names.txt')
        for ln, line in enumerate(open(path, encoding='utf-8'), 1):
            line = line.rstrip('\n')
            if not line.strip() or line.startswith('#'): continue
            if '\t' not in line: print(f'{f}:{ln}: no tab'); continue
            en, tr = line.split('\t', 1)
            if isnames: names[en] = tr; continue
            if re.search(r'\{(c\d?|s\d?|\d)\}', en):
                e2, t2 = number(en, False), number(tr, True)
                pe = sorted(set(re.findall(r'\{(?:c\d|s\d|\d)\}', e2))); pt = sorted(set(re.findall(r'\{(?:c\d|s\d|\d)\}', t2)))
                if pe != pt: print(f'{f}:{ln}: placeholders differ {pe} vs {pt}: {en}')
                p.append([e2, t2])
            else:
                t[en] = tr
    # specific patterns first; ones with free text ({s}) last, the shortest of those last of all
    p.sort(key=lambda x: (('{s' in x[0]), -len(x[0])))
    return {'names': names, 't': t, 'p': p}

def make_font():
    """Cut Noto Sans SC down to the characters the game shows (needs fonttools + brotli and fonts-noto-cjk)."""
    import subprocess, tempfile
    chars = set()
    for f in glob.glob(os.path.join(HERE, 'zh_*.txt')):
        for line in open(f, encoding='utf-8'):
            if '\t' in line: chars |= set(line.split('\t', 1)[1])
    for f in ['../template.html', '../i18n.js']: chars |= set(open(os.path.join(HERE, f), encoding='utf-8').read())
    chars = {c for c in chars if ord(c) >= 0x2000} | set('，。、；：！？（）《》“”‘’…—·「」【】')
    with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf-8') as t: t.write(''.join(sorted(chars)))
    subprocess.run(['pyftsubset', '/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc', '--font-number=2', '--text-file=' + t.name,
                    '--flavor=woff2', '--output-file=' + os.path.join(HERE, 'zh_font.woff2'), '--layout-features=*', '--no-hinting'], check=True)
    print('font', len(chars), 'chars', os.path.getsize(os.path.join(HERE, 'zh_font.woff2')) // 1024, 'KB')

if __name__ == '__main__':
    lang = sys.argv[1]
    d = load(lang)
    json.dump(d, open(os.path.join(HERE, f'{lang}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(lang, 'names', len(d['names']), 't', len(d['t']), 'p', len(d['p']))
    if lang == 'zh': make_font()
