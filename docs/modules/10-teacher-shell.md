# 10 · Teacher shell (later pass)

Deferred by decision (admin-only build first). Recorded so the admin work is built with
it in mind.

## Shape

Teacher menu ordered by her day, from the handoff T1–T17: My Day / My schedule (T1) on
top; Your classes with the five-step pipeline Knowledge → Exams → Grading → Results →
Portion (T5); Library; My Department + Teachers (T17); Ask Hint everywhere.
Coming-soon rows for T1, T2, T4, T5, T6, T7, T12 the same way as the admin menu.

## What the admin pass must leave in place for it

- Nav definition per role already exists (`src/data/nav.ts`); this pass edits data.
- Department with head (02) → My Department grouping and fill suggestions.
- Stable slot identity and versions (05) → Period log and exchanges.
- `grade_subjects` (02) → Portion tracker per section reads one chapter list.
- Students page scoped by roster (T16 → A6): same page, teacher scope.

## Out of scope for now

Everything above until the admin shell and modules 01–05 are merged.

## From interview (truth.md, 2026-09-10)

- Teacher schedules (layer 3) are the teacher's home surface; borrow and substitute live
  there. Colleagues' schedules can be added to one's view. Upcoming duties (accepted
  fills) show on the dashboard with a countdown.
- Non-teaching staff get the same shell scoped to their department periods and
  attendance.

## From interview batch 3 (truth.md)

- Period log: pre-filled from the plan, one-tap confirm, detail via Hint. Recap card is
  generated from the last log (absent, taught, homework) for the next period.
- KPI visibility: the teacher and department heads only.
