# Admin information architecture — step 1: evaluation

Date: 2026-09-10. Branch: `feat/timetable-ia`. Companion to `paperhint-modules.pdf`
and `paperhint-associations.pdf` (Sept 2026 dev handoff) — same A-/T- numbering.

Scope of this pass: the **admin** experience only. The teacher surfaces stay as they
are until the admin shell is settled; nothing teacher-facing is deleted, just left alone.

## 1. What the admin sees today

Ten flat sidebar items in one list, no grouping:

Home · Ask Hint · Classes · Teachers · Students · Calendar · Timetable · Batches ·
Knowledge Library · Shared Library. Settings and Help sit in the user menu.

Where school configuration actually lives right now:

| Configuration | Lives today | Problem |
|---|---|---|
| School profile, academic year (A1) | Nowhere as a page. Year appears as a tag on Batches; Settings has only profile / appearance / security | No place to set the school up |
| Working days, week start | Calendar page, a form inside the events view | Timetable depends on it but you set it under Calendar |
| Bell schedule (periods of the day) | A dialog behind a header button on Timetable | Hidden; a first-time admin cannot find it |
| Subjects and electives (A5) | Modals inside Classes | Reasonable, but no school-wide subjects view |
| Allotments — who teaches what (A8) | Split between the Teachers page and the Batches page | Same data edited in two places |
| Year rollover (A15) | Batches page (2,172 lines, also holds class creation) | "Batches" is not a word a school uses for this |

Role handling: Home, Timetable and Students fork admin vs teacher inside the page
at runtime. The Timetable page is one 3,655-line file holding the admin builder, the
teacher view, and both configuration dialogs.

Net: everything works, but the map is flat and configuration is scattered across
Calendar, Timetable, Classes, Teachers and Batches. That is the "everything is
everywhere" the founder described.

## 2. Proposed admin groups

Five labelled groups plus the two entry points. Every A-module has exactly one home.

**Top:** Home · Ask Hint (A16)

**Setup** — configure the school once, revisit rarely
- School & academic year (A1) — new page: profile, open/close year
- Calendar (A2) — terms, holidays, events, exam windows, upload
- School day — bell schedule + working days + week start (moved from Timetable dialog and Calendar)
- Subjects & books (A5) — school-wide subject list with attached materials
- Year rollover (A15) — renamed from "Batches"; the migration flow

**People** — staff and students as directories
- Teachers (A7) — directory, departments, onboarding, deactivate
- Students (A6) — admissions, profiles, transfers, directory

**Classes** — the grade/section structure and how it is staffed and scheduled
- Classes & sections (A4)
- Allotments (A8) — one staffing board, taken out of Teachers and Batches
- Timetable (A3) — the grid builder; readiness strip stays; teacher load moves here as a view

**Exams & papers** — the assessment spine, school-level
- Exam manager (A12) — BUILD
- Question papers — school view over T13 (today only reachable per class)
- Grading oversight — school view over T14
- Results & report cards (A13) — BUILD

**Operations** — the running school, day to day
- Attendance oversight (A9) — TWEAK, needs a web surface
- Leave & substitution (A10) — BUILD
- Notifications & circulars (A11) — BUILD, but the rail first
- Reports & KPI (A14) — BUILD

**Knowledge** — A17: Knowledge Library · Shared Library (already DONE; own small group)

Groups that are entirely BUILD (Exams & papers apart from the two school views,
most of Operations) get their labels in the nav only when the first page in them
ships. No empty groups, no "coming soon" rows.

## 3. What a school sees first

Association chain 1 is the setup order and it is fixed by dependencies:

A1 School & year → A2 Calendar → A5 Subjects → A4 Classes & sections → A7 Teachers
→ A6 Students → A8 Allotments → School day → A3 Timetable → publish.

Home already has a "Set up your school" card and a "Needs a look" strip, and the
Timetable page already computes readiness (bell schedule, allotments per section).
Proposal: Home becomes the setup checklist for a new school — the nine steps above
with done/not-done, each linking into its page in the groups. Once the timetable is
published the checklist folds away and Home becomes the operations view (Needs a
look, staffing gaps, missing registers).

