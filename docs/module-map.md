# Module map — horizontals, verticals, and how they link

Date: 2026-09-10. Companion to `admin-ia-evaluation.md` and the Sept 2026 handoff
(`paperhint-modules.pdf`, `paperhint-associations.pdf`). Grounded in the tables that
exist today; anything marked **new** is not in the schema yet.

## The rule

- A **horizontal** is reference data the whole school agrees on: who, what, when,
  where. It is defined once, in Setup or People, and every other module *picks from*
  it. A horizontal never carries workflow state.
- A **vertical** is a workflow that produces records: a timetable, a period log, an
  exam, a grade. It *consumes* horizontals through junctions and never defines its
  own copy of one (the timetable does not invent rooms; it picks a Room).
- A **junction** is where two horizontals meet and become pickable as one thing:
  subject × section, teacher × subject-section. Junctions are what make a vertical's
  pickers small.

Consequence for the UI: every picker in a vertical is a *filter over a junction*, not
a free list. Assigning a teacher to Maths for 6A in the timetable does not show 28
teachers; it shows the one or two allotted to 6A Maths.

## Horizontals (reference data)

| Horizontal | Table today | State | Owner in nav |
|---|---|---|---|
| School | `schools` (+ `week_start`, `working_days`) | exists | Setup › School & year |
| Academic year | text tag `classes.academic_year`, `schools.active_year` | **new** `academic_years` table needed; today a string | Setup › School & year |
| Calendar (terms, holidays, exam windows) | calendar tables (017–019) | exists | Setup › Calendar |
| School day (period template per grade) | `school_periods` (school-wide only) | **new** `period_templates` + grade assignment | Setup › School day |
| Department | `departments (name)` | exists; **new** `head_user_id` | Setup › Departments & subjects |
| Subject | `subjects (subject_name)` | exists; flat, no department link | Setup › Departments & subjects |
| Grade + Section (Class) | `classes (grade, section, academic_year)` | exists | Classes › Classes & sections |
| Teacher | `users (role='teacher', department_id, status)` | exists | People › Teachers |
| Student | `students (class_id, …)` | exists | People › Students |
| Room | — | **new**; needed for the timetable's room clash rule (A3) | Setup › School & year |

## Junctions (where horizontals meet)

| Junction | Table today | Means | State |
|---|---|---|---|
| Department ↔ Subject | — | which department owns a subject | **new** `department_subjects` |
| Subject × Grade | — | "Grade 6 Maths": the curriculum unit; knowledge attaches here | **new** `grade_subjects` |
| Subject × Section | `class_subjects (class_id, subject_id, elective group)` | "6A Maths": the taught unit | exists |
| Teacher × Subject-Section × Year | `teacher_assignments (teacher_id, class_subject_id, is_current, tenure)` | the **allotment** | exists (edited in the wrong places) |
| Student × Section × Year | `student_class_memberships` (013) | roster with history | exists |
| Student × Elective | `student_electives` | which elective a student takes | exists |

`grade_subjects` sits above `class_subjects`: every 6A/6B/6C Maths row points at the one
Grade 6 Maths row. That is what makes knowledge and syllabus constant across sections.

## Verticals (workflows)

Each row: what it produces, which horizontals it picks, through which junction.

| Vertical | Produces | Picks | Via |
|---|---|---|---|
| Allotments (A8) | teacher_assignments | Teacher, Subject-Section | department_subjects (default list), class_subjects |
| Timetable (A3) | timetable_slots (day × period × section) | Subject-Section, Teacher, Room, Period | class_subjects, **allotment**, period template |
| Period Exchange / Substitution (T2, A10) | alterations on slots | Teacher | timetable (free at period) ∩ department |
| Attendance (T8, A9) | daily roll per section | Student | roster |
| Period Log (T4) | one record per taught period | Subject-Section, topic | timetable slot |
| Syllabus / Portion (T5, T6) | chapter progress per section | grade_subjects chapters | period log |
| Knowledge (T10, A17) | materials | Subject × Grade | grade_subjects (inherited by sections) |
| Question papers (T13) | papers | Subject-Section, knowledge | class_subjects → grade_subjects |
| Exams (A12) / Grading (T14) / Results (T15) | exams, submissions, marks | Subject-Section, Student | class_subjects, roster |
| Report cards (A13) | per-student term document | Student, Year | results + attendance |
| Homework (T12) | assignments | Subject-Section, Student | period log, roster |
| Notifications (A11) | messages | Student (parent), Teacher | roster, directory |
| Reports & KPI (A14) | aggregates | all of the above | read-only |
| Year rollover (A15) | next year's classes, memberships | Year, Class, Student | promotes junctions, archives verticals |

## Pick rules (the founder's example, generalised)

1. **Timetable cell, 6A Maths, Wednesday P3 — who teaches it?**
   Tier 1: teachers with a *current allotment* on `class_subjects(6A, Maths)`.
   Usually one. Pre-selected.
   Tier 2: teachers in the department that owns Maths (`department_subjects`),
   shown as "also in Mathematics", not pre-selected.
   Tier 3: anyone, behind "show all", and the slot is flagged as outside allotment.
   Hard block at every tier: teacher already placed in another section at that
   period; room already taken (once Room exists).
2. **Allotment, 6A Maths — who can be allotted?**
   Default list is the Maths department (tier 2 above); anyone else behind "show all".
   Load shown per teacher from their current allotments and timetable.
