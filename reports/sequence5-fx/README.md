# Sequence 5 battle effects

Integrated locally on `phase3-truthful-abilities`, starting from GitHub main
`92574d2ee5af5c94e31b9a82cded0898ac497636`. No deployment was performed.

## Change

- Added the 20 newly unlocked active Sequence 5 effects, using 24 transparent
  256px PNGs copied byte-for-byte from the approved local previews.
- Corrupted Flesh, Zombie Transformation, Blink Strike and Dream Tether have
  separate caster/recipient layers. Fool's threads remain anchored across the
  two units; Soul Drain travels toward its caster and fades before arrival.
- Actual recorded outcomes determine hit and recovery recipients. Cast attempts
  do not guarantee control, healing, or immediate marionette conversion.
- Reused the battle system's existing timing, pause, speed, reduced-motion,
  cleanup and stable unit nodes. Assets preload from resolved replay rows and
  have content-versioned URLs with durable service-worker caching.
- Added one presentation-only intended-target field to cast events. Its use is
  restricted to Sequence 5 fallback placement; existing target/focus behavior
  and combat calculations are unchanged.
- Regenerated the runtime bundle, script/style versions and service-worker hash.

Red Priest's Iron Blood Vigor and Wheel of Fortune's Reset Fate remain passive
and do not acquire active-cast effects. Existing character art, pathway mechanics,
balance values and saves are unchanged.

## Verification

- New data checks: 12 passed; battle-rendering checks: 25 passed.
- Real Chromium: 50 native-cast checks passed across 390px and 1440px layouts,
  including reversed flows, actual outcomes, pause/speed and compact playback.
- Existing Sequence 6/7/8 FX suites: 16 / 32 / 43 passed.
- Shared effects behavior: 147 passed; action rhythm: 15 passed; animation
  controls: 49 passed; stable battle DOM: 20 passed.
- Signature/support presentation: 29 / 7 passed; FX validation: 58 passed;
  caching: 30 passed; startup loader: 32 passed. Runtime build/check passed.
- Regression evidence: the new DOM suite fails 19 checks against the saved
  pre-integration UI, while the same tests pass on this implementation.
- Reviewed redirected Death ghost targeting and self-support focus against
  native casts; all three checks passed after isolating the new target field.

## Existing limitation and test scope

`tests/combat-fx-alignment.test.js` has one existing failure: its shake assertion
expects 160ms while the existing readable hit uses 225ms. The same 10-pass,
1-fail result was verified against the untouched pre-integration UI. Timing and
the assertion were left unchanged.

The full balance scan was stopped after more than 15 minutes. This change does
not alter combat calculations; it was verified through actual casts and the
147-check effects suite rather than retuning or weakening balance assertions.

Run the new checks with `node tests/sequence5-fx-data.test.js`,
`NODE_PATH=<jsdom directory> node tests/sequence5-fx.test.js`, and
`NODE_PATH=<Playwright directory> node tests/sequence5-browser.test.js`.
Chromium defaults to `/usr/bin/chromium`; screenshots go to
`SEQUENCE5_FX_OUTPUT` or `/tmp/guild-sequence5-fx`.
