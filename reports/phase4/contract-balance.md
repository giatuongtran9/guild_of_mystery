# Phase 4 contract balance

The final unchanged `node tests/balance.js` run passed **152 checks, zero failures**. Each same-path rate below uses 1,000 seeded quests per pathway and Sequence; the opening mixed-party sample also uses 1,000 seeded quests.

These are **PvE contract success rates**, using the existing randomized recruits, scout approach and Balance Trial contract/enemy generation. They are separate from the neutral paired-pathway round robin in `after-neutral.md`. The original fixture starts with zero SP on both teams, rather than the neutral sweep's full-SP entry. No assertions or thresholds were weakened.

| Existing check | Before Phase 4 | Final | Unchanged limit |
| --- | --- | --- | --- |
| Fresh mixed Sequence 9 party wins | 68.7% | 84.2% | 65%–99% |
| Fresh mixed Sequence 9 deaths per quest | 1.00 | 0.35 | ≤0.60 |
| Same-path Sequence 9 spread | 73.9 percentage points | 67.3 percentage points | ≤75 percentage points |
| Same-path Sequence 5 spread | 100.0 percentage points | 70.0 percentage points | ≤75 percentage points |
| Full existing suite | 150 passed / 2 failed | 152 passed / 0 failed | All checks pass |

Sequence 9's spread check already passed in the verified deployed baseline. Sequence 5's spread and the opening casualty limit were the two actual failures; both now pass. The requested two spread checks are retained and green.

## Success rates per pathway

| Pathway | Seq9 before % | Seq9 final % | Seq5 before % | Seq5 final % |
| --- | --- | --- | --- | --- |
| fool | 82.1 | 93.4 | 78.1 | 76.8 |
| door | 85.5 | 94.8 | 100.0 | 100.0 |
| error | 97.2 | 99.7 | 74.0 | 40.6 |
| visionary | 26.7 | 53.6 | 62.0 | 80.6 |
| sun | 97.7 | 99.7 | 78.0 | 69.7 |
| tyrant | 75.3 | 99.6 | 9.4 | 47.7 |
| white_tower | 95.9 | 99.6 | 43.5 | 90.6 |
| hanged_man | 71.0 | 99.6 | 6.2 | 37.8 |
| darkness | 89.7 | 99.8 | 0.2 | 49.3 |
| death | 75.0 | 99.6 | 0.0 | 41.2 |
| twilight_giant | 92.7 | 99.9 | 22.6 | 62.7 |
| red_priest | 98.6 | 100.0 | 64.2 | 76.7 |
| demoness | 94.5 | 99.9 | 94.3 | 100.0 |
| hermit | 79.5 | 93.4 | 97.8 | 98.0 |
| paragon | 95.8 | 99.6 | 86.6 | 96.1 |
| wheel_of_fortune | 96.5 | 97.2 | 0.0 | 32.6 |
| mother | 81.1 | 99.6 | 12.7 | 47.9 |
| moon | 25.8 | 32.7 | 59.8 | 75.7 |
| abyss | 99.7 | 100.0 | 79.7 | 91.2 |
| chained | 79.6 | 99.6 | 8.5 | 72.7 |
| black_emperor | 39.9 | 81.4 | 1.1 | 30.0 |
| justiciar | 70.6 | 99.6 | 0.2 | 31.3 |

Fool thread completion remains within its existing bounds: **32.7%** at Sequence 5 (required 20%–50%) and **37.7%** at Sequence 4 (required 35%–85%). The existing slots remain `[1, 1, 2, 2, 3, 4]` at Sequences 5–0.

Numerical changes and their regression evidence are listed in `balance-tuning.md`. Contract gates tolerate wide spreads; passing them does not imply equal matchup strength. `after-neutral.md` explicitly reports draws, high-rank differences and the small independent-seed sample. No artwork, saves or production files were changed by this report aggregation.

Evidence: final log `/tmp/phase4-balance-final-stable.log`; deployed-baseline log `/tmp/phase4-balance-baseline.log`. The values above are transcribed from those real complete-battle suite results. Reproduce the final contract checks with `node tests/balance.js`.
