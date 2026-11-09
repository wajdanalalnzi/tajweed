# References and data sources

This file lists every external source used by موسوعة التجويد, what part of the app it feeds, how it was obtained, and how a third party can re-verify it. The Arabic build report with the actual numbers produced by the last build is in [`data/mushaf/VERIFICATION.md`](data/mushaf/VERIFICATION.md); `npm test` re-checks the committed data on every run.

Everything below was collected on 2026-11-05 from the raw file URLs given. SHA-256 checksums are of the exact files that were downloaded (kept out of git under `sources/`; `python3 scripts/build_mushaf.py` re-downloads them and refuses to build if the Tanzil checksum differs from the manifest).

## 1. Quran text (the mushaf, `data/mushaf/001.json` … `114.json`, field `t`)

| Item | Value |
| --- | --- |
| Edition | Tanzil Quran Text, **Uthmani** script, riwayah of Hafs 'an 'Asim (Tanzil Project, Copyright 2007-2021) |
| Tanzil download used by the snapshot | `https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true` (no `marks`, `sajdah` or `rub` options, so the text carries no pause marks, sajdah or hizb signs; see section 3) |
| Obtained from | `https://raw.githubusercontent.com/risan/quran-json/main/data/tanzil/uthmani.json` (a verbatim JSON packaging of the Tanzil file) |
| Checksum | SHA-256 `adaebb377c60eba1bab6ef652959c7a0b4ccb4d0ca42145945c14ecdbeb4b761`, identical to the checksum recorded in that project's manifest `data/meta/sources.json` (SHA-256 `117045528f8ab07e21f702d45437d1b7e8c9ed22ab580574df0b9b7db06c7723`) |
| License | Tanzil text license, Creative Commons Attribution 3.0: verbatim copies may be distributed, **changing the text is not allowed**. `https://tanzil.net/docs/text_license` |
| Documentation | `https://tanzil.net/docs/quran_text_types`, `https://tanzil.net/download/` |
| Structure | 114 surahs, 6,236 ayat (the Kufan count used by Hafs). Tanzil prepends the basmalah to ayah 1 of every surah except al-Fatihah (1) and at-Tawbah (9); the build splits it off into the `basmalah` field without altering a character. 110 surahs read «بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ», two (e.g. surah 95) read «بِّسْمِ…» with shaddah, exactly as the Madinah mushaf writes the idgham when joined to the previous surah |
| Verification done | (a) checksum match above; (b) 114 / 6,236 count check; (c) letter-by-letter comparison against two independent editions (section 2): **0** base-letter differences against the King Fahd Complex text, **1** against the Quran Academy text (29:8, where Tanzil and KFGQPC agree); (d) round-trip: the Tanzil lines are rebuilt from the committed JSON and must match the original character for character; their SHA-256 `a0d9cd3755df1570c14a3a2c226b401ede4e4d12df44655f5873c0e1924bdd38` is stored in `data/mushaf/index.json` as `tanzil_lines_sha256` and recomputed by `npm test`, so any hand edit of the Quran text fails the test |

**To re-verify independently:** download `quran-uthmani.txt` from tanzil.net with the options shown above (Uthmani, no pause marks), and compare it line by line (`surah|ayah|text`) with the text reconstructed from `data/mushaf/*.json` (basmalah + space + ayah 1 for surahs other than 1 and 9). The reconstruction code is the `hashlib` block in `scripts/build_mushaf.py` and the `hash.update` loop in `scripts/validate.js`.

## 2. Independent cross-check editions (not shipped in the app)

| Edition | Source file | SHA-256 | Result |
| --- | --- | --- | --- |
| King Fahd Glorious Quran Printing Complex (مجمع الملك فهد), Hafs, **version 13** (`qurancomplex.gov.sa`) | `https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/ara-quranuthmanihaf.json` | `1102ef9e0bab89a28c90b513b5281687948dddc905dcef2e1af9206bb151b91f` | 6,236 ayat, 0 letter differences, 0 hamza-count differences |
| Quran Academy text (`quranacademy.org`) | `https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/ara-quranacademy.json` | `6a9010407fb8be4a14a3b523397c95742b41cda3418a870fd777af7e044c54ec` | 6,236 ayat, 1 letter difference (29:8 «جَٰهَدَاكَ» in Tanzil and KFGQPC vs «جَهَدَكَ» there), 0 hamza differences |

The comparison strips diacritics and unifies the spelling variants of hamzah, alif and yaa (the three editions use different Unicode encodings for the same rasm), then compares the base letters of every ayah and, separately, the number of hamzahs. See «مقارنة الحروف» in `VERIFICATION.md`.

