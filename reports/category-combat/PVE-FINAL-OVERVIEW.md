# PvE verification after selective material repairs

Current ordinary evidence: **7,744 attempts**, 88.6% attempt-weighted clears; 88.9% equal-Sequence mean. **7/10** Sequence point estimates lie in 85–90%.
Current Wanted evidence: **1,152 attempts**; **5/6** boss point estimates lie in 80–90%; **6/6** meet the ≤10% permanent-owner-casualty-attempt target.

This is a mixed snapshot compilation. Only ordinary Sequences 8, 5, 1, 0 and Wanted vacant_crown, last_hour were freshly verified after the material repairs. Other blocks retain their original source/profile snapshots and were not rerun under the revised runtime. The new subsets replace the affected old verification blocks; they are not appended to them.

## Ordinary contracts

| Sequence | Evidence | Seeds/path | NPC multiplier | Clears | Scenario bootstrap 95% interval | Casualty attempts | Timeouts | Pathway range |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | --- |
| 9 | retained baseline | 44 | 1.02086 | 854/968 (88.2%) | 83.7%–92.7% | 86 (8.9%) | 0 | 75.0%–100.0% |
| 8 | fresh revision | 22 | 0.90164 | 452/484 (93.4%) | 89.7%–96.5% | 25 (5.2%) | 0 | 81.8%–100.0% |
| 7 | retained baseline | 44 | 0.9166 | 826/968 (85.3%) | 81.6%–89.0% | 95 (9.8%) | 0 | 75.0%–95.5% |
| 6 | retained baseline | 44 | 0.86331 | 859/968 (88.7%) | 85.7%–91.4% | 70 (7.2%) | 0 | 72.7%–97.7% |
| 5 | fresh revision | 22 | 0.8596 | 426/484 (88.0%) | 83.5%–91.9% | 42 (8.7%) | 0 | 68.2%–100.0% |
| 4 | retained baseline | 44 | 0.80547 | 873/968 (90.2%) | 87.5%–92.7% | 69 (7.1%) | 0 | 77.3%–100.0% |
| 3 | retained baseline | 44 | 0.81829 | 861/968 (88.9%) | 86.0%–91.7% | 78 (8.1%) | 3 | 77.3%–97.7% |
| 2 | retained baseline | 44 | 0.81 | 842/968 (87.0%) | 84.4%–89.6% | 83 (8.6%) | 4 | 70.5%–97.7% |
| 1 | fresh revision | 22 | 0.80868 | 440/484 (90.9%) | 87.4%–94.4% | 29 (6.0%) | 2 | 77.3%–100.0% |
| 0 | fresh revision | 22 | 0.78411 | 429/484 (88.6%) | 84.1%–92.6% | 42 (8.7%) | 0 | 72.7%–100.0% |

Revised ordinary blocks use 22 independent verification seeds per pathway, cycling through all 22 normal NPC pathways once; retained blocks use 44 seeds and two cycles. Actual live contracts and variants remain active. Each hero pathway faces the same NPC inputs within a scenario, so Sequence confidence intervals resample shared scenarios. Cohort Wilson intervals remain in the compact summary and the source reports.

At 22 samples, only 19/22 (86.4%) lands inside the 85–90% point-estimate window; at 44 samples, 38/44 (86.4%) and 39/44 (88.6%) qualify. 49/220 current pathway–Sequence point estimates lie in that window (58 below, 113 above). This fraction does not establish true per-pathway rates. A shared NPC scalar cannot promise identical clear rates across pathways.

The attempt-weighted total gives a retained Sequence twice the weight of a revised Sequence. The equal-Sequence mean avoids that weighting difference. No pooled confidence interval is claimed for a single current profile, because this compilation combines different source/profile snapshots.

The live whole-party-defeat retreat rule remains one 30% roll. Current evidence observed 254/873 successful rolls (29.1%); 254 returning owners were asserted at 99 injuries. Captured fixture bodies remain independent of NPC strength.

S2's earlier rejected verification remains explicitly reclassified as calibration evidence: strength 0.84789 cleared 796/968 (82.2%). Separate training seed 17441191 selected strength 0.81, followed by fresh verification seed 281744119. That repaired S2 result is retained unchanged. Full history remains in `/workspace/guild_assessment/category-ability-ai/ordinary-finish-final.json`, `/workspace/guild_assessment/category-ability-ai/ordinary-finish-first-holdout.json`, and `/workspace/guild_assessment/category-ability-ai/ordinary-finish-seq2-repair.json`.

