# Phase 4 after: neutral matched battles

Ran **45,540 complete battles** across all 22 pathways and Sequences 9–0. Each matchup uses one seed with both team assignments. This covers 1v1 and 3v3, initial charge 0/50/100, normal entry at every Sequence and controlled form entry at Sequences 4–0.

Same Sequence, neutral stat variance, Stout Vitality trait, no equipment, full initial SP and no injury/madness. Both assignments preserve actor names and use the same seed. Individual mode removes the PvE enemy damage multiplier; archetype stats and innate pathway passives remain. Mirrors are included. Each pathway has 46 team outcomes against all 22 opponents for each mode, charge and team size; the mirror contributes four observations. These paired observations are deterministic checks, not independent statistical samples.

Draw means both sides survive the existing 15-round cap or suffer simultaneous defeat. Draws are reported separately from losses. Form-entry fixtures begin at 49% HP on both sides; they probe authority interactions rather than typical encounter frequency. Each real battle asserted defined identity, finite stats/resources, valid HP/SP bounds and unchanged source profiles. Shared pathway definitions stayed unchanged.

All ten per-rank reports were checked: **zero controlled-fixture mismatches and zero swapped final-state mismatches**. Their CSVs contain exactly the expected 1,980 rows; wins + losses + draws equals battles in every row, and row rates reproduce their counts. The CSV tallies both teams, so its 91,080 team observations represent 45,540 complete battles.

The table below shows **normal 3v3, zero initial charge**, with each cell written as **win % / draw %**. The CSV contains every tested combination.

