Profile file SHA-256: 182011e7a3f3e7d829f40179dc4e55b5959850d94cc1449346fb7d4a3b464352. Parsed-rules hash: 36f7df4bf5577cde8b1d9ed5ce46ca0a5116662ecc5726ea859f4f951c7e7c8a.

[22×10 rate matrices](final-pvp-v2-rates.md) · [Compact summary](final-pvp-v2.summary.json) · [Diagnostic archive](final-pvp-v2.diagnostic-training.json)

# v2 mixed-checkpoint holdout assembly

Sequences 9,7,6,4,3,2 retain v1 samples; Sequences 8,5,1,0 use fresh v2 replacement samples. This is a mixed-checkpoint assembly, not a fresh full-profile holdout or full-rule/source parity claim.

Frozen v2 profile: /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/final-profile.json. Retained incoming/native/empty/stats entries and global scalar configuration checks: PASS.

Retention also depends on the stated repair scope: Snake readiness applies only where unlocked at Sequences 1/0 (and copies); the native Wheel cooldown override applies only at Sequence 1. Configuration equality does not prove code or behavioral equality for retained samples.

The six unaffected Sequences preserve their original independent v1 holdout classification. Prior affected v1 Sequences 8,5,1,0 are archived separately as diagnostic training, excluded from current holdout counts. Replacement samples must not be used to refit this frozen candidate.

| Dataset | Seq | Provenance | Seed | Samples | Source fingerprint | Source file |
| --- | ---: | --- | ---: | ---: | --- | --- |
| prepared | 9 | retained-v1-holdout | 99007919 | 16 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 | /workspace/guild_assessment/category-ability-ai/final-holdout-prepared-high.json |
| prepared | 8 | replacement-v2-holdout | 291007919 | 16 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-prepared-s8.json |
| prepared | 7 | retained-v1-holdout | 99007919 | 16 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 | /workspace/guild_assessment/category-ability-ai/final-holdout-prepared-high.json |
| prepared | 6 | retained-v1-holdout | 99007919 | 16 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 | /workspace/guild_assessment/category-ability-ai/final-holdout-prepared-middle.json |
| prepared | 5 | replacement-v2-holdout | 291007919 | 16 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-prepared-s5.json |
| prepared | 4 | retained-v1-holdout | 99007919 | 16 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 | /workspace/guild_assessment/category-ability-ai/final-holdout-prepared-middle.json |
| prepared | 3 | retained-v1-holdout | 99007919 | 16 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 | /workspace/guild_assessment/category-ability-ai/final-holdout-prepared-low.json |
| prepared | 2 | retained-v1-holdout | 99007919 | 16 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 | /workspace/guild_assessment/category-ability-ai/final-holdout-prepared-low.json |
| prepared | 1 | replacement-v2-holdout | 291007919 | 16 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-prepared-s1.json |
| prepared | 0 | replacement-v2-holdout | 291007919 | 16 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-prepared-s0.json |
| empty | 9 | retained-v1-holdout | 99007919 | 16 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 | /workspace/guild_assessment/category-ability-ai/final-holdout-empty-high.json |
| empty | 8 | replacement-v2-holdout | 291007919 | 16 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-empty-s8.json |
| empty | 7 | retained-v1-holdout | 99007919 | 16 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 | /workspace/guild_assessment/category-ability-ai/final-holdout-empty-high.json |
| empty | 6 | retained-v1-holdout | 99007919 | 16 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 | /workspace/guild_assessment/category-ability-ai/final-holdout-empty-middle.json |
| empty | 5 | replacement-v2-holdout | 291007919 | 16 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-empty-s5.json |
| empty | 4 | retained-v1-holdout | 99007919 | 16 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 | /workspace/guild_assessment/category-ability-ai/final-holdout-empty-middle.json |
| empty | 3 | retained-v1-holdout | 99007919 | 16 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 | /workspace/guild_assessment/category-ability-ai/final-holdout-empty-low.json |
| empty | 2 | retained-v1-holdout | 99007919 | 16 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 | /workspace/guild_assessment/category-ability-ai/final-holdout-empty-low.json |
| empty | 1 | replacement-v2-holdout | 291007919 | 16 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-empty-s1.json |
| empty | 0 | replacement-v2-holdout | 291007919 | 16 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-empty-s0.json |

---

# Sampled PvP cohort report

Global 45–55% raw-win target, primary dataset: **FAIL (178/220 pass; 42 fail; 0 unavailable)**.

Empty diagnostic 35% raw-win floor: **PASS (220/220 pass; 0 fail; 0 unavailable)**.

Each criterion applies to all 220 pathway/Sequence cohorts in the supplied fixture. PASS describes this finite sample; it does not establish balance for other builds, fixtures, seeds, or opponents.

Raw win % = wins / all non-mirror attempts; draws count as non-wins. Draw % = draws / attempts. Score % = (wins + 0.5 × draws) / attempts. Cohort duration excludes mirrors; overall duration includes mirrors and timeouts. P95 uses sorted index min(N−1, floor(0.95 × N)), matching the benchmark helper.

The 95% Wilson intervals use wins / all non-mirror attempts, treating draws as non-wins under a binomial model. These are marginal intervals for individual cohorts, not simultaneous coverage across the 220 cohorts or universal assurance. Target and floor statuses use observed raw win rates, not interval bounds.

| Dataset | Covered / 220 | Total battles | Non-mirror battles | Draws, all battles | Observed mean / p95 | Completed mean / p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| primary | 220 | 40480 | 36960 | 204 | 8.55 / 19 | 8.42 / 19 |
| empty | 220 | 40480 | 36960 | 272 | 9.08 / 20 | 8.85 / 20 |

Completed duration excludes timeouts and retains mutual defeats. Unavailable p95 values are never estimated from the mean or substituted with p90/p99.

## Sources

| Dataset | File | Assets | Sequences | Samples | Seed base | Source fingerprint |
| --- | --- | --- | --- | ---: | ---: | --- |
| primary | /workspace/guild_assessment/category-ability-ai/final-holdout-prepared-high.json | rare | 9 | 16 | 99007919 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 |
| primary | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-prepared-s8.json | rare | 8 | 16 | 291007919 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 |
| primary | /workspace/guild_assessment/category-ability-ai/final-holdout-prepared-high.json | rare | 7 | 16 | 99007919 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 |
| primary | /workspace/guild_assessment/category-ability-ai/final-holdout-prepared-middle.json | rare | 6 | 16 | 99007919 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 |
| primary | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-prepared-s5.json | rare | 5 | 16 | 291007919 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 |
| primary | /workspace/guild_assessment/category-ability-ai/final-holdout-prepared-middle.json | rare | 4 | 16 | 99007919 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 |
| primary | /workspace/guild_assessment/category-ability-ai/final-holdout-prepared-low.json | rare | 3 | 16 | 99007919 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 |
| primary | /workspace/guild_assessment/category-ability-ai/final-holdout-prepared-low.json | rare | 2 | 16 | 99007919 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 |
| primary | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-prepared-s1.json | rare | 1 | 16 | 291007919 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 |
| primary | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-prepared-s0.json | rare | 0 | 16 | 291007919 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 |
| empty | /workspace/guild_assessment/category-ability-ai/final-holdout-empty-high.json | empty | 9 | 16 | 99007919 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 |
| empty | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-empty-s8.json | empty | 8 | 16 | 291007919 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 |
| empty | /workspace/guild_assessment/category-ability-ai/final-holdout-empty-high.json | empty | 7 | 16 | 99007919 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 |
| empty | /workspace/guild_assessment/category-ability-ai/final-holdout-empty-middle.json | empty | 6 | 16 | 99007919 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 |
| empty | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-empty-s5.json | empty | 5 | 16 | 291007919 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 |
| empty | /workspace/guild_assessment/category-ability-ai/final-holdout-empty-middle.json | empty | 4 | 16 | 99007919 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 |
| empty | /workspace/guild_assessment/category-ability-ai/final-holdout-empty-low.json | empty | 3 | 16 | 99007919 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 |
| empty | /workspace/guild_assessment/category-ability-ai/final-holdout-empty-low.json | empty | 2 | 16 | 99007919 | 3be33b3dffddc3cd2bcb6c4906dc6c54f524a74556841ddc8daaaea55b3bbc07 |
| empty | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-empty-s1.json | empty | 1 | 16 | 291007919 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 |
| empty | /workspace/guild_assessment/category-ability-ai/bounded-repair-v2/root-holdout-empty-s0.json | empty | 0 | 16 | 291007919 | e692781803d9652995aca2c85e7e423d2f617a139967614ba702a3cc86163065 |

## primary: criteria and side outcomes

45–55% raw-win target: **FAIL (178/220 pass; 42 fail; 0 unavailable)**.

Side outcome diagnostic, non-mirrors: allied wins **18499/36960 (50.05%)**; enemy wins **18336/36960 (49.61%)**; draws **125**. A/B allied assignments: **18480/18480**.

Replay parity: **UNAVAILABLE / not checked**. Side assignments and win rates do not establish replay parity; validate-incoming does not perform side-swap replays.

## primary: full 220-cohort matrix

Allied/enemy win % use that cohort’s attempts on the indicated combat side. Gap is allied minus enemy in percentage points; no acceptance threshold is assumed. Exact side W/L/D/attempts and availability reasons are in the CSV.

