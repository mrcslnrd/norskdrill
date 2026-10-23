# Norsk drill – changelog

## v5.5 · 23 Oct 2026
- **Calmer look.** A quiet 1990s green-phosphor screen: near-black green background, soft phosphor text with a faint glow, IBM Plex Mono (embedded, no outside requests), very faint scanlines and vignette. Hairline borders and no bevels, shadows or emoji. Buttons are outlined rows. The home intro is just "Tap until it clicks". Light theme = "daylight": dark green ink on pale paper.
- **The action sits lower.** The home actions are about 12% lower, and so is the question area in a session. The space above the question shrinks first when a sentence is long, so nothing gets pushed off screen.
- **No flag.** The full-width flag is gone, with no flag motif in its place. The status bar tint is the page background. A thin Marius-sweater strip in hairline phosphor line-art closes the home page.
- **No timer.** The session stopwatch and the "X min Y s" line on the summary are removed.
- **Adaptive picker.** Each pattern's status now comes from its last 20 answers:
  - mastered: 18 or more right (needs 20 answers)
  - needs work: under 75%, or 2 misses in the last 10
  - new: under 5 answers
  - learning: everything else
  A single slip no longer makes a pattern weak.
- **Lesson of 16.** Up to 4 missed sentences come first. About 60% of the lesson goes to weak patterns, and weaker ones get more slots. The rest goes to learning and new patterns, least recently practised first. All mastered patterns share one review item, rotating by which was checked longest ago. Missing a review sends that pattern back into rotation until you get 10 more right. Endless drill uses the same last-20 accuracy, and mastered patterns come up rarely (weight 0.1).
- **Possessive sub-patterns.** Possessives are split into 4 sub-patterns, each tracked on its own: min / mitt / mine, sin or hans, never sin in the subject, and at / fordi / når clauses. Lessons serve the weakest first. After a miss, the follow-up sentences come from the same sub-pattern. B1 Progress shows each sub-pattern's accuracy, and the question card names it.
- **40 new possessive items (po94–po133).**
  - 20 for "sin is never inside its clause's subject", e.g. *Ola og broren hans …*, *Legen hans …*, *Er bilen hans ny?*
  - 20 for sin/hans in at / fordi / når / hvis clauses.
  All use en/et forms and are build-the-sentence or tap-the-word items. Topics include fitness, health, faith, family and daily life. 1,220 items in total.
- **Bug fixes.**
  - Import now accepts a lowercase `nd1:` prefix.
  - The non-word "dems" is gone from po14 and po27, and po27's explanation is corrected.
  - The theme toggle now updates the status-bar tint.
  - A lesson finished after midnight now counts for the day it was started.
  - New users no longer get the same patterns in the same order every day.
  - The old badge check no longer polls every 0.8 s.
- **No points.** Points, multipliers, bonuses and level names are gone. Home and the summary show a plain tally of right / answered (e.g. 317 / 339), and the summary also shows this session's tally. The day streak stays, small, next to the "saved" line. Old point totals stay in the data and the ND1 code, but they aren't shown and no longer grow.
- **Build-the-sentence tiles.** Every tile is lowercase, and the full stop, question mark or exclamation mark at the end of a sentence is no longer a tile. Identical words are interchangeable, so either "hun" tile works in either spot. The feedback shows the sentence with normal capitals and punctuation.
- **A weak possessive sub-pattern makes possessives count as weak** for lesson picking, even when the pattern's overall last-20 score is fine. Within possessives, the weakest sub-pattern gets the most slots.
- **No Portuguese hints.** Every "(PT: …)" gloss and every Portuguese phrase in the explanations is removed (all in time expressions).
- **Home.** "My mistakes" is listed open, as in v5.4. B1 Progress, Settings and Just drill stay behind their buttons.
- **Data.** The data format is unchanged (data v4). The new fields are `pat.*.hold`, `pat.*.rv`, `pat.*.last` and `tag`. They are added on load, and older data gets sub-pattern stats seeded from its sentence history. ND1 codes from v4–v5.4 import losslessly, and v5.4 can still open v5.5 data.