## 3. Pause marks, sajdah and hizb signs (`data/mushaf/*.json`, field `w`)

| Item | Value |
| --- | --- |
| Source | The King Fahd Complex Hafs v13 text above (its encoding carries the signs as standard Unicode marks: U+06D6 ۖ, U+06D7 ۗ, U+06D8 ۘ, U+06DA ۚ, U+06DB ۛ, U+06DC ۜ, U+06DE ۞, U+06E9 ۩) |
| Why a separate layer | The Tanzil download used by the snapshot excludes these signs. Rather than editing Tanzil's text (which its license forbids), the build stores each sign with the position where it belongs, and the reader inserts it at display time. Field `t` therefore stays a verbatim Tanzil copy |
| Method | Both texts have identical base-letter sequences for all 6,236 ayat (section 2), so each sign is attached to "the n-th base letter of the ayah" in the KFGQPC text and placed after the same letter, at the end of that word, in the Tanzil text. The build aborts if a sign would land anywhere but a word end |
| Counts (must match KFGQPC exactly, checked by `npm test`) | ۚ 2,083 · ۖ 1,651 · ۗ 511 · ۘ 21 · ۛ 6 · ۜ 5 (the sakt positions 18:1, 36:52, 69:28, 75:27, 83:14) · ۞ 199 · ۩ 15 (the 15 sajdah places). Total 4,491 |
| Known gap | The KFGQPC encoding contains no «لا» (U+06D9) sign, so that sign is not shown |

## 4. Tajweed colouring of the mushaf (`data/mushaf/*.json`, field `j`)

| Item | Value |
| --- | --- |
| Source | `cpfair/quran-tajweed`, file `output/tajweed.hafs.uthmani-pause-sajdah.json`, `https://raw.githubusercontent.com/cpfair/quran-tajweed/master/output/tajweed.hafs.uthmani-pause-sajdah.json`, SHA-256 `151d616ad37a4cc21a80f20d5e1104c5b408375107ddd4d71247dea4c05ebf67`. 60,057 annotations, each a Unicode codepoint range in the ayah plus a rule name, produced by that project's rule-based classifier (decision trees in its `rule_trees/`) |
| License | Creative Commons Attribution 4.0 (`https://github.com/cpfair/quran-tajweed`, README) |
| Realignment | The annotations were generated in April 2017 against the Tanzil text of that time. The current text differs systematically by the tatweel character (U+0640) inserted as a carrier for the small hamzah / small yaa, plus a few other encoding changes. The build removes tatweel from the index space, then checks every annotation against a fixed anchor for its rule (e.g. hamzat al-wasl must sit on «ٱ», lam shamsiyyah on «ل», qalqalah on one of قطبجد, ghunnah on ن or م, every madd on a madd letter or maddah). Where an anchor fails, nearby shifts (±1…±3) are tried cumulatively; an annotation that still fails is dropped rather than coloured wrongly. Result: 5,759 ayat aligned directly, 445 needed local shifts with every anchor passing, 32 ayat had one or two annotations dropped (34 in total, all at the small-yaa «ـۧ» in النبيّـۧن or at hamzah-on-tatweel words such as هنيـٔا). 60,023 annotations kept |
| Rule mapping (source rule → app rule id in `js/data/rules.js`) | ghunnah → ghunnah · hamzat_wasl → hamzat-wasl · idghaam_ghunnah → idgham-ghunnah · idghaam_no_ghunnah → idgham-no-ghunnah · idghaam_mutajanisayn → idgham-mutajanisayn · idghaam_mutaqaribayn → idgham-mutaqaribayn · idghaam_shafawi → idgham-shafawi · ikhfa → ikhfa · ikhfa_shafawi → ikhfa-shafawi · iqlab → iqlab · lam_shamsiyyah → lam-shamsiyah · madd_2 → madd-tabii (madd-silah-sughra when the small waw/yaa follows the pronoun ه) · madd_246 → madd-arid (madd-lin when the span is a sakin و/ي preceded by fathah) · madd_6 → madd-lazim · madd_munfasil → madd-munfasil (madd-silah-kubra after the pronoun ه) · madd_muttasil → madd-muttasil · qalqalah → qalqalah-sughra (qalqalah-kubra at ayah end) · silent → silent |
| Coverage limits | The source marks the rules above only. It does not mark izhar (unmarked nun/tanwin is izhar), tafkhim/tarqiq of ر and of lam al-jalalah, idgham mutamathilayn, sakt, or stopping rules. The colouring is generated automatically and is a learning aid, not an authority: where it disagrees with a printed mushaf or a qualified teacher, the latter prevail. The reader has a toggle to hide it |

## 5. Surah and juz metadata (`data/mushaf/index.json`)

