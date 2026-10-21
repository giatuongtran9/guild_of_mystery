# Sequence 3 Exalted battle effects

Integrated on `phase3-truthful-abilities`, based on `e188a4f`, for deployment to
`main` and GitHub Pages. Open **Battle Simulator → Ability animations →
Sequence 3** to review the casts.

## Changes

- Added the 20 newly unlocked Sequence 3 active abilities using 21 approved,
  transparent 256 × 256 PNG layers, copied byte-for-byte from the selected
  Exalted exports. Twilight Giant and White Tower unlock passives at this rank
  and do not receive invented active casts.
- Added a stronger four-phase presentation: 280ms anticipation, 180ms
  activation, 500ms sustain and 290ms dissipation. Sequence 3 casts last 1250ms;
  earlier ranks retain their existing timing.
- Enlarged the effects relative to Sequence 4 while preserving existing
  character sizes. Gallery frames use 120px stationary and 108px travelling
  art. Battle frames scale from their existing portrait size and remain bounded
  by the visible arena, including the animation's peak size and rotation.
- Reused pause, speed, reduced-motion, offscreen handling and cleanup. Stationary
  art stays upright when sides swap; travelling effects follow their flight lane.
- Addressed effects to recorded recipients: Red Priest's supported allies,
  Black Emperor and Fortune's actual affected enemies, and Death's actual
  target. Darkness separates its hostile impact from its caster concealment veil.
  Reflective wards remain on their owner and pulse on a later recorded reflection.
- Enriched existing combat presentation events and added addressed misfire and
  reflection setup events. Combat arithmetic and RNG are unchanged. Recovery
  feedback requires an actual positive recovery event; the art does not invent
  damage, summons or counterattacks. Utility fallback attacks remain separate.
- Added strict local asset validation, content versions and durable PNG caching.
  Rebuilt the runtime bundle, script/style versions and service-worker hash.

Original artwork, previous effect exports, ability rules, balance values and save
format remain unchanged.

## Verification

- New data/schema/art regressions: 28 passed; approved bytes, real transparency,
  margins, exact associations, content hashes and motion values checked.
- New renderer regressions: 32 passed; presentation events: 20 passed.
- Gallery DOM: 19 passed; cache regressions: 38 passed.
- Chromium native battle checks: 80 passed, covering all 20 active casts on both
  teams at 390px and 1440px, actual outcomes, all PNG layers, controls and cleanup.
- Chromium gallery checks pass at 320px, 390px and 1280px, including all 20
  Sequence 3 casts, all Sequence 4/5 casts, the 188-active-tier catalog, side
  swaps, timing, filters, cleanup, save safety and ordinary 1v1/2v2 simulation.
- Existing Sequence 4/5/6/7/8 renderers: 29 / 25 / 16 / 32 / 43 passed; existing
  effect-data suites: 129 passed. Stable battle DOM: 20; animation controls: 49.
- Shared effects: 147 passed; signatures: 46; native previews: 12; all 220 actual
  ability casts passed 9,414 quantitative assertions.
- Startup loader: 32 passed; boot: 9; runtime parity/version tests, runtime stale
  check, JavaScript syntax checks and `git diff --check` pass.

The new asset, renderer, presentation-event and caching regressions failed before
their respective implementation changes. Browser assertions use actual computed
portrait sizes (64px mobile and 96px desktop in the tested formations) and
computed transforms rather than assuming an inline CSS angle.

Read-only security review found no deployment blockers. Local versioned asset
paths and source associations are validated; shared ability definitions, saved
state and battle records remain unchanged by presentation. Mobile screenshots
were reviewed for effect visibility and owner alignment. A partially offscreen
actor can have decorative effects reduced by the existing viewport bounds.

The full balance simulator was not rerun for this presentation-only change;
combat numerical regressions passed without changing balance values.