| Pathway | Seq9 | Seq8 | Seq7 | Seq6 | Seq5 | Seq4 | Seq3 | Seq2 | Seq1 | Seq0 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fool | 0.00 / 91.30 | 60.87 / 17.39 | 21.74 / 56.52 | 4.35 / 47.83 | 43.48 / 47.83 | 52.17 / 43.48 | 47.83 / 52.17 | 43.48 / 56.52 | 52.17 / 43.48 | 82.61 / 8.70 |
| door | 0.00 / 95.65 | 52.17 / 30.43 | 69.57 / 17.39 | 47.83 / 43.48 | 60.87 / 30.43 | 56.52 / 39.13 | 21.74 / 78.26 | 0.00 / 100.00 | 56.52 / 43.48 | 82.61 / 17.39 |
| error | 0.00 / 95.65 | 0.00 / 82.61 | 0.00 / 95.65 | 0.00 / 78.26 | 0.00 / 95.65 | 0.00 / 95.65 | 0.00 / 95.65 | 0.00 / 95.65 | 0.00 / 95.65 | 4.35 / 86.96 |
| visionary | 0.00 / 91.30 | 0.00 / 82.61 | 4.35 / 82.61 | 13.04 / 78.26 | 0.00 / 95.65 | 0.00 / 100.00 | 0.00 / 100.00 | 0.00 / 100.00 | 0.00 / 100.00 | 21.74 / 73.91 |
| sun | 0.00 / 91.30 | 34.78 / 39.13 | 0.00 / 86.96 | 0.00 / 86.96 | 8.70 / 82.61 | 0.00 / 82.61 | 0.00 / 91.30 | 0.00 / 91.30 | 13.04 / 78.26 | 8.70 / 78.26 |
| tyrant | 0.00 / 100.00 | 17.39 / 56.52 | 0.00 / 82.61 | 0.00 / 82.61 | 8.70 / 69.57 | 26.09 / 52.17 | 0.00 / 86.96 | 0.00 / 86.96 | 0.00 / 78.26 | 0.00 / 78.26 |
| white_tower | 0.00 / 95.65 | 65.22 / 8.70 | 43.48 / 21.74 | 17.39 / 47.83 | 26.09 / 60.87 | 4.35 / 91.30 | 17.39 / 73.91 | 4.35 / 91.30 | 0.00 / 95.65 | 13.04 / 65.22 |
| hanged_man | 0.00 / 95.65 | 34.78 / 34.78 | 0.00 / 95.65 | 0.00 / 78.26 | 4.35 / 78.26 | 0.00 / 82.61 | 0.00 / 91.30 | 0.00 / 91.30 | 0.00 / 91.30 | 0.00 / 86.96 |
| darkness | 0.00 / 91.30 | 4.35 / 65.22 | 0.00 / 91.30 | 0.00 / 100.00 | 0.00 / 100.00 | 0.00 / 95.65 | 0.00 / 95.65 | 0.00 / 100.00 | 0.00 / 100.00 | 0.00 / 91.30 |
| death | 4.35 / 91.30 | 0.00 / 56.52 | 0.00 / 95.65 | 0.00 / 100.00 | 4.35 / 95.65 | 0.00 / 100.00 | 0.00 / 100.00 | 0.00 / 95.65 | 0.00 / 91.30 | 0.00 / 91.30 |
| twilight_giant | 17.39 / 78.26 | 69.57 / 13.04 | 13.04 / 86.96 | 17.39 / 78.26 | 4.35 / 86.96 | 0.00 / 95.65 | 0.00 / 95.65 | 0.00 / 95.65 | 0.00 / 95.65 | 0.00 / 91.30 |
| red_priest | 4.35 / 91.30 | 0.00 / 47.83 | 0.00 / 60.87 | 26.09 / 30.43 | 26.09 / 52.17 | 30.43 / 56.52 | 26.09 / 60.87 | 47.83 / 39.13 | 26.09 / 60.87 | 21.74 / 65.22 |
| demoness | 4.35 / 86.96 | 0.00 / 47.83 | 4.35 / 60.87 | 13.04 / 69.57 | 4.35 / 82.61 | 0.00 / 95.65 | 0.00 / 95.65 | 30.43 / 60.87 | 26.09 / 69.57 | 0.00 / 82.61 |
| hermit | 0.00 / 95.65 | 52.17 / 30.43 | 17.39 / 78.26 | 39.13 / 56.52 | 13.04 / 73.91 | 0.00 / 82.61 | 0.00 / 86.96 | 0.00 / 91.30 | 0.00 / 91.30 | 0.00 / 86.96 |
| paragon | 0.00 / 86.96 | 30.43 / 30.43 | 13.04 / 82.61 | 43.48 / 56.52 | 13.04 / 86.96 | 0.00 / 100.00 | 0.00 / 95.65 | 0.00 / 91.30 | 0.00 / 86.96 | 0.00 / 82.61 |
| wheel_of_fortune | 0.00 / 95.65 | 0.00 / 86.96 | 0.00 / 95.65 | 0.00 / 100.00 | 0.00 / 100.00 | 0.00 / 100.00 | 0.00 / 100.00 | 0.00 / 100.00 | 0.00 / 95.65 | 0.00 / 95.65 |
| mother | 0.00 / 100.00 | 43.48 / 52.17 | 4.35 / 95.65 | 0.00 / 100.00 | 4.35 / 95.65 | 0.00 / 100.00 | 0.00 / 100.00 | 0.00 / 100.00 | 0.00 / 100.00 | 0.00 / 100.00 |
| moon | 0.00 / 100.00 | 0.00 / 100.00 | 34.78 / 65.22 | 17.39 / 82.61 | 8.70 / 91.30 | 0.00 / 95.65 | 0.00 / 95.65 | 0.00 / 100.00 | 0.00 / 91.30 | 0.00 / 86.96 |
| abyss | 78.26 / 17.39 | 56.52 / 26.09 | 34.78 / 56.52 | 34.78 / 47.83 | 0.00 / 91.30 | 0.00 / 91.30 | 0.00 / 95.65 | 0.00 / 91.30 | 0.00 / 86.96 | 0.00 / 86.96 |
| chained | 4.35 / 95.65 | 56.52 / 13.04 | 13.04 / 60.87 | 34.78 / 39.13 | 4.35 / 39.13 | 13.04 / 69.57 | 0.00 / 91.30 | 0.00 / 95.65 | 0.00 / 82.61 | 4.35 / 73.91 |
| black_emperor | 0.00 / 91.30 | 0.00 / 56.52 | 0.00 / 82.61 | 0.00 / 82.61 | 0.00 / 86.96 | 0.00 / 86.96 | 0.00 / 91.30 | 0.00 / 86.96 | 0.00 / 82.61 | 21.74 / 60.87 |
| justiciar | 0.00 / 95.65 | 8.70 / 47.83 | 0.00 / 100.00 | 0.00 / 95.65 | 0.00 / 86.96 | 0.00 / 78.26 | 0.00 / 100.00 | 0.00 / 86.96 | 0.00 / 91.30 | 0.00 / 86.96 |

