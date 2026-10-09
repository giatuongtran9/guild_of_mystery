# Phase 3 approved decisions

All 220 audit rows were verified against the post-Phase-2 code before implementation. Baseline classifications were 49 aligned, 100 partial, 33 mismatch and 38 already fixed. These are ability-row classifications, not independent bug counts. [PHASE3_ABILITY_REVIEW.csv](PHASE3_ABILITY_REVIEW.csv) contains every row, original evidence/proposal, final disposition, generated description and test reference.

The user approved implementing the recommendations with these boundaries:

- Correct existing explicit rules without changing damage coefficients, SP costs, cooldown values or progression tables.
- Preserve ambiguous existing scopes/formulas and generate descriptions of actual effects. Do not add historical rewinds/replays, summoned substitutes, periodic resource effects, new movement/range, buff taxonomies, timed immunities or persistent transformations in Phase 3.
- Keep the prior Phase 4 decisions: all pathway meter design, Fool Spiritual Exhaustion action restrictions, Snake of Mercury's extra fatal protection, Hermit's spell-only bonus, Tyrant's melee-only reflection and balance adjustments.
- **Fool Sequence 5 exception:** the threaded victim losing **more than 30% of its Max HP cumulatively within one combatant turn** loses one stack, at most once in that turn. Shield absorption does not count. Speed/Dodge/accuracy penalties are recomputed at the remaining stage. Ownership, slots, costs and conversion remain unchanged. This applies to the inherited Thread Binding ability as well.
- **Error Sequence 5 Logic Distortion and Sequence 4 Parasitic Contagion:** the whole abilities, including their original descriptions and behavior, remain untouched and deferred to Phase 4. Their real-cast checks are explicit nonblocking diagnostics.

Earlier recommendations concerning broader cleansing, Light/Holy mapping and a consumed single-skill evade charge were ambiguous. Phase 3 preserves the existing named-status cleanse whitelist, mixed-element resistance calculation and timed evasion, and describes those scopes accurately. The original proposals remain in the CSV as review evidence, not implemented changes.

Final disposition: 13 ranks receive existing-rule corrections plus generated descriptions; 205 receive generated descriptions with their mechanics preserved; two whole abilities stay deferred. Shared-rule corrections also apply consistently to inherited casts and both combat teams.

Every new rule correction has recorded failing-before/passing-after regression evidence. The actual-cast suite covers all 220 ranks on both sides; browser tests check live tooltip surfaces, old saved history and escaping. No original artwork, save schema, progression tables or balance assertions were changed.
