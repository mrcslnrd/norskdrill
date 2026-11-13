# Cards

One card is one line. Fields are separated by `|`. A blank field is absent. `[]` is an empty list. `#` starts a comment. Do not put `|` inside a field.

The app shuffles options. The first option is the correct one.

`cards/sequence.txt` is the load order (`id | pattern`). A wording fix does not touch it. Add a line there only when you add a card.

## sense

`id | sense | word | sentence with *word* | correct / wrong / wrong | why`

```
vc02 | sense | skrubbsulten | Han gikk glipp av lunsj, og ved middagstid var han *skrubbsulten*. | veldig sulten / veldig trøtt / litt kald | A skrubb is a wolf.
```

Sense cards are the vocab pattern.

## order

`id | order | english | norwegian | why | g | alt // alt | extra / extra`

## fill

`id | fill | english | sentence with ___ | answer | wrong / wrong | why | g`

## mc

`id | mc | english | prompt | correct / wrong / wrong / wrong | why | g`

## gap

`id | gap | english | sentence with ^ where the adverb goes | why | adv`

## typed

`id | typed | english | sentence | accepted / accepted | why`

## phrase

`id | chunk or reply | fam | cluster | status | cue | english | ok or choices | why | sit | intent | tiles | bad | x | alt`

For a chunk, column 8 is accepted sentences joined with `//`. For a reply, column 6 is the Norwegian cue and column 8 is choices joined with `/`. A trailing `*` marks a correct choice (`Jo, det har jeg.* / Ja, det har jeg.`).

## patterns

`id | label | hint | pfx | short | b1`

`b1` is blank, `yes` (true), or `1` (the number 1).