## Limits and follow-up

The existing PvE contract gates pass, but this sweep does **not** establish universal PvP balance. At Sequence 9, 18 of 22 pathways draw in at least 91% of normal 3v3 matches. Abyss wins 78.26% and draws 17.39%; Twilight Giant wins 17.39%. At higher ranks, long draws remain common, while Fool and Door dominate many zero-charge matchups. Support pathways should also be judged in mixed parties, not solely by same-path duel wins.

One seed per unordered matchup is enough to expose deterministic state/side problems, but is too small to rank close contenders. Broader PvP tuning would need more independent seeds, mixed-party role coverage and a deliberate decision about the 15-round cap. The report preserves these limitations instead of treating draws as proof of parity.

## Per-rank aggregation verification

Runtime is the sum of each job's reported elapsed time; ranks were run separately and these figures are not one wall-clock measurement.

| Sequence | Complete battles | CSV rows | Fixture mismatches | Swapped mismatches | Job seconds |
| --- | --- | --- | --- | --- | --- |
| 9 | 3,036 | 132 | 0 | 0 | 142.6 |
| 8 | 3,036 | 132 | 0 | 0 | 91.4 |
| 7 | 3,036 | 132 | 0 | 0 | 41.4 |
| 6 | 3,036 | 132 | 0 | 0 | 56.9 |
| 5 | 3,036 | 132 | 0 | 0 | 89.7 |
| 4 | 6,072 | 264 | 0 | 0 | 353.9 |
| 3 | 6,072 | 264 | 0 | 0 | 120.2 |
| 2 | 6,072 | 264 | 0 | 0 | 112.5 |
| 1 | 6,072 | 264 | 0 | 0 | 143.6 |
| 0 | 6,072 | 264 | 0 | 0 | 108.4 |
| Total | 45,540 | 1,980 | 0 | 0 | 1260.6 |

Reproduce a rank with `node tests/phase4-balance.js --phase=after-seq9 --seeds=1 --sequences=9`; change the Sequence/phase for the other ranks. The default script covers all ranks in one run.

Verified source CSV SHA-256 values:

- `after-seq9-neutral.csv`: `8a28183e89f6133c9e995d23860e557119594b22b13991f6d07f0d968529226c`
- `after-seq8-neutral.csv`: `44162cc7305dab467b87e4af4f63a85b0e6952c3327d1569ff4ed3f63d72307d`
- `after-seq7-neutral.csv`: `48960a8687d2583ba0610002904954cc960707f16c9359e70c47459280b6d224`
- `after-seq6-neutral.csv`: `8a9c20446b0a56b114576f1d9fb06352ef506350d36e9c72cbde4a6e9a923811`
- `after-seq5-neutral.csv`: `f57b331abad0e0592e7b2d01159c6d8bbc78537e8d828e88949d592ff5090e2d`
- `after-seq4-neutral.csv`: `933725085890405d7bf08fb3932028f91746f75bb1073b6a08a2948bb0a82823`
- `after-seq3-neutral.csv`: `6fcec3a2dbedf0b092e4d4963b77464f002fa6103af938f1e81fb278f793de1b`
- `after-seq2-neutral.csv`: `93df8725ab3c1c8b8d3657c3fc79ed699f9a429f76f87963c228051b6b820b6e`
- `after-seq1-neutral.csv`: `78d0ca0da43d77b4edde25a431c1842aa771e60e3933829a9177b7b7dc3c90ce`
- `after-seq0-neutral.csv`: `ca344bf25787e194e2010d0202d2cb369e55e36ba94c3acf23dca0a3d91cc5d8`