So on day one an admin sees: a greeting, the checklist at step 1, and the Setup group
open in the sidebar. Nothing else demands attention.

## 4. Module-by-module status

| # | Module | Tag (handoff) | Today | Proposed home | Work in this pass |
|---|---|---|---|---|---|
| A1 | School & academic year | TWEAK | absent | Setup | New page; promote year tag |
| A2 | School calendar | BUILD* | /calendar, working | Setup | Move week settings out; keep |
| — | School day (bell + week) | part of A3 | Timetable dialog + Calendar form | Setup | New page from existing components |
| A3 | Timetable | BUILD* | /timetable, admin builder working | Classes | Split file; own sub-routes; teacher view left in place |
| A4 | Classes & sections | DONE | /classes | Classes | Move only |
| A5 | Subjects & books | DONE | modals in Classes | Setup | New school-wide list page, reuse modals |
| A6 | Students | DONE | /students | People | Move only |
| A7 | Teachers | DONE | /teachers (+ allotment editing) | People | Move; lift allotment editing out |
| A8 | Allotments | DONE | Teachers page + Batches page | Classes | One staffing board |
| A9 | Attendance oversight | TWEAK | absent on web | Operations | Later |
| A10 | Leave & substitution | BUILD | absent | Operations | Later |
| A11 | Notifications & circulars | BUILD | absent | Operations | Later (rail first) |
| A12 | Exam manager | BUILD | absent | Exams & papers | Later |
| A13 | Report cards | BUILD | absent | Exams & papers | Later |
| A14 | Reports & KPI | BUILD | absent | Operations | Later |
| A15 | Batch migration | TWEAK | /batches | Setup (Year rollover) | Rename; move class creation to Classes |
| A16 | Ask Hint (office) | TWEAK | /ask | Top | Keep |
| A17 | Knowledge & shared libraries | DONE | /library, /library/bank | Knowledge | Keep |

\* The handoff tags A2 and A3 BUILD as of 3 Sept; both have since landed in the
app (calendar, bell schedule, builder, AI fill, drafts). Treat them as TWEAK now.

## 5. Order of work for the restructure

1. Sidebar groups and route skeleton — labelled groups, every existing page reachable
   at its new place, old URLs redirect. One commit, no feature changes.
2. Setup group — School day page (bell schedule + week settings pulled from their
   current homes), School & year page (A1), Subjects & books list, Batches → Year
   rollover.
3. Classes group — split the Timetable file into components; Allotments board from
   the pieces in Teachers and Batches.
4. Home as setup checklist.
5. Exams & papers and Operations arrive as their modules are built.

Step 1 is the Timetable-module starting point the founder asked for: it fixes where
Timetable sits and what surrounds it before touching its internals.

## 6. Decisions needed

1. Timetable under **Classes** (with Allotments, as the handoff note says) rather than
   under Operations. Confirm.
2. "Batches" renamed to **Year rollover** under Setup, with class creation moving to
   Classes. Confirm the name.
3. Knowledge libraries as their own small group, or folded under Classes.
4. Home as the setup checklist for a fresh school (section 3). Confirm.
5. Teacher-facing screens: untouched in this pass (admin-only build). Confirm.

## 7. Setup vs Settings — the rule

Two different things, kept apart on purpose:

- **Setup** is about the *school*. Anything another module reads as data about how
  this school runs: academic year, calendar, school day, subjects, year rollover, and
  importing the school's people. It sits in the sidebar because it is part of running
  the school. Test: "would a different admin at the same school see the same value?"
  If yes, it is Setup.
- **Settings** is about the *application and the account*. How Paperhint behaves for
  this user or this account: my profile, appearance, password and security, roles &
  permissions, notification channels and integrations (calendar sync provider, email
  sender). It stays in the user menu, as today, not in the sidebar groups. Test: "does
  changing this alter any school record?" If no, it is Settings.

