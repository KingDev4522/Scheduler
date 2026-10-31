# Validator evidence

Canonical local run on the CIT Scheduler working tree.

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
| `exports/schedule.json` | 0 | 3 (`S4: 3`) | 63.0 / 70 | — |
| `exports/schedule_after.json` | 0 | 3 | 63.0 / 70 | 12 (0 time, 12 room-only) |

Booking decisions: 20 approved, 3 alternatives, 2 rejected, 0 priority inversions.
Exam soft penalty: 0.

## Hashes

| Artifact | SHA-256 |
|---|---|
| `CrunchWeek_StarterPack/data/cit_public.json` | `8351362143097F1A0D80CE91F31BD1F2D77BD7E738F8701D48AD28FDF64BA8DD` |
| `exports/schedule.json` | `B9535DB927CB2A6EE5A1A136D4A3DBBDAE9F511392400299614222BD69DB0CE8` |
| `exports/schedule_after.json` | `972AE79E8C4DE8F149592F2AC1F8CAB3D119213F1EA929EE957535ABDBD91525` |

Repository commit at capture: `a7da02f9448dc655ced7633470b2cc39bf1717d4` (working tree contains the
Phase 4/5 local changes; regenerate after committing if a frozen commit hash is required).

Reports copied here: `baseline.report.json`, `after.report.json`.
Divergent older audit runs were moved to `exports/archive/` and are not canonical.
