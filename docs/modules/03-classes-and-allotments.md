# 03 · Classes & sections (A4) + Allotments board (A8)

Group: Classes · Handoff: A4 DONE, A8 DONE but edited in the wrong places (Teachers drawer,
Batches page). One module because allotment is a property of a section's subject.

## Scope

**Classes & sections** keeps today's page (grades, sections, subject sets, electives,
archive) and gains class creation moved in from Batches (`POST /batches/prepare-class`,
`GET /batches/class-template` → move to `/api/classes`). **Allotments** becomes one
school-wide board: rows = sections × subjects, cell = allotted teacher(s) with tenure;
department-first picker; gaps flagged; a teacher-load column from the timetable once it
exists. Teachers page and Batches page show allotments read-only and link here.

## Schema

No new tables. `teacher_assignments` already has tenure (012) and `is_current`.
Add `teacher_assignments.grade_subject_id` denormalised? **No** — derive via
`class_subjects`. Add index on `(class_subject_id, is_current)` if missing.

## API

- Classes: `GET /api/classes`, `/grouped`, `/grade/:grade/overview`, `POST`, `PUT`,
  `DELETE` (exist). Move `prepare-class` and `class-template` here from batches.
- Class subjects: exist. Ensure `POST` sets `grade_subject_id` (02).
- Allotments: `POST /api/teacher-assignments` and `/unassign` exist. Add
  `GET /api/teacher-assignments/board?year=` returning sections × subjects × teacher with
  gaps, and `GET /api/teacher-assignments/candidates?class_subject_id=` returning the
  tiered list (allotted · department · all) with current load.

## Screens and pickers

- **Classes › Classes & sections**: today's page + "New class" (from Batches). Archive
  is a flag, never a delete (edge case 6).
- **Classes › Allotments**: grid by grade; filters by department, unassigned only;
  cell click opens the tiered picker; swap keeps history (ends old tenure, starts new).
- **Teachers** drawer: allotments read-only with "Change in Allotments →".
- **Home › Needs a look**: staffing gaps come from the board endpoint.

## Acceptance

- No section-subject without a teacher is invisible: the board shows every gap.
- Assigning from the board, the Teachers drawer, or Batches is one code path
  (the drawer and Batches lose their editors).
- Candidate list order: allotted, then owning department, then all; load shown.
- Mid-term swap keeps the old tenure row with `ended_at` (association 2 depends on it).

## Out of scope

Ripple into a published timetable (module 05 handles: slots on the old allotment move
to the new teacher, pending exchanges invalidated).

## From interview (truth.md, 2026-09-10)

- **Class teacher**: `classes.class_teacher_id` (nullable → users). Owns the class; shown
  on the section card and the roster; attendance per period is by the period's teacher.
- **Replace teacher** is a first-class action on the board and on a deactivated teacher's
  profile: pick the section-subjects they held, pick the replacement (tiered), and every
  slot, upcoming duty and pending request moves in one transaction. Old tenure ends.
- Shared allotment (two teachers, one subject-section) allowed; UI neutral.
- Optional `teacher_load_limit` per school or per teacher; board warns past it.
- Combined class: two sections, same teacher, same period is allowed by the clash rule
  when the slots are marked as a combined block (`block_id` already exists on slots).
- Guardian contacts (Students): three slots, two mandatory — `student_guardians
  (student_id, name, relation, phone, email, is_primary, position 1..3)`.
- Roles as a set: `user_roles (user_id, role)` with `admin | teacher | staff`; the
  principal holds admin + teacher. `users.role` kept as the primary for compatibility.

## Bands belong here (truth.md, 2026-09-13)

A school defines its bands at grade / class creation — which grades are primary,
middle, secondary, higher secondary. Everywhere else a band is read back from a
grade selection, never entered. The department page already does this.
