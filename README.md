# Norsk drill

A tap-based Norwegian grammar drill, A2 toward B1. Live at https://mrcslnrd.github.io/norskdrill/. Progress stays on the device (the browser's `localStorage`, key `norskdrill.v1`).

This note is for adding or fixing a card, and for backing up progress, without extra tooling.

## Files

- `index.html` — the page shell, including Settings.
- `app.js` — the app: sessions, scoring, storage, export/import.
- `cards.js` — the card parser. It also works in Node.
- `style.css`, `effects.css` — the look (Green, Amber, Day) and the blue/red hit tint.
- `sw.js` — service worker. `VERSION` is the cache name. `SHELL` must list every file the page loads (the QA checks this).
- `VERSION` — the app version. It must match `VERSION` at the top of `app.js` (the QA checks this).
- `cards/` — all drill content. One card is one line.
- `tools/qa-content.js` — the content check that must pass before a release.
- `test/` — headless Chrome checks (not part of the site). Run them all with `node test/run-all.mjs` (Node 22+ and Google Chrome). CI runs them on every push.

## Card format

One card is one line in `cards/*.txt`. Fields are separated by `|`. A blank field is absent. `[]` is an empty list. `#` starts a comment. Do not put `|` inside a field.

The app shuffles options. The first option is the correct one.

`cards/sequence.txt` is the load order: `id | pattern`. A wording fix does not touch it. Add a line there only when you add a grammar card, and give it a pattern id from `cards/patterns.txt`.

Patterns themselves are:

`id | label | hint | pfx | short | b1`

`b1` is blank, `yes`, or `1`.

### order (build the sentence)

`id | order | english | norwegian | why | g | alt // alt | extra / extra`

```
ikke3 | order | We go out when it isn't raining. | Vi går ut når det ikke regner. | Inside the subordinate clause, ikke goes right after the subject, before the verb. |  | Når det ikke regner, går vi ut. | []
```

### fill (tap the word that fits)

`id | fill | english | sentence with ___ | answer | wrong / wrong | why | g`

```
etter22 | fill | After I had run ten kilometres, I drank water. | Etter at jeg ___ ti kilometer, drakk jeg vann. | hadde løpt | har løpt / løp / løpt | The earlier action: hadde + løpt. |
```

### mc (pick the right form)

`id | mc | english | prompt | correct / wrong / wrong / wrong | why | g`

```
etter14 | mc | After I had eaten breakfast, I went to work. | Etter at jeg ___ frokost, gikk jeg på jobb. | hadde spist / har spist / spist / hadde spiste | Two past events: the earlier one takes hadde + participle (spist). |
```

### gap (where the adverb goes)

`id | gap | english | sentence with ^ where the adverb goes | why | adv`

Leave `adv` empty when the card uses the default (`ikke`). Set it when the adverb is something else:

```
rp21 | gap | She said she had no time for coffee. | Hun sa at hun ^hadde tid til kaffe. | In the at-clause ikke stands before the verb (after the subject). | ikke
```

### typed (optional keyboard items)

`id | typed | english | sentence | accepted / accepted | why`

```
etter29 | typed | After I had seen the film, I went to bed. | Etter at jeg hadde ___ (se) filmen, la jeg meg. | sett | Strong verb: se – så – sett, so hadde sett.
```

### sense (vocabulary)

`id | sense | word | sentence with *word* | correct / wrong / wrong | why`

Sense cards belong to the vocab pattern. Options are Norwegian, not English. The word between `*asterisks*` must match the word column.

```
vc01 | sense | knusktørr | Etter tre uker uten regn er jorden *knusktørr*. | helt tørr / gjennomvåt / nylig vannet | Knusk is tinder. Knusktørr means so dry that almost no moisture is left.
```

### phrases (`cards/expr.txt`)

`id | chunk or reply | fam | cluster | status | cue | english | ok or choices | why | sit | intent | tiles | bad | x | alt`

For a chunk, column 8 is accepted sentences joined with `//`. For a reply, column 6 is the Norwegian cue and column 8 is choices joined with `/`. A trailing `*` marks a correct choice.

```
e02 | chunk | e02 |  | sense_supported |  | It is not certain that the bus runs after nine. | Det er ikke sikkert at bussen går etter ni | Ikke sikkert is uncertainty. It does not mean impossible. | Someone wants to leave the stop and come back later. | Do not rule it out, and do not promise it. | Det er ikke sikkert at // bussen går etter ni | Det er umulig at | umulig / aldri |
```

```
e79r | reply | e79 |  | dictionary_verified | Du har vel ikke sendt den ennå? | Yes I have. Correcting a negative. | Jo, det har jeg.* / Ja, det har jeg. / Nei, det har jeg ikke. | Jo overturns a negative question. Ja does not. Nei would deny the sending, and you did send it. | Someone says: Du har vel ikke sendt den ennå? | You sent it yesterday. Correct the negative assumption. | [] | [] | ja / nei / ikke |
```

More detail lives in `cards/README.md`.

## Rules

- Bokmål **en/et only**. No feminine forms (not *boka*, *jakka*, *ei*, *mi/di/si*). Use *boken*, *jakken*, *en*, *min/din/sin*.
- Vocabulary is context-first: a Norwegian sentence with the target marked, and Norwegian options.
- One short instruction per item (the `why` field).
- A wrong answer turns only the wrong words red.
- The hit recolours the palette: it snaps to intense blue for a fixed miss (a previously missed item now answered right) or red for a mistake, holds about 0.6 s, then eases to a softer shade that stays until the next card. No full-screen flash, no shake. The scanlines stay.

## Add or fix a card

1. Edit the matching file under `cards/` (`order.txt`, `fill.txt`, `mc.txt`, `gap.txt`, `typed.txt`, `sense.txt`, or `expr.txt`). For a new grammar card, also add `id | pattern` to `cards/sequence.txt`. Keep the id stable if you are only fixing wording, so existing progress still matches.
2. From the repo root, this must pass with no `FAIL` lines:

   `node tools/qa-content.js`

   It checks feminine forms, options, and that every sentence can be built from its tiles. It also fails on trailing whitespace in `cards/`, a card listed twice in `sequence.txt` or on an unknown pattern, the same exercise twice, a file missing from the service worker's `SHELL`, and an app version that does not match the `VERSION` file.
3. Bump `VERSION` in `sw.js` to the first 10 characters of:

   `cat index.html app.js cards.js style.css effects.css cards/* | sha1sum | cut -c1-10`

   The service worker is cache-first: it serves the old copy immediately, then refreshes the cache in the background. A new `VERSION` is what makes the new files show up.
4. Commit to `main` (or open a pull request and merge it). GitHub Pages deploys from `main` after the content check passes (see `.github/workflows/pages.yml`).
5. Reopen the app twice. The first open still gets the cached copy and refreshes in the background; the second open shows the new version.

Do not change `style.css` or `effects.css` for a card fix. Do not add feminine forms, English sense-options, or a second instruction line on an item.

## Back up and restore progress

Settings has **Export progress** and **Import progress**.

- Export downloads `norskdrill-progress-YYYY-MM-DD.json`. The file holds every progress key (`norskdrill.v1`, and any old-version backup keys), plus the app version and a timestamp. It does not include the optional GitHub sync token.
- Import opens a file picker. A valid file is confirmed before anything is replaced, then the app reloads. A bad file shows a short alert and leaves current progress untouched. Cancelling the confirm does the same.

The older **Export progress (code)** / **Import progress (code)** buttons are still there if you would rather copy and paste an `ND1:` code.

Safari and the Home Screen app keep separate storage. If you change phone, browser, or address, export first and import on the new side.