| Pathway | Seq | Wins | Losses | Draws | Attempts | Win % | 95% Wilson CI, % | Draw % | Score % | Mean | P95 | Allied win % | Enemy win % | Gap pp | 45–55 | 35 floor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| fool | 9 | 175 | 161 | 0 | 336 | 52.08 | 46.75–57.37 | 0.00 | 52.08 | 5.14 | 7 | 52.98 | 51.19 | 1.79 | PASS | N/A |
| fool | 8 | 164 | 172 | 0 | 336 | 48.81 | 43.51–54.14 | 0.00 | 48.81 | 4.67 | 7 | 47.62 | 50.00 | -2.38 | PASS | N/A |
| fool | 7 | 173 | 160 | 3 | 336 | 51.49 | 46.16–56.78 | 0.89 | 51.93 | 5.20 | 8 | 54.17 | 48.81 | 5.36 | PASS | N/A |
| fool | 6 | 142 | 191 | 3 | 336 | 42.26 | 37.10–47.60 | 0.89 | 42.71 | 5.63 | 9 | 42.26 | 42.26 | 0.00 | FAIL | N/A |
| fool | 5 | 175 | 157 | 4 | 336 | 52.08 | 46.75–57.37 | 1.19 | 52.68 | 4.26 | 6 | 53.57 | 50.60 | 2.98 | PASS | N/A |
| fool | 4 | 169 | 162 | 5 | 336 | 50.30 | 44.98–55.61 | 1.49 | 51.04 | 5.35 | 9 | 48.21 | 52.38 | -4.17 | PASS | N/A |
| fool | 3 | 159 | 174 | 3 | 336 | 47.32 | 42.04–52.66 | 0.89 | 47.77 | 4.88 | 9 | 52.38 | 42.26 | 10.12 | PASS | N/A |
| fool | 2 | 172 | 160 | 4 | 336 | 51.19 | 45.86–56.49 | 1.19 | 51.79 | 5.96 | 10 | 56.55 | 45.83 | 10.71 | PASS | N/A |
| fool | 1 | 174 | 157 | 5 | 336 | 51.79 | 46.45–57.08 | 1.49 | 52.53 | 4.57 | 7 | 45.24 | 58.33 | -13.10 | PASS | N/A |
| fool | 0 | 187 | 140 | 9 | 336 | 55.65 | 50.31–60.87 | 2.68 | 56.99 | 3.37 | 6 | 59.52 | 51.79 | 7.74 | FAIL | N/A |
| door | 9 | 176 | 160 | 0 | 336 | 52.38 | 47.04–57.66 | 0.00 | 52.38 | 5.58 | 7 | 52.38 | 52.38 | 0.00 | PASS | N/A |
| door | 8 | 161 | 175 | 0 | 336 | 47.92 | 42.63–53.25 | 0.00 | 47.92 | 5.31 | 7 | 50.60 | 45.24 | 5.36 | PASS | N/A |
| door | 7 | 158 | 178 | 0 | 336 | 47.02 | 41.75–52.36 | 0.00 | 47.02 | 5.12 | 8 | 47.62 | 46.43 | 1.19 | PASS | N/A |
| door | 6 | 186 | 150 | 0 | 336 | 55.36 | 50.01–60.58 | 0.00 | 55.36 | 5.96 | 9 | 52.38 | 58.33 | -5.95 | FAIL | N/A |
| door | 5 | 153 | 183 | 0 | 336 | 45.54 | 40.29–50.88 | 0.00 | 45.54 | 4.89 | 7 | 49.40 | 41.67 | 7.74 | PASS | N/A |
| door | 4 | 179 | 153 | 4 | 336 | 53.27 | 47.93–58.54 | 1.19 | 53.87 | 6.68 | 10 | 51.79 | 54.76 | -2.98 | PASS | N/A |
| door | 3 | 166 | 170 | 0 | 336 | 49.40 | 44.10–54.73 | 0.00 | 49.40 | 7.61 | 14 | 47.02 | 51.79 | -4.76 | PASS | N/A |
| door | 2 | 171 | 165 | 0 | 336 | 50.89 | 45.57–56.20 | 0.00 | 50.89 | 10.59 | 18 | 51.19 | 50.60 | 0.60 | PASS | N/A |
| door | 1 | 171 | 163 | 2 | 336 | 50.89 | 45.57–56.20 | 0.60 | 51.19 | 9.99 | 17 | 50.00 | 51.79 | -1.79 | PASS | N/A |
| door | 0 | 186 | 148 | 2 | 336 | 55.36 | 50.01–60.58 | 0.60 | 55.65 | 6.46 | 11 | 55.36 | 55.36 | 0.00 | FAIL | N/A |
| error | 9 | 173 | 163 | 0 | 336 | 51.49 | 46.16–56.78 | 0.00 | 51.49 | 5.87 | 8 | 50.00 | 52.98 | -2.98 | PASS | N/A |
| error | 8 | 190 | 146 | 0 | 336 | 56.55 | 51.20–61.74 | 0.00 | 56.55 | 6.66 | 9 | 59.52 | 53.57 | 5.95 | FAIL | N/A |
| error | 7 | 181 | 155 | 0 | 336 | 53.87 | 48.53–59.13 | 0.00 | 53.87 | 7.62 | 11 | 51.79 | 55.95 | -4.17 | PASS | N/A |
| error | 6 | 183 | 153 | 0 | 336 | 54.46 | 49.12–59.71 | 0.00 | 54.46 | 9.09 | 15 | 55.95 | 52.98 | 2.98 | PASS | N/A |
| error | 5 | 157 | 178 | 1 | 336 | 46.73 | 41.46–52.07 | 0.30 | 46.88 | 9.03 | 15 | 49.40 | 44.05 | 5.36 | PASS | N/A |
| error | 4 | 190 | 146 | 0 | 336 | 56.55 | 51.20–61.74 | 0.00 | 56.55 | 14.16 | 26 | 54.17 | 58.93 | -4.76 | FAIL | N/A |
| error | 3 | 177 | 137 | 22 | 336 | 52.68 | 47.34–57.96 | 6.55 | 55.95 | 21.46 | 50 | 52.98 | 52.38 | 0.60 | PASS | N/A |
| error | 2 | 147 | 182 | 7 | 336 | 43.75 | 38.55–49.10 | 2.08 | 44.79 | 17.07 | 35 | 45.24 | 42.26 | 2.98 | FAIL | N/A |
| error | 1 | 141 | 191 | 4 | 336 | 41.96 | 36.81–47.30 | 1.19 | 42.56 | 16.56 | 34 | 42.26 | 41.67 | 0.60 | FAIL | N/A |
| error | 0 | 160 | 176 | 0 | 336 | 47.62 | 42.34–52.96 | 0.00 | 47.62 | 5.59 | 12 | 47.62 | 47.62 | 0.00 | PASS | N/A |
| visionary | 9 | 158 | 178 | 0 | 336 | 47.02 | 41.75–52.36 | 0.00 | 47.02 | 5.27 | 7 | 50.00 | 44.05 | 5.95 | PASS | N/A |
| visionary | 8 | 168 | 168 | 0 | 336 | 50.00 | 44.68–55.32 | 0.00 | 50.00 | 6.21 | 9 | 47.02 | 52.98 | -5.95 | PASS | N/A |
| visionary | 7 | 153 | 183 | 0 | 336 | 45.54 | 40.29–50.88 | 0.00 | 45.54 | 6.55 | 11 | 46.43 | 44.64 | 1.79 | PASS | N/A |
| visionary | 6 | 189 | 147 | 0 | 336 | 56.25 | 50.90–61.45 | 0.00 | 56.25 | 7.40 | 12 | 56.55 | 55.95 | 0.60 | FAIL | N/A |
| visionary | 5 | 176 | 160 | 0 | 336 | 52.38 | 47.04–57.66 | 0.00 | 52.38 | 8.79 | 15 | 54.76 | 50.00 | 4.76 | PASS | N/A |
| visionary | 4 | 165 | 171 | 0 | 336 | 49.11 | 43.80–54.43 | 0.00 | 49.11 | 12.00 | 22 | 51.19 | 47.02 | 4.17 | PASS | N/A |
| visionary | 3 | 185 | 151 | 0 | 336 | 55.06 | 49.71–60.29 | 0.00 | 55.06 | 12.69 | 23 | 58.33 | 51.79 | 6.55 | FAIL | N/A |
| visionary | 2 | 175 | 160 | 1 | 336 | 52.08 | 46.75–57.37 | 0.30 | 52.23 | 18.22 | 34 | 51.79 | 52.38 | -0.60 | PASS | N/A |
| visionary | 1 | 163 | 173 | 0 | 336 | 48.51 | 43.22–53.84 | 0.00 | 48.51 | 12.57 | 22 | 50.00 | 47.02 | 2.98 | PASS | N/A |
| visionary | 0 | 174 | 161 | 1 | 336 | 51.79 | 46.45–57.08 | 0.30 | 51.93 | 8.98 | 17 | 51.79 | 51.79 | 0.00 | PASS | N/A |
| sun | 9 | 166 | 169 | 1 | 336 | 49.40 | 44.10–54.73 | 0.30 | 49.55 | 5.17 | 7 | 50.00 | 48.81 | 1.19 | PASS | N/A |
| sun | 8 | 184 | 152 | 0 | 336 | 54.76 | 49.42–60.00 | 0.00 | 54.76 | 4.97 | 7 | 51.19 | 58.33 | -7.14 | PASS | N/A |
| sun | 7 | 160 | 176 | 0 | 336 | 47.62 | 42.34–52.96 | 0.00 | 47.62 | 5.96 | 10 | 47.02 | 48.21 | -1.19 | PASS | N/A |
| sun | 6 | 174 | 162 | 0 | 336 | 51.79 | 46.45–57.08 | 0.00 | 51.79 | 7.25 | 12 | 51.19 | 52.38 | -1.19 | PASS | N/A |
| sun | 5 | 171 | 165 | 0 | 336 | 50.89 | 45.57–56.20 | 0.00 | 50.89 | 6.20 | 10 | 56.55 | 45.24 | 11.31 | PASS | N/A |
| sun | 4 | 152 | 184 | 0 | 336 | 45.24 | 40.00–50.58 | 0.00 | 45.24 | 6.40 | 11 | 42.86 | 47.62 | -4.76 | PASS | N/A |
| sun | 3 | 163 | 172 | 1 | 336 | 48.51 | 43.22–53.84 | 0.30 | 48.66 | 6.28 | 12 | 50.00 | 47.02 | 2.98 | PASS | N/A |
| sun | 2 | 161 | 175 | 0 | 336 | 47.92 | 42.63–53.25 | 0.00 | 47.92 | 8.07 | 15 | 45.83 | 50.00 | -4.17 | PASS | N/A |
| sun | 1 | 170 | 166 | 0 | 336 | 50.60 | 45.27–55.90 | 0.00 | 50.60 | 8.29 | 15 | 54.17 | 47.02 | 7.14 | PASS | N/A |
| sun | 0 | 183 | 151 | 2 | 336 | 54.46 | 49.12–59.71 | 0.60 | 54.76 | 7.17 | 13 | 53.57 | 55.36 | -1.79 | PASS | N/A |
| tyrant | 9 | 164 | 172 | 0 | 336 | 48.81 | 43.51–54.14 | 0.00 | 48.81 | 6.27 | 8 | 54.17 | 43.45 | 10.71 | PASS | N/A |
| tyrant | 8 | 157 | 179 | 0 | 336 | 46.73 | 41.46–52.07 | 0.00 | 46.73 | 5.70 | 8 | 42.86 | 50.60 | -7.74 | PASS | N/A |
| tyrant | 7 | 169 | 167 | 0 | 336 | 50.30 | 44.98–55.61 | 0.00 | 50.30 | 6.57 | 10 | 50.60 | 50.00 | 0.60 | PASS | N/A |
| tyrant | 6 | 168 | 168 | 0 | 336 | 50.00 | 44.68–55.32 | 0.00 | 50.00 | 6.59 | 10 | 54.17 | 45.83 | 8.33 | PASS | N/A |
| tyrant | 5 | 158 | 177 | 1 | 336 | 47.02 | 41.75–52.36 | 0.30 | 47.17 | 5.92 | 9 | 50.00 | 44.05 | 5.95 | PASS | N/A |
| tyrant | 4 | 164 | 172 | 0 | 336 | 48.81 | 43.51–54.14 | 0.00 | 48.81 | 7.94 | 14 | 50.60 | 47.02 | 3.57 | PASS | N/A |
| tyrant | 3 | 164 | 170 | 2 | 336 | 48.81 | 43.51–54.14 | 0.60 | 49.11 | 9.32 | 17 | 51.79 | 45.83 | 5.95 | PASS | N/A |
| tyrant | 2 | 143 | 191 | 2 | 336 | 42.56 | 37.39–47.90 | 0.60 | 42.86 | 10.27 | 18 | 44.64 | 40.48 | 4.17 | FAIL | N/A |
| tyrant | 1 | 181 | 154 | 1 | 336 | 53.87 | 48.53–59.13 | 0.30 | 54.02 | 12.53 | 21 | 51.19 | 56.55 | -5.36 | PASS | N/A |
| tyrant | 0 | 175 | 160 | 1 | 336 | 52.08 | 46.75–57.37 | 0.30 | 52.23 | 10.27 | 17 | 51.79 | 52.38 | -0.60 | PASS | N/A |
| white_tower | 9 | 180 | 155 | 1 | 336 | 53.57 | 48.23–58.83 | 0.30 | 53.72 | 4.88 | 6 | 52.38 | 54.76 | -2.38 | PASS | N/A |
| white_tower | 8 | 169 | 166 | 1 | 336 | 50.30 | 44.98–55.61 | 0.30 | 50.45 | 4.49 | 6 | 51.19 | 49.40 | 1.79 | PASS | N/A |
| white_tower | 7 | 175 | 159 | 2 | 336 | 52.08 | 46.75–57.37 | 0.60 | 52.38 | 4.90 | 7 | 54.17 | 50.00 | 4.17 | PASS | N/A |
| white_tower | 6 | 166 | 170 | 0 | 336 | 49.40 | 44.10–54.73 | 0.00 | 49.40 | 5.66 | 8 | 51.19 | 47.62 | 3.57 | PASS | N/A |
| white_tower | 5 | 176 | 160 | 0 | 336 | 52.38 | 47.04–57.66 | 0.00 | 52.38 | 6.36 | 10 | 53.57 | 51.19 | 2.38 | PASS | N/A |
| white_tower | 4 | 177 | 159 | 0 | 336 | 52.68 | 47.34–57.96 | 0.00 | 52.68 | 8.66 | 15 | 52.98 | 52.38 | 0.60 | PASS | N/A |
| white_tower | 3 | 142 | 194 | 0 | 336 | 42.26 | 37.10–47.60 | 0.00 | 42.26 | 7.83 | 13 | 41.07 | 43.45 | -2.38 | FAIL | N/A |
| white_tower | 2 | 171 | 163 | 2 | 336 | 50.89 | 45.57–56.20 | 0.60 | 51.19 | 11.23 | 20 | 50.60 | 51.19 | -0.60 | PASS | N/A |
| white_tower | 1 | 167 | 168 | 1 | 336 | 49.70 | 44.39–55.02 | 0.30 | 49.85 | 14.71 | 33 | 49.40 | 50.00 | -0.60 | PASS | N/A |
| white_tower | 0 | 142 | 193 | 1 | 336 | 42.26 | 37.10–47.60 | 0.30 | 42.41 | 8.03 | 15 | 44.05 | 40.48 | 3.57 | FAIL | N/A |
| hanged_man | 9 | 165 | 171 | 0 | 336 | 49.11 | 43.80–54.43 | 0.00 | 49.11 | 6.12 | 8 | 50.00 | 48.21 | 1.79 | PASS | N/A |
| hanged_man | 8 | 172 | 164 | 0 | 336 | 51.19 | 45.86–56.49 | 0.00 | 51.19 | 6.08 | 8 | 53.57 | 48.81 | 4.76 | PASS | N/A |
| hanged_man | 7 | 188 | 148 | 0 | 336 | 55.95 | 50.61–61.16 | 0.00 | 55.95 | 7.91 | 12 | 58.33 | 53.57 | 4.76 | FAIL | N/A |
| hanged_man | 6 | 166 | 170 | 0 | 336 | 49.40 | 44.10–54.73 | 0.00 | 49.40 | 9.36 | 15 | 54.76 | 44.05 | 10.71 | PASS | N/A |
| hanged_man | 5 | 161 | 175 | 0 | 336 | 47.92 | 42.63–53.25 | 0.00 | 47.92 | 7.35 | 12 | 50.00 | 45.83 | 4.17 | PASS | N/A |
| hanged_man | 4 | 161 | 174 | 1 | 336 | 47.92 | 42.63–53.25 | 0.30 | 48.07 | 9.98 | 18 | 45.24 | 50.60 | -5.36 | PASS | N/A |
| hanged_man | 3 | 170 | 164 | 2 | 336 | 50.60 | 45.27–55.90 | 0.60 | 50.89 | 15.05 | 39 | 52.38 | 48.81 | 3.57 | PASS | N/A |
| hanged_man | 2 | 167 | 165 | 4 | 336 | 49.70 | 44.39–55.02 | 1.19 | 50.30 | 13.84 | 34 | 48.21 | 51.19 | -2.98 | PASS | N/A |
| hanged_man | 1 | 186 | 147 | 3 | 336 | 55.36 | 50.01–60.58 | 0.89 | 55.80 | 17.63 | 40 | 53.57 | 57.14 | -3.57 | FAIL | N/A |
| hanged_man | 0 | 160 | 175 | 1 | 336 | 47.62 | 42.34–52.96 | 0.30 | 47.77 | 11.02 | 21 | 48.81 | 46.43 | 2.38 | PASS | N/A |
| darkness | 9 | 174 | 162 | 0 | 336 | 51.79 | 46.45–57.08 | 0.00 | 51.79 | 5.75 | 8 | 47.02 | 56.55 | -9.52 | PASS | N/A |
| darkness | 8 | 183 | 153 | 0 | 336 | 54.46 | 49.12–59.71 | 0.00 | 54.46 | 6.23 | 9 | 52.98 | 55.95 | -2.98 | PASS | N/A |
| darkness | 7 | 166 | 170 | 0 | 336 | 49.40 | 44.10–54.73 | 0.00 | 49.40 | 7.34 | 11 | 49.40 | 49.40 | 0.00 | PASS | N/A |
| darkness | 6 | 147 | 189 | 0 | 336 | 43.75 | 38.55–49.10 | 0.00 | 43.75 | 8.60 | 14 | 44.64 | 42.86 | 1.79 | FAIL | N/A |
| darkness | 5 | 180 | 156 | 0 | 336 | 53.57 | 48.23–58.83 | 0.00 | 53.57 | 10.10 | 17 | 54.17 | 52.98 | 1.19 | PASS | N/A |
| darkness | 4 | 185 | 151 | 0 | 336 | 55.06 | 49.71–60.29 | 0.00 | 55.06 | 10.39 | 18 | 56.55 | 53.57 | 2.98 | FAIL | N/A |
| darkness | 3 | 175 | 161 | 0 | 336 | 52.08 | 46.75–57.37 | 0.00 | 52.08 | 12.91 | 22 | 56.55 | 47.62 | 8.93 | PASS | N/A |
| darkness | 2 | 182 | 153 | 1 | 336 | 54.17 | 48.82–59.42 | 0.30 | 54.32 | 12.34 | 21 | 53.57 | 54.76 | -1.19 | PASS | N/A |
| darkness | 1 | 153 | 181 | 2 | 336 | 45.54 | 40.29–50.88 | 0.60 | 45.83 | 11.96 | 20 | 41.07 | 50.00 | -8.93 | PASS | N/A |
| darkness | 0 | 173 | 162 | 1 | 336 | 51.49 | 46.16–56.78 | 0.30 | 51.64 | 11.63 | 19 | 54.76 | 48.21 | 6.55 | PASS | N/A |
| death | 9 | 150 | 185 | 1 | 336 | 44.64 | 39.42–49.99 | 0.30 | 44.79 | 6.23 | 8 | 50.00 | 39.29 | 10.71 | FAIL | N/A |
| death | 8 | 177 | 159 | 0 | 336 | 52.68 | 47.34–57.96 | 0.00 | 52.68 | 5.16 | 7 | 54.17 | 51.19 | 2.98 | PASS | N/A |
| death | 7 | 167 | 168 | 1 | 336 | 49.70 | 44.39–55.02 | 0.30 | 49.85 | 5.32 | 8 | 48.81 | 50.60 | -1.79 | PASS | N/A |
| death | 6 | 165 | 171 | 0 | 336 | 49.11 | 43.80–54.43 | 0.00 | 49.11 | 5.35 | 8 | 52.38 | 45.83 | 6.55 | PASS | N/A |
| death | 5 | 175 | 161 | 0 | 336 | 52.08 | 46.75–57.37 | 0.00 | 52.08 | 5.23 | 8 | 50.00 | 54.17 | -4.17 | PASS | N/A |
| death | 4 | 157 | 179 | 0 | 336 | 46.73 | 41.46–52.07 | 0.00 | 46.73 | 7.71 | 14 | 47.62 | 45.83 | 1.79 | PASS | N/A |
| death | 3 | 167 | 168 | 1 | 336 | 49.70 | 44.39–55.02 | 0.30 | 49.85 | 9.67 | 18 | 48.81 | 50.60 | -1.79 | PASS | N/A |
| death | 2 | 175 | 159 | 2 | 336 | 52.08 | 46.75–57.37 | 0.60 | 52.38 | 9.40 | 18 | 51.19 | 52.98 | -1.79 | PASS | N/A |
| death | 1 | 174 | 161 | 1 | 336 | 51.79 | 46.45–57.08 | 0.30 | 51.93 | 10.22 | 18 | 52.38 | 51.19 | 1.19 | PASS | N/A |
| death | 0 | 150 | 184 | 2 | 336 | 44.64 | 39.42–49.99 | 0.60 | 44.94 | 8.85 | 15 | 44.05 | 45.24 | -1.19 | FAIL | N/A |
| twilight_giant | 9 | 150 | 185 | 1 | 336 | 44.64 | 39.42–49.99 | 0.30 | 44.79 | 5.45 | 7 | 45.83 | 43.45 | 2.38 | FAIL | N/A |
| twilight_giant | 8 | 171 | 164 | 1 | 336 | 50.89 | 45.57–56.20 | 0.30 | 51.04 | 5.15 | 7 | 50.60 | 51.19 | -0.60 | PASS | N/A |
| twilight_giant | 7 | 177 | 158 | 1 | 336 | 52.68 | 47.34–57.96 | 0.30 | 52.83 | 6.46 | 10 | 53.57 | 51.79 | 1.79 | PASS | N/A |
| twilight_giant | 6 | 166 | 170 | 0 | 336 | 49.40 | 44.10–54.73 | 0.00 | 49.40 | 6.68 | 11 | 47.62 | 51.19 | -3.57 | PASS | N/A |
| twilight_giant | 5 | 151 | 185 | 0 | 336 | 44.94 | 39.71–50.29 | 0.00 | 44.94 | 8.16 | 15 | 39.88 | 50.00 | -10.12 | FAIL | N/A |
| twilight_giant | 4 | 166 | 170 | 0 | 336 | 49.40 | 44.10–54.73 | 0.00 | 49.40 | 12.32 | 24 | 50.00 | 48.81 | 1.19 | PASS | N/A |
| twilight_giant | 3 | 162 | 160 | 14 | 336 | 48.21 | 42.92–53.55 | 4.17 | 50.30 | 17.72 | 47 | 51.19 | 45.24 | 5.95 | PASS | N/A |
| twilight_giant | 2 | 166 | 166 | 4 | 336 | 49.40 | 44.10–54.73 | 1.19 | 50.00 | 15.31 | 33 | 48.81 | 50.00 | -1.19 | PASS | N/A |
| twilight_giant | 1 | 178 | 158 | 0 | 336 | 52.98 | 47.64–58.25 | 0.00 | 52.98 | 13.76 | 28 | 51.19 | 54.76 | -3.57 | PASS | N/A |
| twilight_giant | 0 | 155 | 180 | 1 | 336 | 46.13 | 40.87–51.47 | 0.30 | 46.28 | 11.72 | 20 | 47.62 | 44.64 | 2.98 | PASS | N/A |
| red_priest | 9 | 166 | 167 | 3 | 336 | 49.40 | 44.10–54.73 | 0.89 | 49.85 | 5.29 | 7 | 50.60 | 48.21 | 2.38 | PASS | N/A |
| red_priest | 8 | 156 | 180 | 0 | 336 | 46.43 | 41.17–51.77 | 0.00 | 46.43 | 6.38 | 9 | 47.02 | 45.83 | 1.19 | PASS | N/A |
| red_priest | 7 | 180 | 156 | 0 | 336 | 53.57 | 48.23–58.83 | 0.00 | 53.57 | 6.31 | 10 | 54.76 | 52.38 | 2.38 | PASS | N/A |
| red_priest | 6 | 164 | 172 | 0 | 336 | 48.81 | 43.51–54.14 | 0.00 | 48.81 | 4.77 | 7 | 50.00 | 47.62 | 2.38 | PASS | N/A |
| red_priest | 5 | 171 | 165 | 0 | 336 | 50.89 | 45.57–56.20 | 0.00 | 50.89 | 5.44 | 8 | 55.95 | 45.83 | 10.12 | PASS | N/A |
| red_priest | 4 | 165 | 170 | 1 | 336 | 49.11 | 43.80–54.43 | 0.30 | 49.26 | 5.75 | 9 | 49.40 | 48.81 | 0.60 | PASS | N/A |
| red_priest | 3 | 188 | 148 | 0 | 336 | 55.95 | 50.61–61.16 | 0.00 | 55.95 | 7.09 | 12 | 57.14 | 54.76 | 2.38 | FAIL | N/A |
| red_priest | 2 | 167 | 167 | 2 | 336 | 49.70 | 44.39–55.02 | 0.60 | 50.00 | 7.36 | 12 | 50.60 | 48.81 | 1.79 | PASS | N/A |
| red_priest | 1 | 158 | 178 | 0 | 336 | 47.02 | 41.75–52.36 | 0.00 | 47.02 | 7.29 | 12 | 45.24 | 48.81 | -3.57 | PASS | N/A |
| red_priest | 0 | 161 | 173 | 2 | 336 | 47.92 | 42.63–53.25 | 0.60 | 48.21 | 6.61 | 11 | 48.21 | 47.62 | 0.60 | PASS | N/A |
| demoness | 9 | 178 | 158 | 0 | 336 | 52.98 | 47.64–58.25 | 0.00 | 52.98 | 5.52 | 7 | 52.38 | 53.57 | -1.19 | PASS | N/A |
| demoness | 8 | 136 | 200 | 0 | 336 | 40.48 | 35.36–45.80 | 0.00 | 40.48 | 5.53 | 8 | 39.29 | 41.67 | -2.38 | FAIL | N/A |
| demoness | 7 | 174 | 161 | 1 | 336 | 51.79 | 46.45–57.08 | 0.30 | 51.93 | 4.89 | 7 | 54.17 | 49.40 | 4.76 | PASS | N/A |
| demoness | 6 | 167 | 169 | 0 | 336 | 49.70 | 44.39–55.02 | 0.00 | 49.70 | 4.71 | 7 | 46.43 | 52.98 | -6.55 | PASS | N/A |
| demoness | 5 | 148 | 188 | 0 | 336 | 44.05 | 38.84–49.39 | 0.00 | 44.05 | 4.93 | 8 | 45.83 | 42.26 | 3.57 | FAIL | N/A |
| demoness | 4 | 191 | 145 | 0 | 336 | 56.85 | 51.50–62.03 | 0.00 | 56.85 | 6.46 | 11 | 56.55 | 57.14 | -0.60 | FAIL | N/A |
| demoness | 3 | 173 | 163 | 0 | 336 | 51.49 | 46.16–56.78 | 0.00 | 51.49 | 7.00 | 13 | 49.40 | 53.57 | -4.17 | PASS | N/A |
| demoness | 2 | 151 | 185 | 0 | 336 | 44.94 | 39.71–50.29 | 0.00 | 44.94 | 6.00 | 12 | 42.86 | 47.02 | -4.17 | FAIL | N/A |
| demoness | 1 | 166 | 169 | 1 | 336 | 49.40 | 44.10–54.73 | 0.30 | 49.55 | 6.32 | 11 | 44.64 | 54.17 | -9.52 | PASS | N/A |
| demoness | 0 | 189 | 147 | 0 | 336 | 56.25 | 50.90–61.45 | 0.00 | 56.25 | 6.64 | 11 | 56.55 | 55.95 | 0.60 | FAIL | N/A |
| hermit | 9 | 171 | 165 | 0 | 336 | 50.89 | 45.57–56.20 | 0.00 | 50.89 | 5.24 | 7 | 52.98 | 48.81 | 4.17 | PASS | N/A |
| hermit | 8 | 167 | 169 | 0 | 336 | 49.70 | 44.39–55.02 | 0.00 | 49.70 | 4.82 | 7 | 49.40 | 50.00 | -0.60 | PASS | N/A |
| hermit | 7 | 155 | 180 | 1 | 336 | 46.13 | 40.87–51.47 | 0.30 | 46.28 | 5.82 | 8 | 45.24 | 47.02 | -1.79 | PASS | N/A |
| hermit | 6 | 177 | 159 | 0 | 336 | 52.68 | 47.34–57.96 | 0.00 | 52.68 | 5.73 | 9 | 50.00 | 55.36 | -5.36 | PASS | N/A |
| hermit | 5 | 165 | 169 | 2 | 336 | 49.11 | 43.80–54.43 | 0.60 | 49.40 | 6.29 | 10 | 49.40 | 48.81 | 0.60 | PASS | N/A |
| hermit | 4 | 162 | 173 | 1 | 336 | 48.21 | 42.92–53.55 | 0.30 | 48.36 | 7.08 | 12 | 45.24 | 51.19 | -5.95 | PASS | N/A |
| hermit | 3 | 161 | 175 | 0 | 336 | 47.92 | 42.63–53.25 | 0.00 | 47.92 | 8.29 | 15 | 50.60 | 45.24 | 5.36 | PASS | N/A |
| hermit | 2 | 175 | 154 | 7 | 336 | 52.08 | 46.75–57.37 | 2.08 | 53.13 | 8.16 | 15 | 54.17 | 50.00 | 4.17 | PASS | N/A |
| hermit | 1 | 168 | 167 | 1 | 336 | 50.00 | 44.68–55.32 | 0.30 | 50.15 | 8.36 | 14 | 52.98 | 47.02 | 5.95 | PASS | N/A |
| hermit | 0 | 192 | 137 | 7 | 336 | 57.14 | 51.80–62.32 | 2.08 | 58.18 | 7.48 | 12 | 58.33 | 55.95 | 2.38 | FAIL | N/A |
| paragon | 9 | 167 | 169 | 0 | 336 | 49.70 | 44.39–55.02 | 0.00 | 49.70 | 5.17 | 7 | 48.81 | 50.60 | -1.79 | PASS | N/A |
| paragon | 8 | 154 | 182 | 0 | 336 | 45.83 | 40.58–51.18 | 0.00 | 45.83 | 4.82 | 7 | 40.48 | 51.19 | -10.71 | PASS | N/A |
| paragon | 7 | 154 | 181 | 1 | 336 | 45.83 | 40.58–51.18 | 0.30 | 45.98 | 5.92 | 9 | 47.62 | 44.05 | 3.57 | PASS | N/A |
| paragon | 6 | 141 | 193 | 2 | 336 | 41.96 | 36.81–47.30 | 0.60 | 42.26 | 5.44 | 9 | 45.24 | 38.69 | 6.55 | FAIL | N/A |
| paragon | 5 | 163 | 173 | 0 | 336 | 48.51 | 43.22–53.84 | 0.00 | 48.51 | 6.02 | 10 | 46.43 | 50.60 | -4.17 | PASS | N/A |
| paragon | 4 | 154 | 182 | 0 | 336 | 45.83 | 40.58–51.18 | 0.00 | 45.83 | 8.30 | 14 | 44.05 | 47.62 | -3.57 | PASS | N/A |
| paragon | 3 | 163 | 172 | 1 | 336 | 48.51 | 43.22–53.84 | 0.30 | 48.66 | 7.71 | 15 | 50.60 | 46.43 | 4.17 | PASS | N/A |
| paragon | 2 | 153 | 183 | 0 | 336 | 45.54 | 40.29–50.88 | 0.00 | 45.54 | 10.96 | 22 | 47.02 | 44.05 | 2.98 | PASS | N/A |
| paragon | 1 | 163 | 172 | 1 | 336 | 48.51 | 43.22–53.84 | 0.30 | 48.66 | 10.66 | 20 | 47.62 | 49.40 | -1.79 | PASS | N/A |
| paragon | 0 | 176 | 160 | 0 | 336 | 52.38 | 47.04–57.66 | 0.00 | 52.38 | 8.96 | 16 | 47.62 | 57.14 | -9.52 | PASS | N/A |
| wheel_of_fortune | 9 | 165 | 168 | 3 | 336 | 49.11 | 43.80–54.43 | 0.89 | 49.55 | 5.54 | 8 | 50.00 | 48.21 | 1.79 | PASS | N/A |
| wheel_of_fortune | 8 | 185 | 151 | 0 | 336 | 55.06 | 49.71–60.29 | 0.00 | 55.06 | 6.59 | 9 | 52.98 | 57.14 | -4.17 | FAIL | N/A |
| wheel_of_fortune | 7 | 176 | 159 | 1 | 336 | 52.38 | 47.04–57.66 | 0.30 | 52.53 | 9.32 | 15 | 49.40 | 55.36 | -5.95 | PASS | N/A |
| wheel_of_fortune | 6 | 176 | 160 | 0 | 336 | 52.38 | 47.04–57.66 | 0.00 | 52.38 | 7.50 | 12 | 54.76 | 50.00 | 4.76 | PASS | N/A |
| wheel_of_fortune | 5 | 165 | 171 | 0 | 336 | 49.11 | 43.80–54.43 | 0.00 | 49.11 | 7.68 | 12 | 47.62 | 50.60 | -2.98 | PASS | N/A |
| wheel_of_fortune | 4 | 186 | 150 | 0 | 336 | 55.36 | 50.01–60.58 | 0.00 | 55.36 | 12.02 | 21 | 58.33 | 52.38 | 5.95 | FAIL | N/A |
| wheel_of_fortune | 3 | 171 | 165 | 0 | 336 | 50.89 | 45.57–56.20 | 0.00 | 50.89 | 15.78 | 34 | 47.62 | 54.17 | -6.55 | PASS | N/A |
| wheel_of_fortune | 2 | 160 | 164 | 12 | 336 | 47.62 | 42.34–52.96 | 3.57 | 49.40 | 23.43 | 45 | 48.21 | 47.02 | 1.19 | PASS | N/A |
| wheel_of_fortune | 1 | 160 | 176 | 0 | 336 | 47.62 | 42.34–52.96 | 0.00 | 47.62 | 15.74 | 28 | 47.02 | 48.21 | -1.19 | PASS | N/A |
| wheel_of_fortune | 0 | 172 | 164 | 0 | 336 | 51.19 | 45.86–56.49 | 0.00 | 51.19 | 11.57 | 21 | 55.36 | 47.02 | 8.33 | PASS | N/A |
| mother | 9 | 154 | 182 | 0 | 336 | 45.83 | 40.58–51.18 | 0.00 | 45.83 | 6.25 | 8 | 36.90 | 54.76 | -17.86 | PASS | N/A |
| mother | 8 | 171 | 165 | 0 | 336 | 50.89 | 45.57–56.20 | 0.00 | 50.89 | 6.13 | 9 | 50.00 | 51.79 | -1.79 | PASS | N/A |
| mother | 7 | 162 | 174 | 0 | 336 | 48.21 | 42.92–53.55 | 0.00 | 48.21 | 7.49 | 12 | 51.19 | 45.24 | 5.95 | PASS | N/A |
| mother | 6 | 166 | 170 | 0 | 336 | 49.40 | 44.10–54.73 | 0.00 | 49.40 | 7.33 | 12 | 53.57 | 45.24 | 8.33 | PASS | N/A |
| mother | 5 | 165 | 171 | 0 | 336 | 49.11 | 43.80–54.43 | 0.00 | 49.11 | 9.15 | 16 | 48.81 | 49.40 | -0.60 | PASS | N/A |
| mother | 4 | 184 | 152 | 0 | 336 | 54.76 | 49.42–60.00 | 0.00 | 54.76 | 14.10 | 29 | 51.19 | 58.33 | -7.14 | PASS | N/A |
| mother | 3 | 147 | 167 | 22 | 336 | 43.75 | 38.55–49.10 | 6.55 | 47.02 | 18.79 | 50 | 44.05 | 43.45 | 0.60 | FAIL | N/A |
| mother | 2 | 172 | 152 | 12 | 336 | 51.19 | 45.86–56.49 | 3.57 | 52.98 | 18.66 | 42 | 47.62 | 54.76 | -7.14 | PASS | N/A |
| mother | 1 | 191 | 143 | 2 | 336 | 56.85 | 51.50–62.03 | 0.60 | 57.14 | 19.85 | 38 | 52.38 | 61.31 | -8.93 | FAIL | N/A |
| mother | 0 | 156 | 180 | 0 | 336 | 46.43 | 41.17–51.77 | 0.00 | 46.43 | 14.01 | 23 | 46.43 | 46.43 | 0.00 | PASS | N/A |
| moon | 9 | 171 | 165 | 0 | 336 | 50.89 | 45.57–56.20 | 0.00 | 50.89 | 6.28 | 9 | 49.40 | 52.38 | -2.98 | PASS | N/A |
| moon | 8 | 173 | 162 | 1 | 336 | 51.49 | 46.16–56.78 | 0.30 | 51.64 | 4.57 | 7 | 52.38 | 50.60 | 1.79 | PASS | N/A |
| moon | 7 | 174 | 162 | 0 | 336 | 51.79 | 46.45–57.08 | 0.00 | 51.79 | 4.55 | 7 | 50.00 | 53.57 | -3.57 | PASS | N/A |
| moon | 6 | 181 | 155 | 0 | 336 | 53.87 | 48.53–59.13 | 0.00 | 53.87 | 5.72 | 10 | 53.57 | 54.17 | -0.60 | PASS | N/A |
| moon | 5 | 181 | 155 | 0 | 336 | 53.87 | 48.53–59.13 | 0.00 | 53.87 | 6.25 | 11 | 54.76 | 52.98 | 1.79 | PASS | N/A |
| moon | 4 | 161 | 175 | 0 | 336 | 47.92 | 42.63–53.25 | 0.00 | 47.92 | 7.82 | 14 | 44.64 | 51.19 | -6.55 | PASS | N/A |
| moon | 3 | 163 | 173 | 0 | 336 | 48.51 | 43.22–53.84 | 0.00 | 48.51 | 10.10 | 22 | 52.98 | 44.05 | 8.93 | PASS | N/A |
| moon | 2 | 177 | 159 | 0 | 336 | 52.68 | 47.34–57.96 | 0.00 | 52.68 | 11.79 | 25 | 50.60 | 54.76 | -4.17 | PASS | N/A |
| moon | 1 | 156 | 180 | 0 | 336 | 46.43 | 41.17–51.77 | 0.00 | 46.43 | 11.66 | 26 | 47.62 | 45.24 | 2.38 | PASS | N/A |
| moon | 0 | 143 | 191 | 2 | 336 | 42.56 | 37.39–47.90 | 0.60 | 42.86 | 10.79 | 20 | 39.88 | 45.24 | -5.36 | FAIL | N/A |
| abyss | 9 | 182 | 154 | 0 | 336 | 54.17 | 48.82–59.42 | 0.00 | 54.17 | 4.64 | 6 | 53.57 | 54.76 | -1.19 | PASS | N/A |
| abyss | 8 | 168 | 168 | 0 | 336 | 50.00 | 44.68–55.32 | 0.00 | 50.00 | 5.23 | 7 | 51.79 | 48.21 | 3.57 | PASS | N/A |
| abyss | 7 | 178 | 157 | 1 | 336 | 52.98 | 47.64–58.25 | 0.30 | 53.13 | 5.76 | 9 | 57.14 | 48.81 | 8.33 | PASS | N/A |
| abyss | 6 | 171 | 165 | 0 | 336 | 50.89 | 45.57–56.20 | 0.00 | 50.89 | 6.03 | 9 | 48.21 | 53.57 | -5.36 | PASS | N/A |
| abyss | 5 | 194 | 142 | 0 | 336 | 57.74 | 52.40–62.90 | 0.00 | 57.74 | 8.46 | 14 | 59.52 | 55.95 | 3.57 | FAIL | N/A |
| abyss | 4 | 146 | 190 | 0 | 336 | 43.45 | 38.26–48.80 | 0.00 | 43.45 | 9.35 | 17 | 42.26 | 44.64 | -2.38 | FAIL | N/A |
| abyss | 3 | 173 | 162 | 1 | 336 | 51.49 | 46.16–56.78 | 0.30 | 51.64 | 13.64 | 32 | 49.40 | 53.57 | -4.17 | PASS | N/A |
| abyss | 2 | 176 | 159 | 1 | 336 | 52.38 | 47.04–57.66 | 0.30 | 52.53 | 13.22 | 27 | 57.74 | 47.02 | 10.71 | PASS | N/A |
| abyss | 1 | 160 | 175 | 1 | 336 | 47.62 | 42.34–52.96 | 0.30 | 47.77 | 13.04 | 23 | 47.02 | 48.21 | -1.19 | PASS | N/A |
| abyss | 0 | 154 | 181 | 1 | 336 | 45.83 | 40.58–51.18 | 0.30 | 45.98 | 10.67 | 18 | 41.67 | 50.00 | -8.33 | PASS | N/A |
| chained | 9 | 165 | 171 | 0 | 336 | 49.11 | 43.80–54.43 | 0.00 | 49.11 | 6.34 | 8 | 50.60 | 47.62 | 2.98 | PASS | N/A |
| chained | 8 | 146 | 189 | 1 | 336 | 43.45 | 38.26–48.80 | 0.30 | 43.60 | 4.85 | 8 | 40.48 | 46.43 | -5.95 | FAIL | N/A |
| chained | 7 | 154 | 182 | 0 | 336 | 45.83 | 40.58–51.18 | 0.00 | 45.83 | 5.40 | 9 | 42.26 | 49.40 | -7.14 | PASS | N/A |
| chained | 6 | 179 | 157 | 0 | 336 | 53.27 | 47.93–58.54 | 0.00 | 53.27 | 5.84 | 9 | 57.14 | 49.40 | 7.74 | PASS | N/A |
| chained | 5 | 184 | 152 | 0 | 336 | 54.76 | 49.42–60.00 | 0.00 | 54.76 | 6.55 | 11 | 60.71 | 48.81 | 11.90 | PASS | N/A |
| chained | 4 | 156 | 179 | 1 | 336 | 46.43 | 41.17–51.77 | 0.30 | 46.58 | 6.03 | 12 | 41.67 | 51.19 | -9.52 | PASS | N/A |
| chained | 3 | 175 | 159 | 2 | 336 | 52.08 | 46.75–57.37 | 0.60 | 52.38 | 9.50 | 22 | 50.00 | 54.17 | -4.17 | PASS | N/A |
| chained | 2 | 158 | 178 | 0 | 336 | 47.02 | 41.75–52.36 | 0.00 | 47.02 | 10.29 | 22 | 48.21 | 45.83 | 2.38 | PASS | N/A |
| chained | 1 | 186 | 150 | 0 | 336 | 55.36 | 50.01–60.58 | 0.00 | 55.36 | 10.49 | 19 | 53.57 | 57.14 | -3.57 | FAIL | N/A |
| chained | 0 | 170 | 166 | 0 | 336 | 50.60 | 45.27–55.90 | 0.00 | 50.60 | 6.78 | 14 | 53.57 | 47.62 | 5.95 | PASS | N/A |
| black_emperor | 9 | 184 | 152 | 0 | 336 | 54.76 | 49.42–60.00 | 0.00 | 54.76 | 5.90 | 8 | 52.98 | 56.55 | -3.57 | PASS | N/A |
| black_emperor | 8 | 193 | 143 | 0 | 336 | 57.44 | 52.10–62.61 | 0.00 | 57.44 | 7.29 | 10 | 61.90 | 52.98 | 8.93 | FAIL | N/A |
| black_emperor | 7 | 160 | 176 | 0 | 336 | 47.62 | 42.34–52.96 | 0.00 | 47.62 | 8.04 | 12 | 45.24 | 50.00 | -4.76 | PASS | N/A |
| black_emperor | 6 | 153 | 182 | 1 | 336 | 45.54 | 40.29–50.88 | 0.30 | 45.68 | 8.19 | 13 | 47.62 | 43.45 | 4.17 | PASS | N/A |
| black_emperor | 5 | 175 | 161 | 0 | 336 | 52.08 | 46.75–57.37 | 0.00 | 52.08 | 6.57 | 10 | 55.36 | 48.81 | 6.55 | PASS | N/A |
| black_emperor | 4 | 161 | 174 | 1 | 336 | 47.92 | 42.63–53.25 | 0.30 | 48.07 | 8.40 | 14 | 47.02 | 48.81 | -1.79 | PASS | N/A |
| black_emperor | 3 | 159 | 177 | 0 | 336 | 47.32 | 42.04–52.66 | 0.00 | 47.32 | 10.51 | 18 | 48.81 | 45.83 | 2.98 | PASS | N/A |
| black_emperor | 2 | 181 | 155 | 0 | 336 | 53.87 | 48.53–59.13 | 0.00 | 53.87 | 11.35 | 18 | 52.38 | 55.36 | -2.98 | PASS | N/A |
| black_emperor | 1 | 151 | 184 | 1 | 336 | 44.94 | 39.71–50.29 | 0.30 | 45.09 | 10.43 | 19 | 42.86 | 47.02 | -4.17 | FAIL | N/A |
| black_emperor | 0 | 163 | 171 | 2 | 336 | 48.51 | 43.22–53.84 | 0.60 | 48.81 | 9.18 | 16 | 50.00 | 47.02 | 2.98 | PASS | N/A |
| justiciar | 9 | 157 | 179 | 0 | 336 | 46.73 | 41.46–52.07 | 0.00 | 46.73 | 6.18 | 8 | 44.05 | 49.40 | -5.36 | PASS | N/A |
| justiciar | 8 | 149 | 187 | 0 | 336 | 44.35 | 39.13–49.69 | 0.00 | 44.35 | 5.96 | 9 | 42.26 | 46.43 | -4.17 | FAIL | N/A |
| justiciar | 7 | 156 | 180 | 0 | 336 | 46.43 | 41.17–51.77 | 0.00 | 46.43 | 7.85 | 13 | 50.60 | 42.26 | 8.33 | PASS | N/A |
| justiciar | 6 | 166 | 170 | 0 | 336 | 49.40 | 44.10–54.73 | 0.00 | 49.40 | 9.72 | 17 | 51.79 | 47.02 | 4.76 | PASS | N/A |
| justiciar | 5 | 148 | 188 | 0 | 336 | 44.05 | 38.84–49.39 | 0.00 | 44.05 | 8.13 | 14 | 50.60 | 37.50 | 13.10 | FAIL | N/A |
| justiciar | 4 | 158 | 178 | 0 | 336 | 47.02 | 41.75–52.36 | 0.00 | 47.02 | 7.91 | 14 | 47.02 | 47.02 | 0.00 | PASS | N/A |
| justiciar | 3 | 157 | 178 | 1 | 336 | 46.73 | 41.46–52.07 | 0.30 | 46.88 | 9.03 | 17 | 41.67 | 51.79 | -10.12 | PASS | N/A |
| justiciar | 2 | 165 | 170 | 1 | 336 | 49.11 | 43.80–54.43 | 0.30 | 49.26 | 12.43 | 23 | 52.38 | 45.83 | 6.55 | PASS | N/A |
| justiciar | 1 | 166 | 170 | 0 | 336 | 49.40 | 44.10–54.73 | 0.00 | 49.40 | 12.25 | 22 | 51.19 | 47.62 | 3.57 | PASS | N/A |
| justiciar | 0 | 157 | 178 | 1 | 336 | 46.73 | 41.46–52.07 | 0.30 | 46.88 | 10.15 | 17 | 45.83 | 47.62 | -1.79 | PASS | N/A |

