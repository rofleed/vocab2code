"""Match bundled examples against official Tatoeba detailed/transcription exports.

Usage: python3 tools/build-attribution.py <eng-detailed.bz2> <cmn-detailed.bz2> <cmn-transcriptions.bz2>
No network access. Missing sources remain explicit publish blockers. Unassigned
authors in the official export are represented honestly as null.
"""
import bz2
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EMAIL = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')


def normalized(text):
    return EMAIL.sub('<email>', text)


def sentence_key(lang, text):
    return hashlib.sha256((lang + ':' + text).encode()).hexdigest()


def rows(filename):
    with bz2.open(filename, 'rt', encoding='utf-8') as source:
        for line in source:
            yield line.rstrip('\n').split('\t')


def main():
    eng_file, cmn_file, transcription_file = sys.argv[1:]
    dictionary = json.loads((ROOT / 'dict/ecdict.json').read_text())
    wanted = {'eng': {}, 'cmn': {}}
    for entry in dictionary['entries'].values():
        for example in entry.get('examples', []):
            for lang, field in [('eng', 'en'), ('cmn', 'zh')]:
                if example.get(field):
                    text = example[field]
                    wanted[lang].setdefault(normalized(text), {})[sentence_key(lang, text)] = text
    found = {}
    chinese = {}

    def add(lang, text, sentence_id, author, changes):
        for key, target in wanted[lang].get(normalized(text), {}).items():
            modifications = list(changes)
            if target != text:
                modifications.append('Email address replaced with an example.com address.')
            record = {'id': sentence_id, 'author': None if not author or author == '\\N' else author,
                      'authorStatus': 'unassigned' if not author or author == '\\N' else 'named',
                      'url': 'https://tatoeba.org/en/sentences/show/' + sentence_id,
                      'changes': modifications}
            if record not in found.setdefault(key, []):
                found[key].append(record)

    for lang, filename in [('eng', eng_file), ('cmn', cmn_file)]:
        for row in rows(filename):
            if len(row) < 4:
                continue
            sid, _, text, author = row[:4]
            if lang == 'cmn':
                chinese[sid] = (author, text)
            add(lang, text, sid, author, [])
    for row in rows(transcription_file):
        if len(row) < 5:
            continue
        sid, _, script, _, text = row[:5]
        if script == 'Hans' and sid in chinese:
            author, original = chinese[sid]
            add('cmn', text, sid, author,
                ['Uses the simplified Chinese transcription supplied by Tatoeba.'] if original != text else [])
    missing = [{'language': lang, 'key': key, 'text': text}
               for lang, groups in wanted.items() for group in groups.values()
               for key, text in group.items() if key not in found]
    output = {'license': 'CC BY 2.0 FR',
              'licenseUrl': 'https://creativecommons.org/licenses/by/2.0/fr/',
              'source': 'https://downloads.tatoeba.org/exports/per_language/',
              'attributionGuidance': 'https://en.wiki.tatoeba.org/articles/show/faq#i-would-like-to-use-data-from-tatoeba-for-my-project.-how-do-i-give-proper-attribution%3F',
              'snapshots': [{'file': label, 'sha256': hashlib.sha256(Path(filename).read_bytes()).hexdigest()}
                            for label, filename in [('eng_sentences_detailed.tsv.bz2', eng_file),
                                                    ('cmn_sentences_detailed.tsv.bz2', cmn_file),
                                                    ('cmn_transcriptions.tsv.bz2', transcription_file)]],
              'keyFormat': 'SHA-256 of UTF-8 language + colon + bundled sentence text; languages: eng, cmn',
              'sentences': found, 'missing': missing}
    (ROOT / 'attribution').mkdir(exist_ok=True)
    (ROOT / 'attribution/tatoeba.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(f'Attributed {len(found)} unique sentences; {len(missing)} remain unresolved.')


if __name__ == '__main__':
    main()
