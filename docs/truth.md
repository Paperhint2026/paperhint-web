# Source of truth — founder-confirmed facts

Facts about how schools work and how Paperhint should behave, confirmed by the founder
in interview. Execution documents cite this file; when a fact here changes, the doc
changes. Dated. "Unknown until pilot" is a valid answer and is recorded as such.

## School & academic year (2026-09-10)

- One academic year open at a time. Overlap (old year's exams while the new year's classes
  run) is not a regular case; if it ever happens it is handled as a one-off, not modelled.
- Only an admin closes a year. Closing is final: no reopen. The school moves forward.
- **Rooms are out.** Paperhint does not model the school's physical layout. Scope is
  class and section. No room on slots, no room clash rule.

## Calendar (2026-09-10)

- One calendar per school, for every user. Three layers, in the order the office fills
  them: (1) holidays on their dates; (2) school events — annual day, sports day,
  activity days; (3) exam windows — term exams, typically three a year, with start and
  end **per grade range** (primary one week, seniors the next, KG with primary).
- Exam windows are defined when the calendar is defined. Exams are scheduled inside them
  (Exam manager reads the window for the grade). Teachers do not invent exam dates.

## School day (2026-09-10)

- Period count differs by grade, usually by **band** (primary, seniors). Templates are
  assigned per grade; assigning one template to a set of grades at once covers the band
  case. Whether "band" becomes a named configuration is open — keep it translucent:
  present as grouping, never as a mandatory step.
- Per-day timings (short Saturday, Saturday coaching) not encountered yet; possible in
  Indian schools. Usual week is five days. **Be ready**: schema allows a per-day
  variant later without migration pain.
- Breaks and assembly are the same for the whole school. Unknown until pilot whether
  any school differs.

## Departments & subjects (2026-09-10)

- A department can have **multiple heads**.
- A department is created by name and given the subjects it owns and the **grades it
  serves**. Primary may be a department that owns many subjects for low grades;
  Mathematics may own Maths for higher grades. A primary teacher does not teach senior
  grades and vice versa — the department's grade range expresses that, softly.
- Bands are subjective and unknown until pilot. Do not make them a deliberate object;
  the department's grade range is the translucent band.
- Every subject belongs to some department — grouping is required or the app gets hard
  to use — but never force-fit: a default **General** department exists for anything
  without a natural home.
- Departments with no subject exist: Physical Training, Library. They have teachers and
  grades they serve, and can hold timetable slots (a PT period, a library period)
  without a curriculum subject.

## Teachers and staff (2026-09-10)

- A teacher can belong to **more than one department**: a primary department and
  secondary ones (Physics primary, Maths secondary for lower grades). Keep it fluid.
- When a teacher leaves: the account is **deactivated**, their data stays. The admin
  **replaces the teacher on each class-section** they held, and everything tied to that
  section (allotment, slots, upcoming duties) moves to the replacement. Replacement is
  the action; gaps are the interim state, never auto-reassigned.
- Combined classes exist: one teacher, two sections, same period, taught together.
  Allowed, not a clash.
- **Non-teaching staff are users**: office staff, librarian, lab assistant, PT staff.
  They appear in timetables (library period, PT period) and take attendance, so they
  log in. Role: staff, with a department (Library, PT) and grades served.
- Designation is a **reusable tag**, not a hierarchy: free text that becomes a tag on
  first use and is offered as a pick afterwards. No permissions attached. May become a
  per-school template later once real hierarchies are collected in pilots.

## Students (2026-09-10)

