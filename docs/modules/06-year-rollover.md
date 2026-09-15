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

## Gates (truth.md, 2026-09-13)

Opening the next year (POST /api/academic-years) is refused with 409
`year_not_finished` while the open year's `end_date` is still in the future;
the dialog shows the date plainly instead of a generic error. The wizard's
draft plan can be cancelled at any step via POST /rollover/plan/cancel — safe
because nothing writes to classes or students before execute.

## Collapsed to two steps (truth.md, 2026-09-14)

Class plan and Students are one screen now: a table of every pending class,
pre-filled (promote to next grade, same section; the school's own highest
existing grade graduates — never a hardcoded 12), where opening a row shows
that class's roster inline for detain / reshuffle / withdraw. Review & run is
the second and last step. `ClassRosterPanel` carries the per-student UI,
reused from the deleted `StudentsStep`; `PlanStep` replaces `ClassPlanStep`.

## Detain switch, stepper, footer (truth.md, 2026-09-14)

Promote/Detain per student writes PATCH /api/batches/annual-result directly —
a real toggle, not a plan-only guess — and clears any stale section exception
when it flips. Section is an always-visible input per row; Withdraw is a small
link, not a popover option. A sticky footer in RolloverPage carries the step's
advance action — PlanStep and ReviewStep no longer own their own
advance/execute buttons.

## Corrected to three steps (truth.md, 2026-09-14)

The two-step collapse above over-merged: founder's actual ask is "step one
grade promotion, then reshuffling if needed, then last step is summary and
preview and then submit" — three distinct steps, not two. Split back apart:

1. **Grade promotion** (`PlanStep`) — class table only, no roster expansion.
   Every class is pre-filled (promote to next grade, same section); the
   Promote/Graduate choice only appears on a class at the school's own
   derived terminal grade (`max(existing grades, 12)` — never hardcoded).
   Every other grade just states its target, no button pretending there's a
   choice to make.
2. **Reshuffling** (`ReshuffleStep`, new) — a class list on the left, that
   class's roster on the right (`ClassRosterPanel`, unchanged): the real
   Promote/Detain switch, an always-visible section field, Withdraw. Same
   master/detail shape used everywhere else in the product, one level below
   the stepper.
3. **Review & run** (`ReviewStep`, unchanged) — preview stats, warnings, the
   footer's "Run the rollover".

`RolloverStepper` rebuilt to the founder's referenced style: a row of
connected chevron/arrow-shaped segments (not numbered circles), each holding
a bold title plus a lighter supporting line stacked inside — done filled dark
solid, current tinted, upcoming plain.

## Step scopes sharpened (truth.md, 2026-09-14)

- **Grade promotion** (`PlanStep` + new `ClassIdentifyPanel`): a class with
  nobody currently detained is a single Promote/Graduate click, nothing else
  shown. A class with any detained student opens straight to a compact
  Student + Promote/Detain list (`GET /rollover/plan/roster`, `PATCH
  /batches/annual-result` — same real toggle as before, just surfaced here
  too); any class can be opened by hand via the row's expand toggle. The
  target section shown per class is always "same letter, next grade," fixed
  and non-editable here — no `Input`, just text (founder, 2026-09-15: this
  screen kept re-doing reshuffling's own job). Every section change happens
  only in Reshuffling.
- **Reshuffling** (`ClassRosterPanel`): dropped its Promote/Detain switch
  (decided in step 1 now) in favor of a read-only Promoted/Detained badge,
  and gained a "New section" dialog that calls `POST /api/classes` directly
  — the same endpoint Setup > Classes uses — so a section exists as a real
  class immediately, before execute, and can be typed into any section
  field right away.
- **Review** (`ReviewStep`): replaced the three stat tiles with a per-student
  table — class, student, result, exact destination, a "new section" tag
  where one will be created. Backed by a new `students` array on `POST
  /rollover/preview`, computed by `buildItemizedPreview()` in
  rollover.controller.js: a read-only duplicate of `executePlanCore`'s
  resolution logic (never call the real engine for a preview — its
  `ensureTarget()` writes classes as a side effect of resolving an id).