## Wanted bosses

| Boss | Evidence | Seeds/team | Clears | Wilson 95% interval | Any permanent owner casualty | Timeouts | Mean rounds | Party clear range | Phase rate |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | --- | ---: |
| red_knife | retained baseline | 32 | 162/192 (84.4%) | 78.6%–88.8% | 0 (0.0%) | 30 | 44.1 | 75.0%–93.8% | 100.0% |
| black_mirror | retained baseline | 32 | 175/192 (91.1%) | 86.3%–94.4% | 0 (0.0%) | 17 | 37.1 | 62.5%–100.0% | 100.0% |
| broken_hour | retained baseline | 32 | 172/192 (89.6%) | 84.5%–93.2% | 0 (0.0%) | 20 | 40.1 | 40.6%–100.0% | 100.0% |
| ashen_choir | retained baseline | 32 | 172/192 (89.6%) | 84.5%–93.2% | 0 (0.0%) | 20 | 27.2 | 37.5%–100.0% | 100.0% |
| vacant_crown | fresh revision | 32 | 166/192 (86.5%) | 80.9%–90.6% | 0 (0.0%) | 26 | 36.8 | 62.5%–100.0% | 100.0% |
| last_hour | fresh revision | 32 | 169/192 (88.0%) | 82.7%–91.9% | 0 (0.0%) | 23 | 37.7 | 62.5%–100.0% | 100.0% |

Each attempt deploys exactly three awakened owners. Companions enter as extra units and do not satisfy the three-owner requirement. Casualty attempts count any permanent owner loss, including victories and timeouts. Six fixed compositions are representative coverage; they do not establish results for every possible party.

| Boss | HP | ATK | DEF | INT | Direct outgoing | Periodic outgoing | Periodic incoming | Same-side collateral |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| red_knife | 54.074054399999994 | 1.05 | 0.8 | 1 | 0.1 | 0.2 | 0.35 | 1 |
| black_mirror | 42.14635 | 1.1 | 0.8 | 0.63 | 0.042 | 0.25 | 0.5 | 0.25 |
| broken_hour | 24.50214 | 1 | 0.8 | 1.05 | 0.075 | 0.5 | 0.35 | 0.25 |
| ashen_choir | 7.925658999999999 | 1.05 | 0.8 | 1.1 | 0.15 | 1 | 0.85 | 1 |
| vacant_crown | 20.012054 | 1.05 | 0.85 | 1.1 | 0.08000000000000002 | 1 | 1 | 1 |
| last_hour | 21.812724000000003 | 1.05 | 0.8 | 1.1 | 0.04 | 1 | 0.35 | 1 |

## Superseded diagnostics

Last Hour’s first revised result cleared 191/192 (99.48%) and materially exceeded the target. Three preselected HP-only factors (1.3/1.5/1.7) were tested on new 24-seed training samples (571744119). Factor 1.5 was selected at 88.89% training clears; one fresh 32-seed/team holdout (731744119) cleared 169/192 (88.02%), with zero casualties. Every other boss field and all other current verification rows were preserved.

The 4,448 affected old attempts are excluded from every current total. They remain intact in immutable baseline reports with their original hashes; the compact summary records explicit pointers and classifications.

| Superseded block | Old samples/cohort | Old clears | Full raw evidence |
| --- | ---: | ---: | --- |
| Ordinary S8 | 44/path | 876/968 (90.5%) | `/workspace/guild_assessment/category-ability-ai/ordinary-finish-final.json`: results[1].holdout |
| Ordinary S5 | 44/path | 849/968 (87.7%) | `/workspace/guild_assessment/category-ability-ai/ordinary-finish-final.json`: results[4].holdout |
| Ordinary S1 | 44/path | 867/968 (89.6%) | `/workspace/guild_assessment/category-ability-ai/ordinary-finish-final.json`: results[8].holdout |
| Ordinary S0 | 44/path | 838/968 (86.6%) | `/workspace/guild_assessment/category-ability-ai/ordinary-finish-final.json`: results[9].holdout |
| Wanted vacant_crown | 32/team | 163/192 (84.9%) | `/workspace/guild_assessment/category-ability-ai/wanted-finish-final.json`: aggregates[4] |
| Wanted last_hour | 32/team | 169/192 (88.0%) | `/workspace/guild_assessment/category-ability-ai/wanted-finish-final.json`: aggregates[5] |
| Wanted last_hour | 32/team | 191/192 (99.5%) | `/workspace/guild_assessment/category-ability-ai/wanted-material-revision.json`: aggregates[1] |