- Admission number is the permanent identity; roll number per section per year.
  (Founder's assumption, matches ours; confirm in pilot.)
- **Guardian contacts: two mandatory, one optional** (three slots; the third may be a
  grandparent or guardian). Notifications go to the primary contacts.
- Fee status and transport are **parked**: not in this build. Focus is teacher
  productivity, not the student's administrative record.
- Parent contact is universal: any teacher who teaches a student sees the profile and
  contacts; homework for a class triggers a push to the parents.

## Classes and sections (2026-09-10)

- **A grade decides the subject; a section decides who teaches it.** Sections exist to
  split students into teachable groups (A, B, C, D). Subject set is identical across a
  grade's sections.
- Electives vary by student inside a section: second language (Hindi / Tamil) and
  co-curricular electives (art, music, dance, assembly). Elective groups run in the
  same period in parallel. Larger schools sometimes vary subjects across sections —
  supported by the existing section-level `class_subjects`, not the default.
- **Class teacher owns the class.** Attendance is taken per period by that period's
  teacher (class teacher may take it at the start, for starters). Parent contact is not
  the class teacher's monopoly.

## Allotments (2026-09-10)

- Two teachers on one subject-section: some schools do, some don't. **Neutral**: allowed,
  not encouraged by the UI.
- Load ceiling per teacher (periods/week): optional configuration; the board warns when
  exceeded. Rarely hit in practice.

## Timetable and schedules (2026-09-10)

- A **committee of teachers plans the timetable with an admin**; the admin enters and
  shares it. Building is collaborative in the room, single-writer in the app.
- The timetable is **constant for the year**, often reused the next year. Changes are
  rare and come from teacher re-alignment (a replacement), not from redesign.
- "Publish" (our word) = the moment the draft becomes the live timetable teachers see
  on their schedules. Call it **Share** in the UI. Until shared, it is a draft.
- **The calendar has three layers**: (1) the school calendar (holidays, events, exam
  windows — the master); (2) the timetable (configured by the office); (3) each
  teacher's **schedule**, derived from the timetable, shown as a calendar. Teachers see
  schedules, not the grid.
- Schedules behave like Google/Cron calendars: a teacher can **add colleagues'
  schedules** to see when they are blocked. From another teacher's schedule she can
  **request to borrow** a period (e.g. a Maths teacher borrows the library period to
  finish the portion); the owner accepts by notification. From her own schedule she can
  **request a substitute** for a period, to specific colleagues. Accepted requests show
  on both schedules and on the dashboard as an upcoming duty with a timer.
- Teachers do not need each other's load numbers; availability via schedules is enough.

## Year rollover (2026-09-10)

- Promotion is decided from results across terms. Default: whole sections promote
  (6A → 7A, same students). Exceptions: hold back (called out by the copilot from
  results), remove a student, add a transfer-in to a grade/section.
- **Reshuffle** happens in some schools (by performance, or to pair experienced
  teachers with weaker groups): a section → student remapping, done by uploading a list
  or typing names, then confirmed.

## Roles (2026-09-10)

- **Principal = admin + teacher.** Principals often teach senior classes. One account
  may hold both roles; the shell shows the union, the View-as switch already exists.
  Roles become a set, not a single value.

## The teacher's day (2026-09-10)

- Period log: if the planned chapter was taught, the log is pre-filled and confirmed
  with one tap; the teacher may add detail by talking to Hint. Both paths produce the
  same structured record, and the detail feeds the next recap.
- Syllabus: the **chapter list is board-defined per grade and subject** (CBSE, state
  board) — not hidden knowledge. **Order and pacing** are the department's or the
  teacher's strategy (some schools let teachers reorder chapters, e.g. easy first).
  Model: chapters are school data under Departments & subjects (pre-loadable from the
  board); the plan (order, deadlines) is per department or per teacher.
- Portion-completion KPI is visible to **the teacher and the department heads** (and
  admin), never to other teachers.
- Recap card is **generated**: from the previous log — who was absent, what was taught,
  what homework was given — assessed against the upcoming period. An assistant output,
  not a static query.

## Knowledge (2026-09-10)

- Curriculum sources are uploaded by **the office or department heads**, not teachers.
- **Board textbooks can be pre-loaded** per grade and subject (CBSE and state boards
  publish digital copies): crawl, or download-and-upload. Schools add their own material.
- **Private = only me.** Sharing is to invited people or to a whole department (pick the
  department, every member sees it).

## Question papers and exams (2026-09-10)

- **Two kinds.** Class tests: the teacher's own, quick to prepare, quick to evaluate with
  the answer-sheet evaluator, local to her class. Term/scheduled exams: **school-level**,
  large volumes of scanned sheets.
- Term papers are prepared by a **committee of teachers**, submitted to the school's
  board, and **approved before use**. Answer keys are provided to every evaluating
  teacher's desk. Approval is a real step.
- Unit tests count toward results only if the school scheduled them on the calendar;
  class tests never do (they are sudden, local, optional).

## Grading and results (2026-09-10)

- AI grading is a starting point: teachers **verify every mark and approve** before any
  publication. Upload-and-correct saves the entry work; the judgement stays theirs.
- Results to parents: today parents get the corrected paper. Paperhint version: the
  marked-up answer sheet with per-answer remarks, shareable as a PDF, or a printed
  overall evaluation with remarks. Not a marks feed.
- **Report cards are parked**: internal, viewable by teachers and the school, Paperhint
  layout only. The physical report card stays the school's own process.

## Attendance, notifications, homework (2026-09-10)

- **No parent app.** Parents receive **channel messages** (push to their phone via
  messaging channels). App context parked.
- Absence notifications go out **after the day's roll is complete**, not per period.
- Circulars: **admin sends**. Class-level announcements pass through class teachers;
  school-level ones go straight to parents and staff through the rail.
- Homework: **preparation only**. No digital submission, no evaluation; notebooks are
  corrected by hand.

## Ask Hint and onboarding (2026-09-10)

- Office copilot: **confirm, then execute** for state-changing requests.
- Onboarding: import from any table the school has; build connectors (MCP) for tools
  they already use; sync **Google Workspace calendars** where schools run on Google.
  Must feel easy, never a new process.
- Admin Home after setup: today's gaps — unfilled periods and registers not yet taken.

## Landed on main by the dev (2026-09-11, observed 2026-09-12)

- **School setup page at `/setup`** with sections Working week, Bell timing, Student
  form, Teacher form. The two forms are a **form builder for custom fields** on students
  and teachers (`GET /api/custom-fields?entity=`). This answers the `custom_fields`
  question: it is a real feature. Modules 01 (academic year) and 04 (period templates)
  build **inside this page as new sections**, not as separate pages.
- **Plan feature flags**: `timetable`, `calendar`, `copilot`, `grading` from
  `/api/auth/features`; rows and routes hide when a school's plan lacks them. The nav
  definition carries `feature` per row.
- **Platform role**: PaperHint team accounts with no school; they see only the Platform
  Console (school provisioning, module licensing). `navForRole("platform")`.
- Grading UX and Ask Hint retry changes (no scheme impact).
