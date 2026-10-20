# Sequence 4 battle effects

Integrated locally on `phase3-truthful-abilities`, based on `2d91240`.
Open **Battle Simulator → Ability animations → Sequence 4** to review the casts.

## Changes

- Added all 22 newly unlocked active effects using the 27 approved transparent
  256px PNGs. Files are copied byte-for-byte from the reviewed exports.
- Reused the existing battle renderer, phase timing, pause, speed, reduced-motion
  and cleanup controls. Area casts use the actual recorded enemy recipients.
- Kept Fool's Dodge shimmer, Death's shield and Mother's recovery separate from
  their hostile effects. Hanged Man recovery waits for a positive ability-heal
  event; Moon's returning motes require a positive recorded SP gain.
- Added addressed SP presentation events for Moon and Error. They report the
  existing drain and capped recovery; HP/SP calculations are unchanged.
- Error's parasite pulses on its real host during the later drain. White Tower's
  ward pulses on its owner when a later hit reflects; it is never fired as a
  guard-shaped projectile. Shared reflection damage feedback remains in place.
- Added gallery PNG samples, preserving upright target effects during side swaps
  and showing Moon's SP return in the reverse travel lane.
- Added content versions, strict asset validation and durable caching. Runtime
  data, script/style versions and the service-worker hash were rebuilt.

Original character artwork, ability rules, balance values and save format are
unchanged. Older saved replays without the new SP event fields retain their
existing resource feedback.

## Verification

- Asset/schema regressions: 17 passed; all 27 PNGs have real transparency,
  eight-pixel margins, valid content hashes and the approved source bytes.
- Renderer regressions: 29 passed, including all 22 fresh native casts,
  recorded outcomes, targeting, copying, delayed effects and tape immutability.
- SP presentation regressions: 8 passed; gallery DOM: 15 passed; caching: 34 passed.
- Chromium battle verification: 88 native cast checks passed across both teams
  at 390px and 1440px. Gallery checks cover 320px, 390px and 1280px, including
  every Sequence 4 Replay, existing ranks, filters, side swaps and save safety.
- Existing Sequence 5/6/7/8 renderer checks: 25 / 16 / 32 / 43 passed.
- Existing stable battle DOM: 20 passed; animation controls: 49 passed.
- Shared effects: 147 passed; signatures: 46 passed; native previews: 12 passed;
  all 220 actual ability casts passed 9,414 quantitative assertions.
- Runtime build/check, JavaScript syntax and `git diff --check` pass.

The new asset, renderer, SP-event and gallery-placement tests failed before their
respective fixes. Browser sampling captures short casts in the click task so
driver delays cannot consume an 800ms preview; natural expiry and real-click
cleanup remain independently checked.

Security review found no new trust-boundary issues: asset URLs and associations
are whitelisted, content-versioned and local; search input remains text. Tests
leave shared definitions, battle records and saved guild state unchanged.

The full balance simulator was not rerun for this presentation-only change.
No deployment was performed.
