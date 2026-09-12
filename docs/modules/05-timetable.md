# 05 · Timetable (A3)

Group: Classes · Handoff: BUILD, since landed (builder, AI fill, drafts, teacher view).
Today: one 3,655-line file, admin and teacher forked at runtime, config in dialogs.

## Scope

Keep what works (grid builder, readiness strip, drafts, AI generation, validation,
copy-day, teacher load) and restructure: own sub-routes, components by surface, tiered
teacher picker, stable slot identity for logs and exchanges,
allotment ripple. Teacher view stays as it is (My schedule · any class) on
`/timetable/my-schedule`.

## Schema (additive; migration 026)

- `timetable_slots.template_period_id` becomes the read path (from 04); `period_id`
  dropped in a later migration once no reader remains.
- Slot identity: rows are already UUID; add `published_at` on a `timetables (id,
  class_id, academic_year_id, version, published_at)` header so drafts and published
  grids are versioned; slots reference the header. Period logs (T4) and exchanges (T2)
  reference slot id + date.
- Unique clash guards as DB constraints: `(teacher_id, day_of_week, template_period_id,
  timetable_version)` partial on published rows. No room clash: rooms are not modelled (truth.md).

## API

Existing: periods, readiness, teacher-busy, teacher-load, my-schedule, align-elective,
`/:classId` get, slots replace, validate, generate, draft get/save/delete. Add:
`GET /api/timetable/candidates?class_subject_id=&day=&period=` (tiered, excludes busy), `POST /api/timetable/:classId/publish`
(creates a version), `GET /api/timetable/changes?since=` for the calendar-sync diff
(edge case 2).

## Screens and pickers

- `/timetable` — section grid (default), class picker, readiness strip.
- `/timetable/teacher-load` — page, not dialog.
- `/timetable/my-schedule` — teacher default; admins can open it via View as.
- Bell schedule dialog removed → Setup › School day.
- Cell editor: teacher field pre-selected from allotment; tiers as rule 1; busy teachers greyed with where they are.
- Class page (`/class/:id`) gains a read-only timetable tab — the surface T2 borrows from.

## Acceptance

- A slot may hold a department period (PT, Library) with no class-subject: `kind` +
  `department_id` on the slot (truth.md).

- Split: no file over ~600 lines; `modules/timetable/components/*` by surface.
- Picker tiers verified with a section whose allotted teacher is busy at that period.
- Two sections cannot both publish the same teacher at the same period (DB refuses).
- Allotment swap (03) moves that teacher's slots and lists pending exchanges to cancel.
- Publishing a new version emits a diff of moved slots per teacher.

## Out of scope

Calendar sync itself (Settings integration). Period Exchange (T2, teacher pass).

## From interview (truth.md, 2026-09-10)

- **Share, not Publish**, in every label. Draft until shared; sharing writes every
  teacher's schedule (layer 3 below).
- Three calendar layers: school calendar (master) · timetable (office) · **teacher
  schedules** (derived, calendar-shaped, what teachers actually see). `/timetable/
  my-schedule` renders layer 3; the grid is admin-only.
- Schedules are the surface for **borrow** and **substitute** (T2): add a colleague's
  schedule like Google Calendar; request a period from it; request a fill on your own.
  Accepted requests land on both schedules and the dashboard as upcoming duties.
  Design the schedule view now so T2 attaches without rework: each rendered period
  carries its slot id + date.
- Combined classes: one teacher, two sections, one period — allowed via `block_id`.
- Staff periods (Library, PT) are department slots with a staff user as the owner.
- Committee builds, admin enters: no multi-editor requirement in v1; drafts already exist.