## Provenance and method

Controlled Rare Sword, balanced current Rare collections, Stout Vitality, full SP, zero injuries/mastery/starting charge, and no individual stat variance. Both modes retain cap 50, flat 2× global damage, zero overtime damage, full healing, authored Evade, and the live retreat rule. Injuries have no passive day recovery; paid treatment clears them without advancing real time.

Frozen revision profile: `/workspace/guild_assessment/category-ability-ai/bounded-repair-v2/final-profile.json`; SHA-256 `182011e7a3f3e7d829f40179dc4e55b5959850d94cc1449346fb7d4a3b464352`.

| Source report | Role | Report SHA-256 | Profile SHA-256 | Source fingerprint | Stable flag |
| --- | --- | --- | --- | --- | --- |
| `/workspace/guild_assessment/category-ability-ai/ordinary-finish-final.json` | retained + superseded ordinary | `2edb1bf0a5ba4023023d9262c26bed0e751db299092c276d3fa51fb40372c05c` | `208f3cf004930a38f0a94386ea308c6275d966d42d66e87e2d880bb072f4dc81` | `10f55f27dfabc42ba3f098e796b7a4a15ff96d8d884005adffbf804d7d9c58aa` | true |
| `/workspace/guild_assessment/category-ability-ai/ordinary-material-revision.json` | fresh ordinary | `16bd914842cd1356c626ffcbe47c82460534e3c6835151a66610e13e6c71f517` | `182011e7a3f3e7d829f40179dc4e55b5959850d94cc1449346fb7d4a3b464352` | `1397aba6435f5f78de005919cce4bd03020a479629feb79179a30c56e90d6612` | true |
| `/workspace/guild_assessment/category-ability-ai/wanted-finish-final.json` | retained + superseded Wanted | `2e874b39f2433328f7293cab862a2f9bc494ee3948be1135a110911c1fe4d9f8` | `208f3cf004930a38f0a94386ea308c6275d966d42d66e87e2d880bb072f4dc81` | `2e7d04039599ea80c8d144c4a392c9e9c933bd25f8e9d110e8bc3c26564083b1` | not recorded |
| `/workspace/guild_assessment/category-ability-ai/wanted-material-revision.json` | fresh Vacant + rejected Last diagnostic | `006c99c06733ef70188a96f1e167b4e582c17d1baf5a63a7354bdfcc970c6e87` | `182011e7a3f3e7d829f40179dc4e55b5959850d94cc1449346fb7d4a3b464352` | `434b8a21e5250c68e15b082b85278a728ab8f3ea28028fbbb278d3414f83b835` | not recorded |
| `/workspace/guild_assessment/category-ability-ai/wanted-last-material-repair.json` | fresh final Last HP repair | `27d685cd18cd31276d3df1493602026beade2087b7cd82cba226f371c011f0cf` | `182011e7a3f3e7d829f40179dc4e55b5959850d94cc1449346fb7d4a3b464352` | `434b8a21e5250c68e15b082b85278a728ab8f3ea28028fbbb278d3414f83b835` | not recorded |

Baseline Wanted budget profile: `/workspace/guild_assessment/category-ability-ai/wanted-finish-final-recommendations.json`; SHA-256 `495bd0dba24ffa9221a5987476d588b8d30e574733d14c2d51b908ba88d63801`.
Last HP repair Wanted budget profile: `/workspace/guild_assessment/category-ability-ai/wanted-last-hp-1.5-profile.json`; SHA-256 `40bdc5e700cda171930107237c9a6c8df036475d2038839c852241b4869436ce`.

Fingerprints belong to the report-specific hashing methods; different tools may fingerprint different file lists. Per-Sequence and per-boss provenance in the compact summary identifies the exact report, profile hash, source fingerprint, sampling and seeds for each retained or fresh block. Complete effective rules, loadouts and battle records remain in the referenced source reports.
The compact summary stores frozen revised ordinary rules at top level for compatibility. Only the revision scope was re-simulated under those rules; baselineRulesReference links the original effective rules for retained evidence.

Exact current source recipes: [ordinary-current-multipliers.json](ordinary-current-multipliers.json) and [wanted-current-recommendations.json](wanted-current-recommendations.json).

Report assembly ran no combat simulations and changed no game data. It preserved the two baseline JSON files. 2,320 fresh subset attempts supply the revision evidence. Current compact summary: [ordinary-final-summary.json](ordinary-final-summary.json).
