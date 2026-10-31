# Starter Pack Inventory

**Status: FOUND.** The organizer starter pack is present at `CrunchWeek_StarterPack/`. This inventory
records every file, its SHA-256 prefix, what it contains, and how the app consumes it. It replaces the
earlier "ABSENT" version.

Source of truth for field meanings and export format: `CrunchWeek_StarterPack/README.md`.

---

## 1. Files (present)

| File | SHA-256 (first 16) | Contents |
|---|---|---|
| `README.md` | `698035324e939c6f` | Time model, every field, export format, disruption format, validator usage |
| `validator.py` | `f02733b382fa111e` | Official validator (stdlib only, Python 3.8+) |
| `data/cit_public.json` | `8351362143097f1a` | Full dataset, 138 KB |
| `data/csv/rooms.csv` | `50cd8b3f2e077840` | Rooms mirror |
| `data/csv/faculty.csv` | `05ea93a0e3f4ed2b` | Faculty mirror |
| `data/csv/student_groups.csv` | `40fbfa8b1c0f0c41` | Groups mirror |
| `data/csv/courses.csv` | `91cdba4ddadc1631` | Courses mirror |
| `data/csv/sessions.csv` | `17d368ac803b6dad` | Sessions mirror (189) |
| `data/csv/exams.csv` | `13e6b44ee384003f` | Exams mirror (41) |
| `data/csv/booking_requests.csv` | `d7aca4eb0969d193` | Spectra requests mirror (25) |
| `data/csv/cancellations.csv` | `fa6f973401078e8b` | Cancellation mirror (1) |
| `data/csv/room_unavailability.csv` | `fa3f8c64878a9b0e` | Room outage mirror (2) |
| `examples/sample_disruption.json` | `57a31a10e5862f37` | Practice disruption (same format as judging) |
| `examples/sample_requests.md` | `271bab688a305a0b` | Plain-language request examples |
| `examples/schedule.example.json` | `4ed22cfa253105e2` | Export shape (not a valid solution) |

A byte-identical copy of `cit_public.json` is served by the app at
`public/data/cit_public.json` (via `BUNDLED_DATASET_URL = "/data/cit_public.json"`). The organizer files
are never modified.

## 2. Verified counts

`src/lib/dataset.ts` reports these on every load; the real file matches all of them:

| Collection | Actual | Expected (README) |
|---|---|---|
| rooms | 27 | 27 |
| faculty | 40 | 40 |
| student_groups | 14 | 14 |
| courses | 62 | 62 |
| sessions | 189 | 189 |
| booking_requests | 25 | 25 |
| exams | 41 | 41 |

Verified output: `ok: true`, 0 errors, 7/7 counts match. One warning is expected and correct:
`booking_requests[18].requested_room = "LHC-5"` does not exist — the README states `requested_room`
is "a wish, may be null, may not even exist".

## 3. How the app consumes each file

| File | Consumed by | Status |
|---|---|---|
| `data/cit_public.json` | `src/lib/dataset.ts` → `parseOfficialDataset`; stored under `cit-scheduler:dataset`; Admin → "Official dataset" panel | **done** |
| `data/csv/*.csv` | Internal CSV import exists (`src/lib/import.ts`) for the **demo** schema; official CSV columns are not yet mapped | partial |
| `validator.py` | Documented in `docs/validator-contract.md`; invoked from the CLI on the generated export (Phase 2) | documented |
| `examples/schedule.example.json` | `docs/export-schema.md` | documented |
| `examples/sample_disruption.json` | `docs/disruption-contract.md` | documented |
| `examples/sample_requests.md` | `docs/booking-examples.md` | documented |

## 4. Validator invocation (from README)

```
python validator.py --data data/cit_public.json --schedule schedule.json
python validator.py --data data/cit_public.json --schedule schedule.json --json report.json
python validator.py --data data/cit_public.json --schedule schedule_after.json \
                    --disruption examples/sample_disruption.json --baseline schedule.json
```

The validator is the scoring authority; if it and the app disagree, the validator wins
(`validator.py` docstring).

## 5. Remaining Phase 1 work

- [x] Inventory the pack (this document).
- [x] Data dictionary from source (`docs/data-dictionary.md`).
- [x] Validator contract from source (`docs/validator-contract.md`).
- [x] Disruption contract from source (`docs/disruption-contract.md`).
- [x] Export schema from source (`docs/export-schema.md`).
- [x] Booking examples from source (`docs/booking-examples.md`).
- [x] Import the official dataset with a clear summary (`src/lib/dataset.ts`, Admin panel).
- [x] Invalid input produces useful errors (verified: duplicate id, unknown reference, missing
      collection, malformed JSON).
- [ ] Map official CSV columns to the app (currently JSON is the import path; CSV is demo-schema only).
- [ ] Wire the official dataset into the scheduler (Phase 2).
