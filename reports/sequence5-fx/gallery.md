# Whole-Sequence ability gallery

The Simulator's **Ability animations** section now opens the complete gallery
instead of the former single-ability tester. Sequence 5 is selected initially;
the Sequence 9–0 selector displays each rank's newly unlocked active abilities.
There are 20 active Sequence 5 abilities and 188 across all ranks. Passive ranks
are excluded.

Each card offers a one-shot Replay using the native preview cast record and
shared battle renderer. Existing PNG samples appear before replay where
available; other ranks use their existing effects when Replay is selected.
The gallery demonstrates cast placement, without applying damage, healing or
status outcomes. A representative target supplies the second sprite anchor.

Search, Pathway and placement filters update existing cards without replacing
the focused input. Controls include replay speed, side swapping and alignment
guides. Selecting a new rank clears the filters. Only one replay runs at a time;
navigation, filtering, speed/side changes, leaving the viewport and hiding the
page cancel it. Portraits and idle art load lazily. No native cast is constructed
until Replay is requested.

## Verification

- Initial gallery expectations failed against the previous single tester.
- Gallery DOM regressions: 13 passed, covering all 188 catalog entries, stable
  controls, immutable native casts/saves, cleanup and existing 1v1/2v2 battles.
- Three focused regressions failed before correction and passed afterward:
  Sequence 7 support placement, native artwork angles, and generic casts whose
  first event is a setup note.
- Native preview tests: 12 passed, covering all 188 active demonstrations.
- Existing stable battle DOM: 20 passed; animation controls: 49 passed.
- Chromium checks cover 320px, 390px and 1280px layouts, all 20 Sequence 5
  replays, other ranks, image decoding, flow direction, filters, cleanup and
  unchanged saves/shared rules.
- Runtime build/check, JavaScript syntax and `git diff --check` pass.

Search input is treated as text; markup injection is covered by the UI/browser
checks. Original artwork, effect assets and combat rules were not edited.

Run `tests/ability-preview-ui.test.js` with jsdom and
`tests/ability-preview-browser.test.js` with Playwright via `NODE_PATH`.
Chromium defaults to `/usr/bin/chromium`. `ABILITY_PREVIEW_OUTPUT` selects the
screenshot/report directory. Work remains local on `phase3-truthful-abilities`.
