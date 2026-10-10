# Phase 4 balance tuning

The existing `tests/balance.js` and campaign success assertions remain unchanged. Balance uses real complete battles, not direct damage estimates.

| Rule or ability | Before | After | Reason |
| --- | --- | --- | --- |
| Party encounter enemy damage | 1.5× | 1.3× | Meet the existing opening casualty limit; individual matched fights remain 1.0×. |
| Relative INT advantage in hit checks | 0.25 | 0.10 | Avoid counting a large INT gap twice on top of the existing INT-derived dodge rate. |
| Death: Zombie Transformation | 45 SP; 170% damage coefficient | 25 SP; 230% | Make the existing physical stance usable before low-cost INT attacks consume its SP. |
| Death: undead companion | 35% owner ATK/INT; 3 turns | 75%; 4 turns | Make one temporary companion useful without increasing the one-companion limit. |
| Darkness: Midnight Requiem | 120% INT | 180% INT | Give the existing sleep attack enough pressure to support its dream payoff. |
| Darkness: Dream Slumber | 35 SP; charged 75% INT | 25 SP; charged 200% INT | Improve the existing paid dream payoff; sleep and waking restrictions remain. |
| Fortune: Misfortune Aura | 35 SP; 75% backlash; 2-turn mark | 25 SP; 150%; 3 turns | Make misfortune a useful bounded offensive counter rather than adding a direct attack. |
| Black Emperor: Order Distortion | 45 SP; 150% coefficient | 20 SP; 230% | Give existing rule distortion a practical offensive action between support casts. |
| Error: Combat Theft | 10% ATK/DEF | 15% ATK/DEF | Preserve the existing prepared campaign threshold after accuracy tuning. |

Fool's stages, slots, damage interruption, marionette strength, SP costs and cooldowns were not rebalanced. Its approved charge removes the minimum resistance without skipping binding stages.

Regression evidence: a new opening-party test failed at 0.875 deaths per quest over 200 seeds before the party-damage adjustment. A real hit check failed before the INT-gap adjustment. Four paid-ability battle tests failed with Death 0%, Darkness 7%, Fortune 0% and Black Emperor 0% over 200 seeds; all passed after the local numerical slice. Error's prepared solo campaign failed at 13/20 wins and passed at 17/20 after its theft adjustment. Logs were captured in `/tmp/phase4-casualty-{red,green}.log`, `/tmp/phase4-int-gap-{red,green}.log`, `/tmp/phase4-signature-balance-red.log` and `/tmp/phase4-balance-tests-final.log` and `/tmp/phase4-error-{campaign,theft}-red.log`.

The final all-rank rates and verification totals are in `after-neutral.md`, `after-neutral.csv` and `contract-balance.md`.
