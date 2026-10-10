# Combat UI verification

The UI uses the ordered combat resource snapshots for HP, shield, actual SP, pathway charge, Fool control slots and binding stages, Door records, statuses and mythical appearance. Shield loss and HP loss are separate in ordinary, reflected and reactive damage rows. Reactive recovery and shields identify their source and recipient. Existing unit/image nodes survive resource and mythical-art updates; new battle-only units are appended once and expired summons appear inactive without inventing HP loss.

Pause/Resume, one-action Step and a slower Read pace are available. Existing 1x/2x/4x timing is preserved. SP and shield are visible for both sides; text is at least 0.8rem and playback buttons have a 44px minimum height. Full-resolution normal artwork and the existing original-image viewer remain available; active mythical forms use the versioned 192px runtime portrait.

Round-limit outcomes explicitly say the contract is incomplete; the simulator calls them a draw. Victory, defeat and neither-side-survived outcomes use the engine's outcome field and preserve existing reward rules.

## TDD evidence

- Initial new UI suite: **0 passed, 12 failed**, against the unchanged UI. RED evidence: `/tmp/phase4-ui-red.log`.
- Added reflected-damage and result-color regressions: **12 passed, 2 failed** before those fixes; **14 passed** afterward.
- Security review counter-markup regression: **14 passed, 1 failed** before escaping the added counters; **15 passed** afterward.
- Security review prototype-shaped resource-ID regression: **15 passed, 1 failed** before replacing the HP map with a null-prototype map; **16 passed** afterward.
- Nested-authority reaction regression: **16 passed, 1 failed** before including reaction damage in HP/shield tracking; **17 passed** afterward. Reactive damage keeps its actual source in the displayed attack.
- Reactive recovery/shield attribution: **17 passed, 1 failed** before labeling the actual source and recipient; **18 passed** afterward.
- Contract and simulator timeout regressions: **18 passed, 2 failed** before passing through the engine's outcome; **20 passed** afterward.
- Expired summon regression: **20 passed, 1 failed** before checking authoritative alive/inCombat flags; **21 passed** afterward.
- Current `tests/phase4-ui.test.js`: **21 passed, 0 failed** using the actual working-tree browser scripts and Node combat engine.
- Existing battle DOM suite: **20 passed**; `battle-ui.test.js` passed; full-resolution portraits: **13 passed**; modal DOM: **6 passed**. Only the browser fixture module order was updated for the two new combat modules; their assertions were preserved.
- Rebuilt runtime-data browser descriptions: **9 passed**, including generated-description parity for all 220 ranks and mandatory Door/White Tower copy headers showing stored-skill costs. The obsolete Error deferral skips were removed. The header regression failed before replacing misleading wrapper SP/cooldown labels.
- `node --check js/ui.js`, `node --check reports/phase4/browser-qa.js`, and `git diff --check` passed.
- Phase 1 casting fixtures now satisfy the approved observed-skill, charge, source SP/cooldown and host-turn parasite requirements: **39 passed**. Assertions still require real casts, effect values and no shared-state mutation.
- Real nested-order verification: **399 in-hit mythical awakenings** and **89 reflections** passed, plus a synthetic nested authority case that retains the causing attack, reactive source and final resource snapshot. Predicate scans distinguish primary damage from the new authority/signature reactions.

## Security review

Dynamic combat names, status names, charge names and resource counter values are escaped before entering HTML. Runtime mythical sources retain the existing allowlisted path, size, version and extension validation. Image source updates preserve the same image node and use the same checked renderer. Playback uses one registered timer; pause/speed changes cancel it, and stale callbacks cannot advance a paused/replaced encounter. No new external requests, credentials or saved guild mutations were introduced by the UI.

The resource-ID map uses `Object.create(null)` so a unit called `constructor` or `__proto__` cannot target an inherited object. Shared-engine ability-history and owner-ID dictionaries were separately flagged to the engine owner for the same review.

## Real-browser verification

Chromium initially failed with sandbox socket `EPERM`. Command-specific network permission allowed its required socket operations; no external service was used. The final real-browser layout suite passed **12/12** at 320, 390, 560 and 1440px, covering dossier, campaign and battle layout.

The real browser exposed a phone defect that DOM checks could not: allied HP, shield and SP fell below the first viewport. The added visibility assertion failed before the responsive change (`/tmp/phase4-mobile-visibility-red.log`). Portraits now sit beside their resource panel on phones, retaining the 160px allied art and horizontal party scrolling. The final assertion passes on both phone and desktop (`/tmp/phase4-mobile-visibility-green.log`), and screenshots were visually inspected.

`browser-qa.js` starts a local preview in fresh contexts and verifies pause/resume, one-action stepping, stable unit/image nodes, form artwork, visible HP/shield/SP, readable fonts, 44px buttons and no horizontal page overflow. The controlled UI fixture is separate from the real-battle engine tests. No existing guild save is changed. Playwright is an optional verification dependency, not a production dependency.

Evidence: `browser-qa-results.json`, `preview-mobile.png`, `preview-desktop.png`.

```sh
NODE_PATH=/path/to/node_modules CHROMIUM_PATH=/usr/bin/chromium node reports/phase4/browser-qa.js
```

Set `GUILD_PREVIEW_URL` to an existing localhost preview if needed. The current screenshots and JSON come from the successful final run.