Concretely: working days are Setup (the timetable reads them); dark mode is Settings.
Roles & permissions is Settings even though it is admin-only, because it governs the
app, not the school's data.

## 8. Coverage against the handoff document

**Admin modules A1–A17:** all seventeen placed (table in section 4).

**Shared platform (listed under both roles):**

| Item | Placement |
|---|---|
| Notifications engine | The rail under A11 (Operations). Built as infrastructure first; delivery-channel configuration lives in Settings |
| Calendar sync | Teacher-side feature (T1). Provider connection lives in Settings; no admin page |
| Roles & permissions | Settings — admin-only section |
| Data import (CSV of students/teachers) | Setup — as an "Import" action on the setup checklist, writing into People |

**Teacher modules T1–T17 and Phase 2 (P2-1..3):** out of scope for this pass by
decision (admin-only build). They are not lost: T16 Students and T17 Teachers already
map onto A6/A7 as role-scoped views of the same pages (association 10), and T13/T14/T15
gain school-level views under Exams & papers. The teacher shell gets its own pass once
the admin shell is settled.

**Future roles (committee, student, parent):** direction only per the handoff; nothing
placed, nothing built.

## 9. Founder decisions (2026-09-10) and what they imply

**Coming soon rows.** Reverses the "no empty groups" rule in section 2: every module
in the handoff appears in the nav from day one. Unbuilt ones are visibly disabled and
land on a placeholder page that carries the module's one-paragraph description from
the handoff. The nav is the complete picture of the application.

**Timetable: template vs filled timetable — two layers, both modelled.**
Today `school_periods` is one bell schedule per school (`school_id`, no grade), which
the 020 migration header already calls "one template for all working days (v1)".
The founder's case — KG on fewer periods than grade 6 — needs a template layer:

- *Period template* (Setup › School day): a named set of periods and breaks
  (`period_templates` + `period_template_periods`), and a grade → template
  assignment. A school with one shape has one template assigned to every grade, so
  the simple case stays simple. Not hard-wired: templates are rows, not code.
- *Timetable* (Classes › Timetable): subjects, teachers and rooms placed on the
  template's slots, per section. `timetable_slots.period_id` then points at a template
  period rather than a school-wide one.

Rule: the template is configuration (Setup); the filled grid is class data (Classes).
The current school-wide bell schedule becomes "the default template" in a migration
with no data loss.

**Year rollover.** Accepted in principle; the founder wants to see the page before the
move. A visual mock of Setup › Year rollover and Classes (with class creation moved
in) comes before any code changes there.

**Knowledge: class-level vs teacher-shared — two things, tracked separately.**
Today `knowledge_materials` attach to `class_subjects` through a join table, and a
`class_subject` is one section's subject (class = grade + section + year). So "Grade 6
Science" material must be attached to each section separately; nothing represents the
grade-level subject. The founder's rule — knowledge for a class is constant across its
sections — needs a grade-level anchor:

- *Class knowledge* (curriculum sources, admin-curated, A5/A17): attached at
  grade × subject, inherited by every section's `class_subject`. Model: a
  `grade_subjects` entity (school, grade, subject) that `class_subjects` reference, and
  materials attach there. Sections inherit; a section-specific extra is still allowed.
- *Shared library* (teacher-created, shared to the school shelf, T11): stays a separate
  concept and a separate page. Provenance is the teacher; scope is the school.

Placement: Knowledge is its own group with two entries — Class knowledge and Shared
library — so the two are never confused. The class page's Knowledge tab reads the
inherited set.

**Home: role-driven with a preview switcher.** Keep the current teacher-centric home.
The code is already split (`admin-home.tsx`, `teacher-home.tsx`), so a "View as: Admin /
Teacher" switcher is cheap. Shown only to admins; the teacher preview is scoped to the
admin's own assignments. The switcher is a preview aid for the founder's dual role and
for splitting the shells cleanly, not a permissions feature.

**Teacher-facing screens untouched.** Confirmed.
