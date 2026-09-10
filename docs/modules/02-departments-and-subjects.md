# 02 · Departments & subjects (A5)

Group: Setup · Handoff: TWEAK ("Subjects & books") · Renamed by founder decision.
Second in setup order. Lands the two junctions that Knowledge, Papers, Allotments and
Period Exchange all hang off.

## Scope

One page, a hierarchy: **Department** → **subjects it owns** → **grades each subject
runs in**. Departments carry one or more heads (teachers), the **grades they serve**, and derive
their members from `users.department_id`. Departments without subjects (Physical Training,
Library) are valid: they have teachers and grades and can hold timetable slots. A default
**General** department catches any subject without a natural home; every subject belongs
to a department (truth.md). Books do not appear as a top-level word: a subject-in-a-grade
shows a count of attached materials and links to Knowledge › Class knowledge. Handles
the primary-section case: a "Primary" department may own every subject for grades 1–5.

## Schema (additive; migration 024)

- `department_heads (department_id, user_id, PRIMARY KEY (department_id, user_id))` —
  multiple heads per department.
- `department_grades (department_id, grade int, PRIMARY KEY (department_id, grade))` —
  the grades a department serves; the translucent "band".
- Seed one `General` department per school; `subjects` without an owner attach to it.
- `department_subjects (department_id, subject_id, PRIMARY KEY (department_id, subject_id))`.
  A subject may sit in more than one department (Primary owns Maths for 1–5, Mathematics
  owns it for 6–12) — scope by grade via `grade_subjects`, not by uniqueness here.
- `grade_subjects (id, school_id, grade int, subject_id, academic_year_id NULL,
  created_at)`; UNIQUE (school_id, grade, subject_id, academic_year_id). Year nullable so
  curriculum can be school-constant; a year-specific row overrides.
- `class_subjects.grade_subject_id uuid NULL REFERENCES grade_subjects` — backfilled from
  (class.grade, subject_id); trigger or service layer keeps it set on insert.
- RLS: service-role only, as 020.

## API

- `GET /api/schools/departments` (exists) · `POST /api/schools/departments` (exists, no
  UI today) · add `PATCH /api/schools/departments/:id` (name) · `PUT /:id/heads` · `PUT /:id/grades` ·
  `DELETE` refused while members or subjects exist.
- `GET|POST /api/subjects` (exist) · add `PATCH /api/subjects/:id`.
- `PUT /api/departments/:id/subjects` — replace the owned-subject set.
- `GET|PUT /api/grade-subjects?grade=6` — the grades a subject runs in; PUT replaces.
- `GET /api/departments/:id/members` — derived; includes head flag and load once
  Timetable exists.

## Screens and pickers

- **Setup › Departments & subjects**: left list of departments with member count and
  head; right panel: heads (multi-pick; this department's teachers first, then all), grades served (1–12 toggles), owned
  subjects as chips with add, and per subject the grade range as toggles (1–12).
  Material counts per subject-grade link to Class knowledge.
- **Teachers**: department picker reads this list; creation moves here. HoD badge on the
  card and profile.
- **Classes**: when a class is created, its subject set defaults to the grade's
  `grade_subjects`; electives still configured per section.

## Acceptance

- A new school can create departments, name heads, and attach subjects without the
  database. Deleting a department with members is refused with the member count.
- Every existing `class_subjects` row resolves a `grade_subject_id` after backfill.
- Allotment picker (module 03) defaults to the owning department's teachers.
- Heads gain no new role; permission checks read `department_heads`.
- A department with zero subjects (PT) can be created and allotted to sections.

## Out of scope

Department KPI slice (A14). Department-scoped approvals (A10). Material upload (Knowledge).

## From interview (truth.md, 2026-09-10)

- Teacher ↔ department is many-to-many with a primary: `teacher_departments (user_id,
  department_id, is_primary)` replaces reliance on `users.department_id` (keep the column
  as the primary for compatibility; backfill).
- Non-teaching staff belong to departments too (Library, PT, Office). Department members
  include staff.
- Designation becomes a tag: `designation_tags (school_id, label)`; `users.designation`
  keeps the text; picker offers existing tags, creates on new text.
