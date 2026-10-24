# Third-party notices

vocab2code includes or bundles the following third-party material.

## ECDICT

The dictionary `dict/ecdict.json` and the word lists in `data/` (except files
you add yourself) are generated from ECDICT by `tools/build-ecdict.js`.

- Source: https://github.com/skywind3000/ECDICT
- License: MIT

```
MIT License

Copyright (c) 2025 Linwei

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Tatoeba example sentences

- Source: https://tatoeba.org (exports: https://downloads.tatoeba.org/exports/per_language/)
- License: Creative Commons Attribution 2.0 France (CC BY 2.0 FR)
- License URL: https://creativecommons.org/licenses/by/2.0/fr/
- Sentence authors and source links: [attribution/tatoeba.json](attribution/tatoeba.json).
  Keys are SHA-256 hashes of `eng:<English sentence>` or `cmn:<Chinese sentence>`
  as stored in the bundled dictionary. Each matched source lists its author,
  sentence ID, URL and modifications. Where identical texts have multiple
  sources, all matching attributed sources are credited.
- Some Chinese sentences use simplified transcriptions supplied by Tatoeba.
  Email addresses in examples are replaced with example.com addresses.
- The official [text attribution FAQ](https://en.wiki.tatoeba.org/articles/show/faq)
  permits crediting Tatoeba with its website and CC BY 2.0 FR license. We also
  provide sentence-level source records. If the official export has no assigned
  author, `author` is null and `authorStatus` is `unassigned`; no author is invented.
- Unmatched source sentences are listed in `missing` and block our distribution
  check. This release has no unmatched sentences.

## ws 8.21.0

Bundled into `out/extension.js` (Edge TTS WebSocket client).

- Source: https://github.com/websockets/ws
- License: MIT

```
Copyright (c) 2011 Einar Otto Stangvik <einaros@gmail.com>
Copyright (c) 2013 Arnout Kazemier and contributors
Copyright (c) 2016 Luigi Pinca and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## fflate 0.8.3

Bundled into `out/extension.js` (unzipping imported word lists).

- Source: https://github.com/101arrowz/fflate
- License: MIT

```
MIT License

Copyright (c) 2026 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