Names, revelation type (مكية/مدنية), ayah counts and the 30 juz start points come from Tanzil's `quran-data.xml` (`https://tanzil.net/res/text/metadata/quran-data.xml`) as packaged in `https://raw.githubusercontent.com/risan/quran-json/main/data/tanzil/chapters.json`, SHA-256 `5b18adae945fcb6f9fbb865dd7dc596f89a63607a4e6617ca9e37f7f10d3386b`. The ayah counts are also hard-coded in `scripts/build_mushaf.py` and `scripts/validate.js` and must agree.

## 6. Recitation audio (streamed, not stored)

| Item | Value |
| --- | --- |
| Provider | `https://everyayah.com` (per-ayah MP3 files) |
| URL pattern | `https://everyayah.com/data/<reciter>/<SSS><AAA>.mp3`, surah and ayah zero-padded to three digits, e.g. `Husary_128kbps/002005.mp3` |
| Isti'adha and basmalah | When a whole surah is played from the start, the player first plays `<reciter>/audhubillah.mp3` (isti'adha; skipped if the reciter's folder lacks it), then `<reciter>/001001.mp3` (al-Fatihah ayah 1, the basmalah) for every surah except 1 and 9, then the ayat |
| Reciters offered | `Husary_128kbps` (الحصري، مرتّل, default), `Husary_Muallim_128kbps` (الحصري، المصحف المعلّم), `Abdul_Basit_Murattal_192kbps`, `Minshawy_Murattal_128kbps`, `Alafasy_128kbps` |
| Terms | everyayah.com publishes no license text we could find; the app links to the files at playback time and does not copy or redistribute them. Copyright in each recitation remains with its reciter/publisher |
| Verification | The files could not be fetched from the build environment (network policy), so playback was tested only for correct URL construction and error handling. Please spot-check a few ayat on the live site |

## 7. Fonts (`fonts/`, `css/fonts.css`)

| Font | Use | Origin | License |
| --- | --- | --- | --- |
| Amiri Quran | Quran text | The Amiri Project, `https://github.com/aliftype/amiri` (files packaged by Fontsource, `@fontsource/amiri-quran`) | SIL Open Font License 1.1, `fonts/OFL.txt` |
| Amiri (400/700) | Headings | same project (`@fontsource/amiri`) | SIL OFL 1.1 |
| Noto Naskh Arabic (400-700) | UI text | Google Noto fonts (`@fontsource/noto-naskh-arabic`) | SIL OFL 1.1 |

The logo and app icons (`icons/`) are original vector artwork drawn for this project (hand-written SVG paths, no font or third-party image), so they carry no outside license.

## 8. Educational content (`js/data/chapters.js`, `rules.js`, `glossary.js`, `quizzes.js`)

The lesson text, rule definitions, glossary and quiz questions were written for this app (by Claude at the project owner's request) following the standard Hafs tajweed syllabus as taught from:

- متن تحفة الأطفال والغلمان, سليمان الجمزوري (rules of nun sakinah and tanwin, mim sakinah, mushaddad nun/mim, the madd categories).
- المقدمة الجزرية, ابن الجزري (makharij: the 17 points of articulation on Ibn al-Jazari's reckoning, sifat, tafkhim/tarqiq, idgham types, waqf).
- The conventions of the Madinah mushaf (Hafs 'an 'Asim via the Shatibiyyah) for the examples' spelling and for stopping signs.

No passage was copied from a specific printed book, so there is no single edition to cite; a review by a certified (مجاز) tajweed teacher is the appropriate third-party validation for this layer. Each example carries a `[surah, ayah, name]` reference; `npm test` checks that the reference is within range, and the example texts can be compared with `data/mushaf` by a reviewer (the examples were typed in the Tanzil/Madinah orthography and may differ from Tanzil in encoding details such as «ي» vs «ى» before a maddah, which `npm test` does not treat as an error).

The 12 colour groups (madd shades red/orange/amber, ghunnah green, idgham purple, izhar blue, qalqalah cyan, tafkhim brown, tarqiq teal, silent grey, sakt pink) follow the general convention of the popular colour-coded tajweed mushafs but are this app's own choice, not an official scheme.

## 9. Where the numbers live

- `data/mushaf/VERIFICATION.md`: Arabic report regenerated by every build (checksums, counts, comparison results, alignment statistics, pause-mark counts).
- `data/mushaf/index.json`: `tanzil_lines_sha256`, `waqf_counts`, `text_source`, `tajweed_source`, `waqf_source`, `built`.
- `scripts/build_mushaf.py`: the complete pipeline, with the anchor checks and the rule mapping.
- `scripts/validate.js` (`npm test`): independent re-check of the committed data without network access.