## empty: criteria and side outcomes

45–55% raw-win target: **FAIL (131/220 pass; 89 fail; 0 unavailable)**.

35% raw-win floor: **PASS (220/220 pass; 0 fail; 0 unavailable)**.

Side outcome diagnostic, non-mirrors: allied wins **18458/36960 (49.94%)**; enemy wins **18360/36960 (49.68%)**; draws **142**. A/B allied assignments: **18480/18480**.

Replay parity: **UNAVAILABLE / not checked**. Side assignments and win rates do not establish replay parity; validate-incoming does not perform side-swap replays.

## empty: full 220-cohort matrix

Allied/enemy win % use that cohort’s attempts on the indicated combat side. Gap is allied minus enemy in percentage points; no acceptance threshold is assumed. Exact side W/L/D/attempts and availability reasons are in the CSV.

| Pathway | Seq | Wins | Losses | Draws | Attempts | Win % | 95% Wilson CI, % | Draw % | Score % | Mean | P95 | Allied win % | Enemy win % | Gap pp | 45–55 | 35 floor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| fool | 9 | 176 | 160 | 0 | 336 | 52.38 | 47.04–57.66 | 0.00 | 52.38 | 5.14 | 7 | 53.57 | 51.19 | 2.38 | PASS | PASS |
| fool | 8 | 166 | 170 | 0 | 336 | 49.40 | 44.10–54.73 | 0.00 | 49.40 | 4.65 | 7 | 49.40 | 49.40 | 0.00 | PASS | PASS |
| fool | 7 | 150 | 183 | 3 | 336 | 44.64 | 39.42–49.99 | 0.89 | 45.09 | 5.21 | 8 | 46.43 | 42.86 | 3.57 | FAIL | PASS |
| fool | 6 | 125 | 208 | 3 | 336 | 37.20 | 32.21–42.49 | 0.89 | 37.65 | 5.75 | 9 | 39.29 | 35.12 | 4.17 | FAIL | PASS |
| fool | 5 | 202 | 134 | 0 | 336 | 60.12 | 54.80–65.21 | 0.00 | 60.12 | 7.30 | 12 | 59.52 | 60.71 | -1.19 | FAIL | PASS |
| fool | 4 | 168 | 167 | 1 | 336 | 50.00 | 44.68–55.32 | 0.30 | 50.15 | 7.80 | 13 | 50.60 | 49.40 | 1.19 | PASS | PASS |
| fool | 3 | 138 | 198 | 0 | 336 | 41.07 | 35.94–46.40 | 0.00 | 41.07 | 8.04 | 14 | 39.88 | 42.26 | -2.38 | FAIL | PASS |
| fool | 2 | 208 | 128 | 0 | 336 | 61.90 | 56.61–66.94 | 0.00 | 61.90 | 9.56 | 20 | 61.90 | 61.90 | 0.00 | FAIL | PASS |
| fool | 1 | 203 | 133 | 0 | 336 | 60.42 | 55.10–65.50 | 0.00 | 60.42 | 9.46 | 19 | 60.71 | 60.12 | 0.60 | FAIL | PASS |
| fool | 0 | 201 | 133 | 2 | 336 | 59.82 | 54.50–64.92 | 0.60 | 60.12 | 8.30 | 14 | 63.69 | 55.95 | 7.74 | FAIL | PASS |
| door | 9 | 174 | 162 | 0 | 336 | 51.79 | 46.45–57.08 | 0.00 | 51.79 | 5.59 | 7 | 51.19 | 52.38 | -1.19 | PASS | PASS |
| door | 8 | 162 | 174 | 0 | 336 | 48.21 | 42.92–53.55 | 0.00 | 48.21 | 5.27 | 7 | 51.79 | 44.64 | 7.14 | PASS | PASS |
| door | 7 | 162 | 174 | 0 | 336 | 48.21 | 42.92–53.55 | 0.00 | 48.21 | 5.12 | 8 | 50.60 | 45.83 | 4.76 | PASS | PASS |
| door | 6 | 221 | 114 | 1 | 336 | 65.77 | 60.55–70.64 | 0.30 | 65.92 | 6.48 | 10 | 65.48 | 66.07 | -0.60 | FAIL | PASS |
| door | 5 | 147 | 189 | 0 | 336 | 43.75 | 38.55–49.10 | 0.00 | 43.75 | 5.04 | 8 | 43.45 | 44.05 | -0.60 | FAIL | PASS |
| door | 4 | 158 | 178 | 0 | 336 | 47.02 | 41.75–52.36 | 0.00 | 47.02 | 6.86 | 11 | 45.24 | 48.81 | -3.57 | PASS | PASS |
| door | 3 | 135 | 201 | 0 | 336 | 40.18 | 35.08–45.50 | 0.00 | 40.18 | 7.78 | 15 | 38.69 | 41.67 | -2.98 | FAIL | PASS |
| door | 2 | 151 | 185 | 0 | 336 | 44.94 | 39.71–50.29 | 0.00 | 44.94 | 12.67 | 23 | 48.21 | 41.67 | 6.55 | FAIL | PASS |
| door | 1 | 154 | 181 | 1 | 336 | 45.83 | 40.58–51.18 | 0.30 | 45.98 | 12.06 | 21 | 43.45 | 48.21 | -4.76 | PASS | PASS |
| door | 0 | 158 | 177 | 1 | 336 | 47.02 | 41.75–52.36 | 0.30 | 47.17 | 7.38 | 13 | 46.43 | 47.62 | -1.19 | PASS | PASS |
| error | 9 | 174 | 162 | 0 | 336 | 51.79 | 46.45–57.08 | 0.00 | 51.79 | 5.87 | 8 | 50.60 | 52.98 | -2.38 | PASS | PASS |
| error | 8 | 197 | 139 | 0 | 336 | 58.63 | 53.30–63.77 | 0.00 | 58.63 | 6.59 | 9 | 61.31 | 55.95 | 5.36 | FAIL | PASS |
| error | 7 | 186 | 150 | 0 | 336 | 55.36 | 50.01–60.58 | 0.00 | 55.36 | 7.74 | 11 | 53.57 | 57.14 | -3.57 | FAIL | PASS |
| error | 6 | 161 | 175 | 0 | 336 | 47.92 | 42.63–53.25 | 0.00 | 47.92 | 9.35 | 15 | 48.21 | 47.62 | 0.60 | PASS | PASS |
| error | 5 | 140 | 196 | 0 | 336 | 41.67 | 36.52–47.00 | 0.00 | 41.67 | 9.09 | 15 | 42.26 | 41.07 | 1.19 | FAIL | PASS |
| error | 4 | 170 | 166 | 0 | 336 | 50.60 | 45.27–55.90 | 0.00 | 50.60 | 14.64 | 27 | 50.00 | 51.19 | -1.19 | PASS | PASS |
| error | 3 | 170 | 136 | 30 | 336 | 50.60 | 45.27–55.90 | 8.93 | 55.06 | 22.27 | 50 | 51.19 | 50.00 | 1.19 | PASS | PASS |
| error | 2 | 146 | 183 | 7 | 336 | 43.45 | 38.26–48.80 | 2.08 | 44.49 | 17.39 | 35 | 45.83 | 41.07 | 4.76 | FAIL | PASS |
| error | 1 | 140 | 189 | 7 | 336 | 41.67 | 36.52–47.00 | 2.08 | 42.71 | 16.91 | 36 | 44.05 | 39.29 | 4.76 | FAIL | PASS |
| error | 0 | 166 | 170 | 0 | 336 | 49.40 | 44.10–54.73 | 0.00 | 49.40 | 5.94 | 13 | 50.00 | 48.81 | 1.19 | PASS | PASS |
| visionary | 9 | 159 | 177 | 0 | 336 | 47.32 | 42.04–52.66 | 0.00 | 47.32 | 5.27 | 7 | 49.40 | 45.24 | 4.17 | PASS | PASS |
| visionary | 8 | 160 | 176 | 0 | 336 | 47.62 | 42.34–52.96 | 0.00 | 47.62 | 6.16 | 9 | 42.86 | 52.38 | -9.52 | PASS | PASS |
| visionary | 7 | 152 | 184 | 0 | 336 | 45.24 | 40.00–50.58 | 0.00 | 45.24 | 6.57 | 11 | 46.43 | 44.05 | 2.38 | PASS | PASS |
| visionary | 6 | 210 | 125 | 1 | 336 | 62.50 | 57.21–67.51 | 0.30 | 62.65 | 7.95 | 14 | 61.90 | 63.10 | -1.19 | FAIL | PASS |
| visionary | 5 | 190 | 146 | 0 | 336 | 56.55 | 51.20–61.74 | 0.00 | 56.55 | 9.18 | 15 | 53.57 | 59.52 | -5.95 | FAIL | PASS |
| visionary | 4 | 218 | 118 | 0 | 336 | 64.88 | 59.63–69.79 | 0.00 | 64.88 | 13.40 | 26 | 65.48 | 64.29 | 1.19 | FAIL | PASS |
| visionary | 3 | 197 | 139 | 0 | 336 | 58.63 | 53.30–63.77 | 0.00 | 58.63 | 13.32 | 26 | 61.31 | 55.95 | 5.36 | FAIL | PASS |
| visionary | 2 | 198 | 135 | 3 | 336 | 58.93 | 53.60–64.06 | 0.89 | 59.38 | 20.80 | 40 | 53.57 | 64.29 | -10.71 | FAIL | PASS |
| visionary | 1 | 200 | 135 | 1 | 336 | 59.52 | 54.20–64.64 | 0.30 | 59.67 | 14.51 | 26 | 57.14 | 61.90 | -4.76 | FAIL | PASS |
| visionary | 0 | 191 | 145 | 0 | 336 | 56.85 | 51.50–62.03 | 0.00 | 56.85 | 9.65 | 17 | 61.90 | 51.79 | 10.12 | FAIL | PASS |
| sun | 9 | 163 | 172 | 1 | 336 | 48.51 | 43.22–53.84 | 0.30 | 48.66 | 5.15 | 7 | 49.40 | 47.62 | 1.79 | PASS | PASS |
| sun | 8 | 179 | 157 | 0 | 336 | 53.27 | 47.93–58.54 | 0.00 | 53.27 | 4.92 | 7 | 52.38 | 54.17 | -1.79 | PASS | PASS |
| sun | 7 | 154 | 182 | 0 | 336 | 45.83 | 40.58–51.18 | 0.00 | 45.83 | 6.03 | 10 | 44.64 | 47.02 | -2.38 | PASS | PASS |
| sun | 6 | 177 | 159 | 0 | 336 | 52.68 | 47.34–57.96 | 0.00 | 52.68 | 7.23 | 12 | 50.00 | 55.36 | -5.36 | PASS | PASS |
| sun | 5 | 159 | 177 | 0 | 336 | 47.32 | 42.04–52.66 | 0.00 | 47.32 | 6.42 | 10 | 55.36 | 39.29 | 16.07 | PASS | PASS |
| sun | 4 | 149 | 187 | 0 | 336 | 44.35 | 39.13–49.69 | 0.00 | 44.35 | 6.62 | 12 | 42.86 | 45.83 | -2.98 | FAIL | PASS |
| sun | 3 | 148 | 187 | 1 | 336 | 44.05 | 38.84–49.39 | 0.30 | 44.20 | 6.46 | 12 | 44.64 | 43.45 | 1.19 | FAIL | PASS |
| sun | 2 | 150 | 186 | 0 | 336 | 44.64 | 39.42–49.99 | 0.00 | 44.64 | 8.41 | 15 | 44.05 | 45.24 | -1.19 | FAIL | PASS |
| sun | 1 | 151 | 185 | 0 | 336 | 44.94 | 39.71–50.29 | 0.00 | 44.94 | 8.80 | 15 | 45.83 | 44.05 | 1.79 | FAIL | PASS |
| sun | 0 | 172 | 164 | 0 | 336 | 51.19 | 45.86–56.49 | 0.00 | 51.19 | 7.52 | 13 | 51.19 | 51.19 | 0.00 | PASS | PASS |
| tyrant | 9 | 165 | 171 | 0 | 336 | 49.11 | 43.80–54.43 | 0.00 | 49.11 | 6.27 | 8 | 54.17 | 44.05 | 10.12 | PASS | PASS |
| tyrant | 8 | 153 | 183 | 0 | 336 | 45.54 | 40.29–50.88 | 0.00 | 45.54 | 5.64 | 8 | 39.88 | 51.19 | -11.31 | PASS | PASS |
| tyrant | 7 | 160 | 176 | 0 | 336 | 47.62 | 42.34–52.96 | 0.00 | 47.62 | 6.64 | 10 | 47.02 | 48.21 | -1.19 | PASS | PASS |
| tyrant | 6 | 149 | 187 | 0 | 336 | 44.35 | 39.13–49.69 | 0.00 | 44.35 | 6.68 | 10 | 48.81 | 39.88 | 8.93 | FAIL | PASS |
| tyrant | 5 | 158 | 178 | 0 | 336 | 47.02 | 41.75–52.36 | 0.00 | 47.02 | 6.00 | 10 | 50.60 | 43.45 | 7.14 | PASS | PASS |
| tyrant | 4 | 151 | 185 | 0 | 336 | 44.94 | 39.71–50.29 | 0.00 | 44.94 | 8.26 | 14 | 47.02 | 42.86 | 4.17 | FAIL | PASS |
| tyrant | 3 | 152 | 179 | 5 | 336 | 45.24 | 40.00–50.58 | 1.49 | 45.98 | 9.60 | 17 | 46.43 | 44.05 | 2.38 | PASS | PASS |
| tyrant | 2 | 118 | 215 | 3 | 336 | 35.12 | 30.21–40.37 | 0.89 | 35.57 | 10.84 | 18 | 35.12 | 35.12 | 0.00 | FAIL | PASS |
| tyrant | 1 | 160 | 175 | 1 | 336 | 47.62 | 42.34–52.96 | 0.30 | 47.77 | 13.04 | 21 | 43.45 | 51.79 | -8.33 | PASS | PASS |
| tyrant | 0 | 165 | 171 | 0 | 336 | 49.11 | 43.80–54.43 | 0.00 | 49.11 | 10.54 | 17 | 48.21 | 50.00 | -1.79 | PASS | PASS |
| white_tower | 9 | 205 | 130 | 1 | 336 | 61.01 | 55.70–66.07 | 0.30 | 61.16 | 4.89 | 6 | 59.52 | 62.50 | -2.98 | FAIL | PASS |
| white_tower | 8 | 216 | 120 | 0 | 336 | 64.29 | 59.03–69.22 | 0.00 | 64.29 | 4.40 | 6 | 63.69 | 64.88 | -1.19 | FAIL | PASS |
| white_tower | 7 | 173 | 162 | 1 | 336 | 51.49 | 46.16–56.78 | 0.30 | 51.64 | 4.84 | 7 | 54.17 | 48.81 | 5.36 | PASS | PASS |
| white_tower | 6 | 181 | 155 | 0 | 336 | 53.87 | 48.53–59.13 | 0.00 | 53.87 | 5.64 | 8 | 56.55 | 51.19 | 5.36 | PASS | PASS |
| white_tower | 5 | 179 | 157 | 0 | 336 | 53.27 | 47.93–58.54 | 0.00 | 53.27 | 6.57 | 11 | 55.95 | 50.60 | 5.36 | PASS | PASS |
| white_tower | 4 | 175 | 160 | 1 | 336 | 52.08 | 46.75–57.37 | 0.30 | 52.23 | 8.80 | 15 | 49.40 | 54.76 | -5.36 | PASS | PASS |
| white_tower | 3 | 178 | 157 | 1 | 336 | 52.98 | 47.64–58.25 | 0.30 | 53.13 | 8.00 | 13 | 48.81 | 57.14 | -8.33 | PASS | PASS |
| white_tower | 2 | 163 | 173 | 0 | 336 | 48.51 | 43.22–53.84 | 0.00 | 48.51 | 11.25 | 20 | 47.62 | 49.40 | -1.79 | PASS | PASS |
| white_tower | 1 | 162 | 167 | 7 | 336 | 48.21 | 42.92–53.55 | 2.08 | 49.26 | 15.75 | 38 | 47.62 | 48.81 | -1.19 | PASS | PASS |
| white_tower | 0 | 197 | 139 | 0 | 336 | 58.63 | 53.30–63.77 | 0.00 | 58.63 | 9.07 | 17 | 59.52 | 57.74 | 1.79 | FAIL | PASS |
| hanged_man | 9 | 163 | 173 | 0 | 336 | 48.51 | 43.22–53.84 | 0.00 | 48.51 | 6.13 | 8 | 49.40 | 47.62 | 1.79 | PASS | PASS |
| hanged_man | 8 | 169 | 167 | 0 | 336 | 50.30 | 44.98–55.61 | 0.00 | 50.30 | 6.04 | 8 | 50.00 | 50.60 | -0.60 | PASS | PASS |
| hanged_man | 7 | 176 | 160 | 0 | 336 | 52.38 | 47.04–57.66 | 0.00 | 52.38 | 7.99 | 12 | 57.14 | 47.62 | 9.52 | PASS | PASS |
| hanged_man | 6 | 147 | 189 | 0 | 336 | 43.75 | 38.55–49.10 | 0.00 | 43.75 | 9.49 | 16 | 48.21 | 39.29 | 8.93 | FAIL | PASS |
| hanged_man | 5 | 155 | 181 | 0 | 336 | 46.13 | 40.87–51.47 | 0.00 | 46.13 | 7.90 | 13 | 45.24 | 47.02 | -1.79 | PASS | PASS |
| hanged_man | 4 | 190 | 146 | 0 | 336 | 56.55 | 51.20–61.74 | 0.00 | 56.55 | 11.76 | 22 | 53.57 | 59.52 | -5.95 | FAIL | PASS |
| hanged_man | 3 | 217 | 106 | 13 | 336 | 64.58 | 59.33–69.51 | 3.87 | 66.52 | 17.70 | 40 | 61.90 | 67.26 | -5.36 | FAIL | PASS |
| hanged_man | 2 | 227 | 103 | 6 | 336 | 67.56 | 62.38–72.34 | 1.79 | 68.45 | 17.36 | 38 | 69.05 | 66.07 | 2.98 | FAIL | PASS |
| hanged_man | 1 | 198 | 104 | 34 | 336 | 58.93 | 53.60–64.06 | 10.12 | 63.99 | 24.38 | 50 | 58.33 | 59.52 | -1.19 | FAIL | PASS |
| hanged_man | 0 | 190 | 144 | 2 | 336 | 56.55 | 51.20–61.74 | 0.60 | 56.85 | 15.90 | 32 | 56.55 | 56.55 | 0.00 | FAIL | PASS |
| darkness | 9 | 174 | 162 | 0 | 336 | 51.79 | 46.45–57.08 | 0.00 | 51.79 | 5.75 | 8 | 47.02 | 56.55 | -9.52 | PASS | PASS |
| darkness | 8 | 183 | 153 | 0 | 336 | 54.46 | 49.12–59.71 | 0.00 | 54.46 | 6.18 | 9 | 52.98 | 55.95 | -2.98 | PASS | PASS |
| darkness | 7 | 163 | 173 | 0 | 336 | 48.51 | 43.22–53.84 | 0.00 | 48.51 | 7.39 | 11 | 48.81 | 48.21 | 0.60 | PASS | PASS |
| darkness | 6 | 153 | 183 | 0 | 336 | 45.54 | 40.29–50.88 | 0.00 | 45.54 | 8.84 | 14 | 44.05 | 47.02 | -2.98 | PASS | PASS |
| darkness | 5 | 189 | 147 | 0 | 336 | 56.25 | 50.90–61.45 | 0.00 | 56.25 | 10.71 | 17 | 55.95 | 56.55 | -0.60 | FAIL | PASS |
| darkness | 4 | 175 | 161 | 0 | 336 | 52.08 | 46.75–57.37 | 0.00 | 52.08 | 10.84 | 19 | 51.19 | 52.98 | -1.79 | PASS | PASS |
| darkness | 3 | 171 | 165 | 0 | 336 | 50.89 | 45.57–56.20 | 0.00 | 50.89 | 13.35 | 23 | 55.36 | 46.43 | 8.93 | PASS | PASS |
| darkness | 2 | 163 | 173 | 0 | 336 | 48.51 | 43.22–53.84 | 0.00 | 48.51 | 12.88 | 22 | 44.64 | 52.38 | -7.74 | PASS | PASS |
| darkness | 1 | 139 | 196 | 1 | 336 | 41.37 | 36.23–46.70 | 0.30 | 41.52 | 12.77 | 21 | 40.48 | 42.26 | -1.79 | FAIL | PASS |
| darkness | 0 | 174 | 162 | 0 | 336 | 51.79 | 46.45–57.08 | 0.00 | 51.79 | 12.39 | 21 | 50.60 | 52.98 | -2.38 | PASS | PASS |
| death | 9 | 148 | 187 | 1 | 336 | 44.05 | 38.84–49.39 | 0.30 | 44.20 | 6.24 | 8 | 49.40 | 38.69 | 10.71 | FAIL | PASS |
| death | 8 | 176 | 160 | 0 | 336 | 52.38 | 47.04–57.66 | 0.00 | 52.38 | 5.11 | 7 | 53.57 | 51.19 | 2.38 | PASS | PASS |
| death | 7 | 244 | 92 | 0 | 336 | 72.62 | 67.62–77.11 | 0.00 | 72.62 | 6.54 | 10 | 75.00 | 70.24 | 4.76 | FAIL | PASS |
| death | 6 | 241 | 95 | 0 | 336 | 71.73 | 66.69–76.27 | 0.00 | 71.73 | 6.21 | 10 | 72.62 | 70.83 | 1.79 | FAIL | PASS |
| death | 5 | 182 | 154 | 0 | 336 | 54.17 | 48.82–59.42 | 0.00 | 54.17 | 5.23 | 8 | 54.17 | 54.17 | 0.00 | PASS | PASS |
| death | 4 | 141 | 195 | 0 | 336 | 41.96 | 36.81–47.30 | 0.00 | 41.96 | 8.16 | 15 | 44.64 | 39.29 | 5.36 | FAIL | PASS |
| death | 3 | 156 | 179 | 1 | 336 | 46.43 | 41.17–51.77 | 0.30 | 46.58 | 9.60 | 18 | 48.81 | 44.05 | 4.76 | PASS | PASS |
| death | 2 | 168 | 168 | 0 | 336 | 50.00 | 44.68–55.32 | 0.00 | 50.00 | 9.82 | 19 | 48.81 | 51.19 | -2.38 | PASS | PASS |
| death | 1 | 185 | 151 | 0 | 336 | 55.06 | 49.71–60.29 | 0.00 | 55.06 | 10.91 | 19 | 55.36 | 54.76 | 0.60 | FAIL | PASS |
| death | 0 | 163 | 173 | 0 | 336 | 48.51 | 43.22–53.84 | 0.00 | 48.51 | 9.23 | 16 | 47.02 | 50.00 | -2.98 | PASS | PASS |
| twilight_giant | 9 | 149 | 186 | 1 | 336 | 44.35 | 39.13–49.69 | 0.30 | 44.49 | 5.45 | 7 | 45.83 | 42.86 | 2.98 | FAIL | PASS |
| twilight_giant | 8 | 160 | 176 | 0 | 336 | 47.62 | 42.34–52.96 | 0.00 | 47.62 | 5.10 | 7 | 46.43 | 48.81 | -2.38 | PASS | PASS |
| twilight_giant | 7 | 177 | 159 | 0 | 336 | 52.68 | 47.34–57.96 | 0.00 | 52.68 | 6.52 | 10 | 54.76 | 50.60 | 4.17 | PASS | PASS |
| twilight_giant | 6 | 155 | 181 | 0 | 336 | 46.13 | 40.87–51.47 | 0.00 | 46.13 | 6.83 | 11 | 44.05 | 48.21 | -4.17 | PASS | PASS |
| twilight_giant | 5 | 157 | 179 | 0 | 336 | 46.73 | 41.46–52.07 | 0.00 | 46.73 | 8.34 | 15 | 43.45 | 50.00 | -6.55 | PASS | PASS |
| twilight_giant | 4 | 161 | 175 | 0 | 336 | 47.92 | 42.63–53.25 | 0.00 | 47.92 | 13.01 | 25 | 50.00 | 45.83 | 4.17 | PASS | PASS |
| twilight_giant | 3 | 161 | 160 | 15 | 336 | 47.92 | 42.63–53.25 | 4.46 | 50.15 | 18.47 | 47 | 50.00 | 45.83 | 4.17 | PASS | PASS |
| twilight_giant | 2 | 152 | 180 | 4 | 336 | 45.24 | 40.00–50.58 | 1.19 | 45.83 | 15.84 | 35 | 43.45 | 47.02 | -3.57 | PASS | PASS |
| twilight_giant | 1 | 166 | 169 | 1 | 336 | 49.40 | 44.10–54.73 | 0.30 | 49.55 | 15.05 | 32 | 46.43 | 52.38 | -5.95 | PASS | PASS |
| twilight_giant | 0 | 154 | 181 | 1 | 336 | 45.83 | 40.58–51.18 | 0.30 | 45.98 | 12.58 | 23 | 48.21 | 43.45 | 4.76 | PASS | PASS |
| red_priest | 9 | 166 | 167 | 3 | 336 | 49.40 | 44.10–54.73 | 0.89 | 49.85 | 5.29 | 7 | 50.60 | 48.21 | 2.38 | PASS | PASS |
| red_priest | 8 | 157 | 179 | 0 | 336 | 46.73 | 41.46–52.07 | 0.00 | 46.73 | 6.33 | 9 | 46.43 | 47.02 | -0.60 | PASS | PASS |
| red_priest | 7 | 172 | 163 | 1 | 336 | 51.19 | 45.86–56.49 | 0.30 | 51.34 | 6.31 | 10 | 51.19 | 51.19 | 0.00 | PASS | PASS |
| red_priest | 6 | 150 | 186 | 0 | 336 | 44.64 | 39.42–49.99 | 0.00 | 44.64 | 4.85 | 7 | 45.24 | 44.05 | 1.19 | FAIL | PASS |
| red_priest | 5 | 152 | 184 | 0 | 336 | 45.24 | 40.00–50.58 | 0.00 | 45.24 | 5.54 | 8 | 50.00 | 40.48 | 9.52 | PASS | PASS |
| red_priest | 4 | 152 | 183 | 1 | 336 | 45.24 | 40.00–50.58 | 0.30 | 45.39 | 6.01 | 9 | 45.24 | 45.24 | 0.00 | PASS | PASS |
| red_priest | 3 | 183 | 153 | 0 | 336 | 54.46 | 49.12–59.71 | 0.00 | 54.46 | 7.31 | 12 | 53.57 | 55.36 | -1.79 | PASS | PASS |
| red_priest | 2 | 142 | 191 | 3 | 336 | 42.26 | 37.10–47.60 | 0.89 | 42.71 | 7.70 | 13 | 42.86 | 41.67 | 1.19 | FAIL | PASS |
| red_priest | 1 | 147 | 189 | 0 | 336 | 43.75 | 38.55–49.10 | 0.00 | 43.75 | 7.67 | 13 | 42.26 | 45.24 | -2.98 | FAIL | PASS |
| red_priest | 0 | 151 | 184 | 1 | 336 | 44.94 | 39.71–50.29 | 0.30 | 45.09 | 6.88 | 11 | 47.02 | 42.86 | 4.17 | FAIL | PASS |
| demoness | 9 | 178 | 158 | 0 | 336 | 52.98 | 47.64–58.25 | 0.00 | 52.98 | 5.52 | 7 | 52.38 | 53.57 | -1.19 | PASS | PASS |
| demoness | 8 | 139 | 197 | 0 | 336 | 41.37 | 36.23–46.70 | 0.00 | 41.37 | 5.46 | 8 | 41.67 | 41.07 | 0.60 | FAIL | PASS |
| demoness | 7 | 186 | 149 | 1 | 336 | 55.36 | 50.01–60.58 | 0.30 | 55.51 | 4.96 | 7 | 58.33 | 52.38 | 5.95 | FAIL | PASS |
| demoness | 6 | 164 | 172 | 0 | 336 | 48.81 | 43.51–54.14 | 0.00 | 48.81 | 4.69 | 7 | 46.43 | 51.19 | -4.76 | PASS | PASS |
| demoness | 5 | 155 | 181 | 0 | 336 | 46.13 | 40.87–51.47 | 0.00 | 46.13 | 5.13 | 8 | 47.02 | 45.24 | 1.79 | PASS | PASS |
| demoness | 4 | 187 | 149 | 0 | 336 | 55.65 | 50.31–60.87 | 0.00 | 55.65 | 6.52 | 11 | 57.14 | 54.17 | 2.98 | FAIL | PASS |
| demoness | 3 | 175 | 161 | 0 | 336 | 52.08 | 46.75–57.37 | 0.00 | 52.08 | 6.92 | 13 | 51.19 | 52.98 | -1.79 | PASS | PASS |
| demoness | 2 | 163 | 173 | 0 | 336 | 48.51 | 43.22–53.84 | 0.00 | 48.51 | 6.32 | 12 | 47.62 | 49.40 | -1.79 | PASS | PASS |
| demoness | 1 | 161 | 174 | 1 | 336 | 47.92 | 42.63–53.25 | 0.30 | 48.07 | 6.77 | 11 | 43.45 | 52.38 | -8.93 | PASS | PASS |
| demoness | 0 | 183 | 153 | 0 | 336 | 54.46 | 49.12–59.71 | 0.00 | 54.46 | 7.09 | 12 | 52.98 | 55.95 | -2.98 | PASS | PASS |
| hermit | 9 | 175 | 161 | 0 | 336 | 52.08 | 46.75–57.37 | 0.00 | 52.08 | 5.23 | 7 | 54.17 | 50.00 | 4.17 | PASS | PASS |
| hermit | 8 | 168 | 168 | 0 | 336 | 50.00 | 44.68–55.32 | 0.00 | 50.00 | 4.78 | 7 | 50.60 | 49.40 | 1.19 | PASS | PASS |
| hermit | 7 | 159 | 176 | 1 | 336 | 47.32 | 42.04–52.66 | 0.30 | 47.47 | 5.85 | 8 | 46.43 | 48.21 | -1.79 | PASS | PASS |
| hermit | 6 | 165 | 171 | 0 | 336 | 49.11 | 43.80–54.43 | 0.00 | 49.11 | 5.83 | 9 | 45.24 | 52.98 | -7.74 | PASS | PASS |
| hermit | 5 | 137 | 199 | 0 | 336 | 40.77 | 35.65–46.10 | 0.00 | 40.77 | 6.44 | 10 | 43.45 | 38.10 | 5.36 | FAIL | PASS |
| hermit | 4 | 150 | 186 | 0 | 336 | 44.64 | 39.42–49.99 | 0.00 | 44.64 | 7.18 | 12 | 44.05 | 45.24 | -1.19 | FAIL | PASS |
| hermit | 3 | 171 | 165 | 0 | 336 | 50.89 | 45.57–56.20 | 0.00 | 50.89 | 8.37 | 15 | 51.19 | 50.60 | 0.60 | PASS | PASS |
| hermit | 2 | 173 | 155 | 8 | 336 | 51.49 | 46.16–56.78 | 2.38 | 52.68 | 8.58 | 15 | 54.17 | 48.81 | 5.36 | PASS | PASS |
| hermit | 1 | 196 | 136 | 4 | 336 | 58.33 | 53.00–63.48 | 1.19 | 58.93 | 9.11 | 15 | 53.57 | 63.10 | -9.52 | FAIL | PASS |
| hermit | 0 | 164 | 172 | 0 | 336 | 48.81 | 43.51–54.14 | 0.00 | 48.81 | 7.76 | 13 | 45.83 | 51.79 | -5.95 | PASS | PASS |
| paragon | 9 | 157 | 179 | 0 | 336 | 46.73 | 41.46–52.07 | 0.00 | 46.73 | 5.17 | 7 | 45.24 | 48.21 | -2.98 | PASS | PASS |
| paragon | 8 | 152 | 184 | 0 | 336 | 45.24 | 40.00–50.58 | 0.00 | 45.24 | 4.76 | 7 | 39.29 | 51.19 | -11.90 | PASS | PASS |
| paragon | 7 | 150 | 185 | 1 | 336 | 44.64 | 39.42–49.99 | 0.30 | 44.79 | 5.95 | 9 | 48.21 | 41.07 | 7.14 | FAIL | PASS |
| paragon | 6 | 170 | 166 | 0 | 336 | 50.60 | 45.27–55.90 | 0.00 | 50.60 | 6.34 | 10 | 52.98 | 48.21 | 4.76 | PASS | PASS |
| paragon | 5 | 227 | 109 | 0 | 336 | 67.56 | 62.38–72.34 | 0.00 | 67.56 | 7.71 | 11 | 69.05 | 66.07 | 2.98 | FAIL | PASS |
| paragon | 4 | 193 | 143 | 0 | 336 | 57.44 | 52.10–62.61 | 0.00 | 57.44 | 10.40 | 18 | 58.93 | 55.95 | 2.98 | FAIL | PASS |
| paragon | 3 | 190 | 143 | 3 | 336 | 56.55 | 51.20–61.74 | 0.89 | 56.99 | 8.51 | 16 | 61.31 | 51.79 | 9.52 | FAIL | PASS |
| paragon | 2 | 163 | 173 | 0 | 336 | 48.51 | 43.22–53.84 | 0.00 | 48.51 | 12.54 | 24 | 47.02 | 50.00 | -2.98 | PASS | PASS |
| paragon | 1 | 140 | 196 | 0 | 336 | 41.67 | 36.52–47.00 | 0.00 | 41.67 | 11.40 | 21 | 40.48 | 42.86 | -2.38 | FAIL | PASS |
| paragon | 0 | 149 | 187 | 0 | 336 | 44.35 | 39.13–49.69 | 0.00 | 44.35 | 8.85 | 15 | 46.43 | 42.26 | 4.17 | FAIL | PASS |
| wheel_of_fortune | 9 | 165 | 168 | 3 | 336 | 49.11 | 43.80–54.43 | 0.89 | 49.55 | 5.54 | 8 | 50.00 | 48.21 | 1.79 | PASS | PASS |
| wheel_of_fortune | 8 | 187 | 149 | 0 | 336 | 55.65 | 50.31–60.87 | 0.00 | 55.65 | 6.53 | 9 | 54.76 | 56.55 | -1.79 | FAIL | PASS |
| wheel_of_fortune | 7 | 167 | 169 | 0 | 336 | 49.70 | 44.39–55.02 | 0.00 | 49.70 | 9.41 | 15 | 47.02 | 52.38 | -5.36 | PASS | PASS |
| wheel_of_fortune | 6 | 175 | 161 | 0 | 336 | 52.08 | 46.75–57.37 | 0.00 | 52.08 | 7.58 | 11 | 53.57 | 50.60 | 2.98 | PASS | PASS |
| wheel_of_fortune | 5 | 174 | 162 | 0 | 336 | 51.79 | 46.45–57.08 | 0.00 | 51.79 | 7.97 | 12 | 52.98 | 50.60 | 2.38 | PASS | PASS |
| wheel_of_fortune | 4 | 181 | 155 | 0 | 336 | 53.87 | 48.53–59.13 | 0.00 | 53.87 | 12.16 | 22 | 54.76 | 52.98 | 1.79 | PASS | PASS |
| wheel_of_fortune | 3 | 170 | 166 | 0 | 336 | 50.60 | 45.27–55.90 | 0.00 | 50.60 | 15.32 | 31 | 51.79 | 49.40 | 2.38 | PASS | PASS |
| wheel_of_fortune | 2 | 159 | 163 | 14 | 336 | 47.32 | 42.04–52.66 | 4.17 | 49.40 | 23.14 | 48 | 50.00 | 44.64 | 5.36 | PASS | PASS |
| wheel_of_fortune | 1 | 152 | 184 | 0 | 336 | 45.24 | 40.00–50.58 | 0.00 | 45.24 | 16.45 | 32 | 44.64 | 45.83 | -1.19 | PASS | PASS |
| wheel_of_fortune | 0 | 168 | 168 | 0 | 336 | 50.00 | 44.68–55.32 | 0.00 | 50.00 | 12.31 | 24 | 50.60 | 49.40 | 1.19 | PASS | PASS |
| mother | 9 | 151 | 185 | 0 | 336 | 44.94 | 39.71–50.29 | 0.00 | 44.94 | 6.25 | 8 | 36.90 | 52.98 | -16.07 | FAIL | PASS |
| mother | 8 | 172 | 164 | 0 | 336 | 51.19 | 45.86–56.49 | 0.00 | 51.19 | 6.02 | 9 | 51.19 | 51.19 | 0.00 | PASS | PASS |
| mother | 7 | 145 | 191 | 0 | 336 | 43.15 | 37.97–48.50 | 0.00 | 43.15 | 7.56 | 12 | 45.83 | 40.48 | 5.36 | FAIL | PASS |
| mother | 6 | 155 | 181 | 0 | 336 | 46.13 | 40.87–51.47 | 0.00 | 46.13 | 7.49 | 12 | 50.00 | 42.26 | 7.74 | PASS | PASS |
| mother | 5 | 156 | 180 | 0 | 336 | 46.43 | 41.17–51.77 | 0.00 | 46.43 | 9.69 | 17 | 43.45 | 49.40 | -5.95 | PASS | PASS |
| mother | 4 | 177 | 159 | 0 | 336 | 52.68 | 47.34–57.96 | 0.00 | 52.68 | 15.25 | 30 | 50.60 | 54.76 | -4.17 | PASS | PASS |
| mother | 3 | 147 | 164 | 25 | 336 | 43.75 | 38.55–49.10 | 7.44 | 47.47 | 19.52 | 50 | 43.45 | 44.05 | -0.60 | FAIL | PASS |
| mother | 2 | 182 | 143 | 11 | 336 | 54.17 | 48.82–59.42 | 3.27 | 55.80 | 20.18 | 44 | 52.98 | 55.36 | -2.38 | PASS | PASS |
| mother | 1 | 188 | 132 | 16 | 336 | 55.95 | 50.61–61.16 | 4.76 | 58.33 | 22.15 | 49 | 54.76 | 57.14 | -2.38 | FAIL | PASS |
| mother | 0 | 167 | 167 | 2 | 336 | 49.70 | 44.39–55.02 | 0.60 | 50.00 | 15.32 | 27 | 50.00 | 49.40 | 0.60 | PASS | PASS |
| moon | 9 | 165 | 171 | 0 | 336 | 49.11 | 43.80–54.43 | 0.00 | 49.11 | 6.28 | 9 | 47.62 | 50.60 | -2.98 | PASS | PASS |
| moon | 8 | 136 | 200 | 0 | 336 | 40.48 | 35.36–45.80 | 0.00 | 40.48 | 3.47 | 5 | 39.88 | 41.07 | -1.19 | FAIL | PASS |
| moon | 7 | 178 | 157 | 1 | 336 | 52.98 | 47.64–58.25 | 0.30 | 53.13 | 4.18 | 7 | 58.33 | 47.62 | 10.71 | PASS | PASS |
| moon | 6 | 203 | 133 | 0 | 336 | 60.42 | 55.10–65.50 | 0.00 | 60.42 | 5.53 | 9 | 63.10 | 57.74 | 5.36 | FAIL | PASS |
| moon | 5 | 160 | 175 | 1 | 336 | 47.62 | 42.34–52.96 | 0.30 | 47.77 | 5.95 | 10 | 47.62 | 47.62 | 0.00 | PASS | PASS |
| moon | 4 | 188 | 148 | 0 | 336 | 55.95 | 50.61–61.16 | 0.00 | 55.95 | 8.49 | 16 | 58.33 | 53.57 | 4.76 | FAIL | PASS |
| moon | 3 | 141 | 195 | 0 | 336 | 41.96 | 36.81–47.30 | 0.00 | 41.96 | 9.99 | 23 | 38.10 | 45.83 | -7.74 | FAIL | PASS |
| moon | 2 | 215 | 120 | 1 | 336 | 63.99 | 58.72–68.94 | 0.30 | 64.14 | 13.10 | 29 | 62.50 | 65.48 | -2.98 | FAIL | PASS |
| moon | 1 | 208 | 121 | 7 | 336 | 61.90 | 56.61–66.94 | 2.08 | 62.95 | 14.84 | 34 | 58.93 | 64.88 | -5.95 | FAIL | PASS |
| moon | 0 | 129 | 207 | 0 | 336 | 38.39 | 33.35–43.70 | 0.00 | 38.39 | 11.51 | 24 | 37.50 | 39.29 | -1.79 | FAIL | PASS |
| abyss | 9 | 186 | 150 | 0 | 336 | 55.36 | 50.01–60.58 | 0.00 | 55.36 | 4.65 | 6 | 54.17 | 56.55 | -2.38 | FAIL | PASS |
| abyss | 8 | 172 | 164 | 0 | 336 | 51.19 | 45.86–56.49 | 0.00 | 51.19 | 5.17 | 7 | 52.98 | 49.40 | 3.57 | PASS | PASS |
| abyss | 7 | 170 | 165 | 1 | 336 | 50.60 | 45.27–55.90 | 0.30 | 50.74 | 5.72 | 9 | 54.17 | 47.02 | 7.14 | PASS | PASS |
| abyss | 6 | 152 | 184 | 0 | 336 | 45.24 | 40.00–50.58 | 0.00 | 45.24 | 6.09 | 10 | 42.86 | 47.62 | -4.76 | PASS | PASS |
| abyss | 5 | 182 | 154 | 0 | 336 | 54.17 | 48.82–59.42 | 0.00 | 54.17 | 8.65 | 14 | 51.79 | 56.55 | -4.76 | PASS | PASS |
| abyss | 4 | 129 | 207 | 0 | 336 | 38.39 | 33.35–43.70 | 0.00 | 38.39 | 9.70 | 17 | 36.31 | 40.48 | -4.17 | FAIL | PASS |
| abyss | 3 | 168 | 168 | 0 | 336 | 50.00 | 44.68–55.32 | 0.00 | 50.00 | 13.94 | 32 | 48.81 | 51.19 | -2.38 | PASS | PASS |
| abyss | 2 | 152 | 181 | 3 | 336 | 45.24 | 40.00–50.58 | 0.89 | 45.68 | 13.74 | 27 | 47.62 | 42.86 | 4.76 | PASS | PASS |
| abyss | 1 | 138 | 197 | 1 | 336 | 41.07 | 35.94–46.40 | 0.30 | 41.22 | 13.88 | 26 | 42.86 | 39.29 | 3.57 | FAIL | PASS |
| abyss | 0 | 160 | 176 | 0 | 336 | 47.62 | 42.34–52.96 | 0.00 | 47.62 | 11.13 | 19 | 42.86 | 52.38 | -9.52 | PASS | PASS |
| chained | 9 | 160 | 176 | 0 | 336 | 47.62 | 42.34–52.96 | 0.00 | 47.62 | 6.35 | 8 | 48.81 | 46.43 | 2.38 | PASS | PASS |
| chained | 8 | 151 | 185 | 0 | 336 | 44.94 | 39.71–50.29 | 0.00 | 44.94 | 4.80 | 8 | 41.67 | 48.21 | -6.55 | FAIL | PASS |
| chained | 7 | 160 | 176 | 0 | 336 | 47.62 | 42.34–52.96 | 0.00 | 47.62 | 5.38 | 9 | 44.64 | 50.60 | -5.95 | PASS | PASS |
| chained | 6 | 160 | 176 | 0 | 336 | 47.62 | 42.34–52.96 | 0.00 | 47.62 | 5.76 | 9 | 50.00 | 45.24 | 4.76 | PASS | PASS |
| chained | 5 | 176 | 160 | 0 | 336 | 52.38 | 47.04–57.66 | 0.00 | 52.38 | 6.68 | 11 | 58.93 | 45.83 | 13.10 | PASS | PASS |
| chained | 4 | 158 | 177 | 1 | 336 | 47.02 | 41.75–52.36 | 0.30 | 47.17 | 6.17 | 12 | 44.64 | 49.40 | -4.76 | PASS | PASS |
| chained | 3 | 173 | 161 | 2 | 336 | 51.49 | 46.16–56.78 | 0.60 | 51.79 | 9.56 | 22 | 47.02 | 55.95 | -8.93 | PASS | PASS |
| chained | 2 | 156 | 180 | 0 | 336 | 46.43 | 41.17–51.77 | 0.00 | 46.43 | 10.54 | 23 | 47.02 | 45.83 | 1.19 | PASS | PASS |
| chained | 1 | 166 | 170 | 0 | 336 | 49.40 | 44.10–54.73 | 0.00 | 49.40 | 11.34 | 21 | 44.64 | 54.17 | -9.52 | PASS | PASS |
| chained | 0 | 185 | 150 | 1 | 336 | 55.06 | 49.71–60.29 | 0.30 | 55.21 | 7.28 | 16 | 57.14 | 52.98 | 4.17 | FAIL | PASS |
| black_emperor | 9 | 184 | 152 | 0 | 336 | 54.76 | 49.42–60.00 | 0.00 | 54.76 | 5.90 | 8 | 52.98 | 56.55 | -3.57 | PASS | PASS |
| black_emperor | 8 | 195 | 141 | 0 | 336 | 58.04 | 52.70–63.19 | 0.00 | 58.04 | 7.21 | 10 | 62.50 | 53.57 | 8.93 | FAIL | PASS |
| black_emperor | 7 | 160 | 176 | 0 | 336 | 47.62 | 42.34–52.96 | 0.00 | 47.62 | 8.08 | 12 | 46.43 | 48.81 | -2.38 | PASS | PASS |
| black_emperor | 6 | 141 | 194 | 1 | 336 | 41.96 | 36.81–47.30 | 0.30 | 42.11 | 8.26 | 13 | 41.67 | 42.26 | -0.60 | FAIL | PASS |
| black_emperor | 5 | 159 | 177 | 0 | 336 | 47.32 | 42.04–52.66 | 0.00 | 47.32 | 6.82 | 10 | 50.00 | 44.64 | 5.36 | PASS | PASS |
| black_emperor | 4 | 172 | 164 | 0 | 336 | 51.19 | 45.86–56.49 | 0.00 | 51.19 | 8.73 | 14 | 48.81 | 53.57 | -4.76 | PASS | PASS |
| black_emperor | 3 | 152 | 184 | 0 | 336 | 45.24 | 40.00–50.58 | 0.00 | 45.24 | 10.80 | 18 | 44.05 | 46.43 | -2.38 | PASS | PASS |
| black_emperor | 2 | 164 | 172 | 0 | 336 | 48.81 | 43.51–54.14 | 0.00 | 48.81 | 11.70 | 19 | 50.00 | 47.62 | 2.38 | PASS | PASS |
| black_emperor | 1 | 145 | 191 | 0 | 336 | 43.15 | 37.97–48.50 | 0.00 | 43.15 | 10.94 | 19 | 42.26 | 44.05 | -1.79 | FAIL | PASS |
| black_emperor | 0 | 146 | 190 | 0 | 336 | 43.45 | 38.26–48.80 | 0.00 | 43.45 | 9.40 | 16 | 50.00 | 36.90 | 13.10 | FAIL | PASS |
| justiciar | 9 | 154 | 182 | 0 | 336 | 45.83 | 40.58–51.18 | 0.00 | 45.83 | 6.16 | 8 | 44.05 | 47.62 | -3.57 | PASS | PASS |
| justiciar | 8 | 146 | 190 | 0 | 336 | 43.45 | 38.26–48.80 | 0.00 | 43.45 | 5.92 | 9 | 40.48 | 46.43 | -5.95 | FAIL | PASS |
| justiciar | 7 | 147 | 189 | 0 | 336 | 43.75 | 38.55–49.10 | 0.00 | 43.75 | 7.88 | 13 | 48.81 | 38.69 | 10.12 | FAIL | PASS |
| justiciar | 6 | 138 | 198 | 0 | 336 | 41.07 | 35.94–46.40 | 0.00 | 41.07 | 9.90 | 17 | 44.05 | 38.10 | 5.95 | FAIL | PASS |
| justiciar | 5 | 159 | 176 | 1 | 336 | 47.32 | 42.04–52.66 | 0.30 | 47.47 | 8.33 | 14 | 52.98 | 41.67 | 11.31 | PASS | PASS |
| justiciar | 4 | 151 | 185 | 0 | 336 | 44.94 | 39.71–50.29 | 0.00 | 44.94 | 8.17 | 14 | 45.24 | 44.64 | 0.60 | FAIL | PASS |
| justiciar | 3 | 155 | 181 | 0 | 336 | 46.13 | 40.87–51.47 | 0.00 | 46.13 | 9.31 | 17 | 43.45 | 48.81 | -5.36 | PASS | PASS |
| justiciar | 2 | 151 | 184 | 1 | 336 | 44.94 | 39.71–50.29 | 0.30 | 45.09 | 12.87 | 25 | 45.24 | 44.64 | 0.60 | FAIL | PASS |
| justiciar | 1 | 156 | 180 | 0 | 336 | 46.43 | 41.17–51.77 | 0.00 | 46.43 | 13.00 | 23 | 50.00 | 42.86 | 7.14 | PASS | PASS |
| justiciar | 0 | 158 | 178 | 0 | 336 | 47.02 | 41.75–52.36 | 0.00 | 47.02 | 10.50 | 18 | 47.02 | 47.02 | 0.00 | PASS | PASS |
