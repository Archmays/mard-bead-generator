# Third-party notices

## MARD palette data: maxcleme/beadcolors

- Repository: <https://github.com/maxcleme/beadcolors>
- Fixed commit: `29229889daab404fb30531d4bb785fd73f7f58e3`
- Source path: `raw/mard.csv`
- Used for: the 291 MARD reference codes and RGB values in `src/data/mard-291.json`; the 221 file is a documented subset.
- License: MIT

```text
MIT License

Copyright (c) 2020 maxcleme

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

## Runtime libraries

- [`culori`](https://github.com/Evercoder/culori), version resolved by `package-lock.json`, MIT. Used for sRGB/CIELAB conversion and CIEDE2000.
- [`jsPDF`](https://github.com/parallax/jsPDF), version resolved by `package-lock.json`, MIT. Used to package browser-rendered Canvas pages as PDF.
- React and React DOM, versions resolved by `package-lock.json`, MIT. Used for the browser interface.

No code, CSS, UI assets, JSON data or implementation was copied from the AGPL-licensed `Zippland/perler-beads` project. `Jett-Wu/Perler_Beads_Generator` (MIT) was used only as an independent palette cross-check; its source code was not copied.