3. **Knowledge for 6A Maths** is `grade_subjects(6, Maths)` materials. A teacher adds a
   section-only extra by attaching to `class_subjects(6A, Maths)`; it never leaks to 6B.
4. **A fill request for 6A Maths P3 on Wednesday**: candidates are teachers with no
   slot at Wednesday P3 (timetable), ordered same department first, then anyone free.
5. **A question paper for 6A Maths** draws from rule 3's set, so 6A and 6B papers
   draw from the same sources unless the section added extras.
6. **Every vertical row dates from the year**, directly or through its class. Rollover
   never rewrites verticals; it creates next year's classes and memberships and marks
   the old ones read-only (associations doc, edge case 1).


## Artefacts and how they cross-link

Everything a vertical produces is an **artefact**: a paper, a note, a grade, a log.
Two rules make artefacts findable from anywhere:

1. **Every artefact is tagged with the horizontals it belongs to** — as foreign keys
   to junction rows (`class_subject_id`, `grade_subject_id`), never as free text.
   Department is *derived* (subject → department, teacher → department), not stored.
2. **Every artefact records what it was made from** — a stored link to its source
   artefacts, so "which sources did this paper use" is a query, not a guess.

### Tag matrix

D = direct foreign key · d = derived through a junction · · = not applicable

| Artefact (module) | Year | Grade×Subject | Section | Teacher | Student | Calendar date | Department |
|---|---|---|---|---|---|---|---|
| Knowledge material (T10/A17) | d | D | optional | D uploader | · | · | d |
| Teaching note (T9) | d | D | optional | D author | · | · | d |
| Question paper (T13) | d | D | optional | D author | · | · | d |
| Exam (A12) | D | d | D one or many | d | · | D window | d |
| Answer sheet / submission (T14) | d | d | d | D grader | D | D | d |
| Result / marks (T15) | d | d | d | · | D | d | d |
| Report card (A13) | D | · | d | · | D | D term | · |
| Attendance record (T8/A9) | d | · | D | D marker | D | D | d |
| Period log (T4) | d | D | D | D who taught | mentions | D date + period | d |
| Homework (T12) | d | D | D | D | D assignees | D due | d |
| Exchange / fill request (T2/A10) | d | d | d | D from, D to | · | D | d both |
| Notification (A11) | d | · | d | D or · | D (parent) | D sent | · |
| Circular (A11) | D | · | D audience | · | · | D | D audience |
| Library item (T11) | d | D | · | D owner | · | · | d |

Reading the matrix by column gives each horizontal's **profile page** for free —
the "one shell, same data" rule from the associations doc:

- **Subject (Grade 6 Maths)**: knowledge, notes, papers, exams, syllabus progress,
  the sections it runs in, the teachers allotted.
- **Section (6A)**: timetable, roster, subjects, attendance, exams, results.
- **Teacher**: allotments, schedule, period logs, papers, notes, load, KPI.
- **Student**: roster history, attendance, results, report card, homework.
- **Department**: subjects owned, members, head, KPI slice — all derived.
- **Academic year**: everything above, read-only once the year closes.

### Provenance chains (stored links, arrow = "made from")

```
Knowledge material ──► Teaching note ──► Library item ──► Shared library
        │
        └──► Question paper ──► Exam ──► Answer sheet ──► Result ──► Report card
                                                             └──► Reports & KPI
Timetable slot ──► Period log ──► Syllabus progress ──► Teacher KPI ──► Reports & KPI
                       ├──► Recap card
                       └──► Homework ──► Submission ──► (Grading, reused)
Attendance record ──► Notification · Recap card · Report card
Exchange request ──► Slot alteration ──► Period log (by the filling teacher)
```

Two consequences:

- **Filters are free.** "Papers for Grade 6 Maths", "everything this teacher made
  this term", "6A's week" are each a single join on stored keys.
- **Reuse is safe.** A paper knows its sources; a result knows its exam; a log knows
  its slot. Rollover marks the year read-only and nothing dangles.

### What the schema has and lacks for this

Has: `knowledge_materials.class_subject_id` + `teacher_id`; `exams.class_subject_id`;
`student_submissions.exam_id`; `timetable_slots.class_subject_id` + `teacher_id`;
`teacher_assignments` with tenure. The pattern is already there.

Lacks: `grade_subject_id` on materials, notes and papers (today section-level only);
a stored **paper → source materials** link; **exam → paper** as a first-class link
(verify how exams reference their paper today); period log, homework, exchange,
notification tables (all BUILD modules). Each BUILD module's execution doc carries
its tag columns and its provenance links as acceptance criteria.

## Where the current app breaks the rule

| Violation | Fix |
|---|---|
| Allotments edited inside Teachers and inside Batches | One Allotments board under Classes; Teachers and Batches read-only |
| Week settings live on the Calendar page; bell schedule in a Timetable dialog | Both become School day under Setup |
| Subjects are flat; no department link; departments cannot be created | Departments & subjects page; `department_subjects`, `head_user_id` |
| Knowledge attaches per section, so 6A/6B/6C are uploaded three times | `grade_subjects`; sections inherit |
| Academic year is a text tag | `academic_years` table; classes reference it |
| No Room horizontal, so the timetable's clash rule is teacher-only | Add Room under School & year when Timetable gets its module pass |

## Build implication

Horizontals and junctions first, in setup order, because every vertical's picker
depends on them: School & year → Departments & subjects (with `department_subjects`)
→ Classes & sections → Teachers/Students → Allotments → School day → Timetable.
That is also the setup checklist Home will show a new school.