## v5.4 · 21 Oct 2026
- Bokmål en/et forms only: all feminine and dialect forms are gone from sentences, answer choices, distractors, hints and explanations. 145 forms changed in 89 items (jakka → jakken, kona si → konen sin, boka → boken, klokka → klokken, uka → uken, ei → en, mi/di/si → min/din/sin). The possessives explanations now cover sin / sitt / sine and min / mitt / mine only.
- "Pick the correct sentence" is gone. All 158 items that showed several ready-made sentences are now build-the-sentence items (tap the words in order). They keep the same ids, so progress carries over, and some have distractor tiles taken from the old wrong options (har / hadde, å / at, sin / hans …). Three near-duplicates got fresh sentences (jo13, jo18, as36). "Tap the word that fits" items are unchanged.
- The feedback box no longer shows "This sentence comes back once more. You'll get fresh sentences of this pattern until 3 are right in a row." The repeat-and-fresh-sentences behaviour itself is unchanged. The feedback box keeps its original 2px solid green/red border in light and dark themes.
- Possessives: 46 new build-the-sentence items (po48–po93) about fitness, health, faith, family, work, travel, food and everyday life. Reflexive and non-reflexive contrast in separate sentences, sin/sitt/sine agreement, sin never in the subject (Hans bil er ny, Per og hunden hans), at/fordi clauses (Lise sier at broren hennes … / … at hun har mistet nøkkelen sin), and jeg/du/vi → min/din/vår. Every explanation starts from the same question: is the owner the subject of this same clause? Yes → sin, otherwise hans.
- 1,180 items in total (v5.3 had 1,134). Data format unchanged (data v4). Every v5.3 item id is kept, so localStorage and ND1 codes from v4–v5.3 load losslessly.

## v5.3 · 21 Oct 2026
- New home header: a full-width Norwegian flag drawn in pure CSS (22:16, cross 6-1-2-1-12, red #BA0C2F, white, blue #00205B, cross offset toward the hoist). It runs under the iPhone status bar and safe area and fades into the page background within about 140px, in both light and dark themes. No images; fixed height, so no layout jank.
- Refined title: small "Norsk grammatikk · A2 → B1" eyebrow and a larger "Norsk drill". The theme and settings buttons are now frosted glass.
- Browser and status-bar tint (theme-color) is flag red on the home screen and the page background on other screens. Standalone PWA mode keeps the black-translucent status bar over the flag. Other screens keep their safe-area top padding.

## v5.2 · 21 Oct 2026
- B1 Progress > Patterns: tap a pattern card to start Just drill on that pattern. If the Mixed round switch is on, it starts a 16-item round of that pattern.
- New ⚙️ Settings screen (gear button at the top of the home screen) with: Include typed answers, Export my mistakes, Export/Import progress (ND1 code), Reset progress. The home screen is shorter.
- The "My mistakes" list stays on the home screen.
- Build output (dist/) is a plain static folder with relative paths, ready for Cloudflare Pages or GitHub Pages. It includes .nojekyll and _headers (no-cache for sw.js and index.html).
- Data format unchanged (data v4). ND1 codes from v4, v5 and v5.1 import losslessly.

## v5.1 · 21 Oct 2026
- Free session removed as a separate button. Its unique behaviour (a fixed 16-item round that puts weak spots and missed sentences first, then stops) is now the **Mixed round** option in Just drill. It works on the selected patterns and earns points. "Practise more" after the daily lesson starts a mixed round over all patterns.
- "My patterns" is no longer shown open on the home screen. It is merged with the B1 checklist into one **📊 B1 Progress** button, which opens a screen with two tabs: Patterns (stats and mastery) and B1 checklist.
- A version label ("Norsk drill v5.1 · 21 Oct 2026") is shown at the bottom of the home screen. It comes from the `VERSION` constant in app.js.
- The version label and bottom buttons stay clear of the ship.page badge.
- Data format unchanged (data v4). ND1 codes from v4 and v5 import losslessly.

## v5 · 21 Oct 2026
- 4 new patterns: particle verbs, possessives, sentence adverbs, definite forms.
- Expanded patterns: subordinate clauses, V2 word order, small words, time expressions. 1,134 items in total (v4 had 778).
- Order exercises accept listed alternative word orders.
- The checklist maps the new patterns (30 rows).
- Data v4 (a backup of the older data is stored automatically). Imports v4 ND1 codes losslessly; all v4 item ids are unchanged.
- Bottom buttons stay clear of the ship.page badge.

## v4 · Oct 2026
- 8 new patterns: questions, relative som, at/som/å, reported speech, adverbs in subordinate clauses, ordinals and dates, time expressions (with PT hints), small words. 778 items in total.
- B1 checklist screen with mastery bars, manual ticks and tap-to-drill.
- ND1 export/import includes checklist ticks.
