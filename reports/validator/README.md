# Validator evidence

Canonical local run on the CIT Scheduler working tree after the Phase 4/5 fixes.

## Command

```bash
python CrunchWeek_StarterPack/validator.py \
  --data CrunchWeek_StarterPack/data/cit_public.json \
  --schedule exports/schedule.json

python CrunchWeek_StarterPack/validator.py \
  --data CrunchWeek_StarterPack/data/cit_public.json \
  --schedule exports/schedule_after.json \
  --disruption CrunchWeek_StarterPack/examples/sample_disruption.json \
  --baseline exports/schedule.json
```

## Results

| Run | Hard violations | Soft penalty | Booking score | Moved |
|---|---:|---:|---:|---:|
| `exports/schedule.json` | 0 | 3 (`S4: 3`) | 65.5 / 70 | — |
| `exports/schedule_after.json` | 0 | 3 (`S4: 3`) | 65.5 / 70 | 15 (3 time, 12 room-only) |

Booking decisions: 21 approved, 2 alternatives, 2 rejected, 0 priority inversions.
Exam soft penalty: 0.

## Hashes

| Artifact | SHA-256 |
|---|---|
| `CrunchWeek_StarterPack/data/cit_public.json` | `8351362143097F1A0D80CE91F31BD1F2D77BD7E738F8701D48AD28FDF64BA8DD` |
| `exports/schedule.json` | `C99E45FD59ABB83DC1A2180CE641FEA17C1F20EF539D20E996F48B542A2C6C40` |
| `exports/schedule_after.json` | `90F59194713F9BFA7304D6854C3E28D1D4313C64F02F1E238FF28C3A43FC1761` |

Repository commit at capture: `0ca59d1c586826551efe187bdf872983a3e58d06` with the local Phase 4/5
working-tree changes applied. Regenerate after committing if a frozen commit hash is required.

Reports copied here: `baseline.report.json`, `after.report.json`.
Divergent older audit runs remain in `exports/archive/` and are not canonical.
