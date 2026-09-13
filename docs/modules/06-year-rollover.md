# 06 · Year rollover (A15) — Batches renamed and moved

Group: Setup · Handoff: TWEAK · **Founder wants a mock before code.** Today the Batches
page already has Year Rollover and Past Batches tabs, "Start new academic year", class
creation, and student transfer/withdraw/history.

## Scope

Rename **Batches → Year rollover** under Setup. The page keeps: rollover preview and
execute (`/rollover/preview`, `/execute`, `/execute-plan`, `/promotion-draft`), past
years (`/past`, `/past/:classId/students`), per-student history, transfer and withdraw,
annual result flag. Class creation leaves for Classes (03). Opening a year *is* the first
step here: "Start new academic year" creates the `academic_years` row (01), then the
promotion plan, then closes the old year at the end.

## Schema

Uses `academic_years` (01) and `student_class_memberships` (013). Add
`academic_years.closed_at` and `rolled_from_year_id` for lineage. Nothing else.

## API

Existing batches routes stay, mounted additionally at `/api/rollover/*` with the old
paths kept as aliases for one release. `POST /switch-year` becomes a write to
`academic_years.status`. `prepare-class` and `class-template` move to `/api/classes`.

## Screens and pickers

- **Setup › Year rollover**: year header (open year, dates), the promotion plan grid
  (grade → target grade, sections mapped), review, execute; Past years list; student
  history/transfer stays reachable from the Student profile too (one record, two views).
- Mock first: two screens — the plan grid, and the Past years view — for founder sign-off.

## Acceptance

- Rollover never rewrites verticals; every artefact of the closed year stays tagged and
  read-only (edge case 1). Verified by opening a past year in the header picker.
- Transfer within school carries every record; transfer out produces a partial-year
  report card export (edge case 4).
- Archived sections hide from pickers, stay queryable (edge case 6).

## Out of scope

Report card generation itself (A13); allotment re-staffing UI (03 does it against the new year).

## From interview (truth.md, 2026-09-10)

- Default promotion is whole sections (6A → 7A, same students). Exceptions per student:
  hold back, remove, add transfer-in. The copilot proposes hold-backs from results.
- **Reshuffle** step: section → student remapping by uploading a list or typing names,
  reviewed, then applied. Optional; off by default.

## The wizard (founder, 2026-09-13)

Five steps, each a screen and each a tool. The plan lives on the server
(`rollover_plans`, one draft per school per target year) so it survives
navigation and so an assistant can edit the same plan through the same calls.

| Step | Screen | Tool |
|---|---|---|
| 1 Open the year | The dialog: the one next year, closing is final | `POST /academic-years` (exists) |
| 2 Class plan | Every current class → promote to grade+1 / graduate / hold; target section defaults to the same letter | `PUT /rollover/plan/classes` |
| 3 Students | Per student: detain (stays in old grade, pick section), move section, withdraw, add transfer-in; bulk by paste or upload; search within a class | `PUT /rollover/plan/students`, `POST /students/:id/transfer` (exists), `POST /students/:id/withdraw` (exists), `PATCH /annual-result` (exists) |
| 4 Review | Counts (moved, detained, graduated, withdrawn, classes created), warnings (a target section with no teacher, a class over strength), every exception listed | `POST /rollover/preview` (exists; reads the saved plan) |
| 5 Execute | One atomic call; result summary; closed year read-only | `POST /rollover/execute` → `rollover_batch()` (exists) |

Tool design rules: every write has a `preview: true` twin; the plan is idempotent
(PUT the whole set); every response says what changed and why; nothing in the
wizard needs a page outside it. `switch-year` is retired — it moved the school's
active year without the years table and allowed going backwards.

Schema (additive): `rollover_plans (id, school_id, from_year_id, to_year_id, status
draft|executed, plan jsonb, created_by, updated_at)`. The jsonb is the class plan
plus per-student exceptions; the preview and execute read it, never the client.
