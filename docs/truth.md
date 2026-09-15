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

## Layout (2026-09-13)

- **Three levels of navigation, maximum**: main sidebar (level 1) → tabs at the top of
  the content (level 2) → a side panel inside the tab (level 3). Never a fourth.
  Tabs hold up to seven sections; past seven, levels 2 and 3 swap (side panel of
  sections, tabs inside). Recorded in `docs/modules/00-principles.md`. Trigger: the Setup page stacked three
  vertical rails and the content had half the width left.

- **Cards are pages** (2026-09-13): any card-shaped collection that carries create
  actions inside it is a page with a breadcrumb trail, not a drawer or panel. Clicking
  a card navigates; the breadcrumb is the way back. Drawers are only for editing a
  single record in place.

## Bands (2026-09-13, founder)

- A **band is a tag, never a field.** Nobody fills in "primary" on a department.
  Ticking grades 1–4 already says primary; the app reads that back.
- Where a school actually **defines** its bands is **grade / class creation**
  (module 03), not the department page. The department page only names what the
  grade selection says.
- Department grades default to **all grades**: a school with no bands never
  touches them.

## Importing lists (2026-09-13, founder)

Wherever the app holds a quantifiable list — departments, classes, subjects,
teachers, students — offer two ways in besides typing:

1. **Our template.** Download a CSV/XLSX shaped for our table, prefilled where we
   already know rows (the subjects a department implies, the grades a school runs),
   fill it in, upload it back.
2. **Their list.** Upload whatever sheet the school already has; we read its columns,
   map them onto ours (confirmed, never guessed silently), and update.

Either way: preview before write, every row accounted for, same shape as the
subjects paste-list flow. One shared import component, not one per module.

## Year rollover is a wizard (2026-09-13, founder)

- Opening the next year is the easy part. The work is the **configuration
  between**: per class promote / graduate / hold; per student detain, move
  section, withdraw, add a transfer-in; reshuffle sections from a list. All of it
  must be possible inside the flow — no dead end that sends the admin elsewhere.
- **Every step is a tool.** The founder will put an AI on this. So the plan is a
  server-side record that a person and an assistant edit through the same
  endpoints, each with preview before apply, and execution is one atomic call.

## Rollover details (2026-09-13, founder)

- **Detained students stay where they are**: same grade, same section, by default.
  Changing a detained student's section is an optional per-student override.
- **Reshuffle is a list, not a rule.** Class teachers work it out offline and hand
  the admin "student → section"; the admin applies it. No rule-based sorting.
- **Admin executes.** They hold the lists.

## Rollover gates (2026-09-13, founder)

- A rollover can only start once the current academic year has **actually
  finished** (its own end date, set on the year). Opening the next year is
  refused before that date. A school with no end_date set has nothing to gate
  against.
- The wizard's draft plan can be **cancelled** at any point before execute —
  nothing has moved yet, so cancelling only discards the plan.

## Rollover: one screen, not three (2026-09-14, founder)

- The wizard is **two steps, not three**: Plan (classes + their students, one
  table) then Review & run. A class row expands into its own roster inline —
  detain, reshuffle, withdraw — instead of a separate "Students" tab a step
  away from the class it belongs to.
- **The terminal grade is derived from the school's own classes**, never
  assumed to be 12. A school's structure is its own; hardcoding a number
  invents a fact nobody confirmed. Highest existing grade graduates.
- The founder's mental model: "click a button, it sorts itself out for me,
  then I correct what's needed, then I click another button that does the
  job." The plan arrives pre-built (promote, same section, next grade); a
  person only touches what needs to change.

## Rollover: real detain switch, visual stepper, constant footer (2026-09-14, founder)

- **Detain is a real toggle, not a plan-time guess.** Promote/Detain per student
  in the roster panel writes `annual_result` directly (the same field a
  teacher sets from Results) — because that is what "detained" means
  everywhere else in the app, not a rollover-only concept.
- **Section is a visible field, not a hidden popover.** Every student row
  shows its target section as an always-editable input; Withdraw is a small
  link beside it. Nothing needs a click-to-reveal step first.
- **The wizard shows its shape at a glance**: a numbered, connected stepper
  (done = check, current = ringed number, ahead = plain number) above the
  content, not a tab strip.
- **One constant footer** drives both steps: "Continue to review" on Plan,
  "Run the rollover" on Review — never a button buried inside a step's own
  content that scrolls out of view.

## Rollover: three steps, not two (2026-09-14, founder — corrects the entry above)

- The "one screen, not three" collapse went too far. Founder's actual words:
  "step one grade promotion, then reshuffling if needed, then last step is
  summary and preview and then submit" — **three** distinct steps, with
  reshuffling as its own step, not inlined into the class table via row
  expansion.
- **Grade promotion** (step 1) is class-level only — no roster shown here.
  Promote/Graduate is only offered as a choice on a class at the school's own
  terminal grade; every other class just states its target, no button
  pretending there's a decision to make (founder: "it still shows graduate as
  an option in first step" — Graduate must not appear as a choice below the
  terminal grade at all, not just default away from it).
- **Reshuffling** (step 2) is a dedicated screen: pick a class from a list,
  work its roster (`ClassRosterPanel` — real detain switch, visible section
  field, Withdraw) on the right. Same master/detail shape as the rest of the
  product.
- **The stepper is chevron/arrow segments, not numbered circles** — founder
  pointed at a specific reference style: connected arrow-shaped tabs, each
  holding a bold title plus a lighter supporting line stacked inside the
  segment. Done = dark solid fill, current = tinted, upcoming = plain.

## Rollover: what each step actually owns (2026-09-14, founder)

- **Grade promotion decides who, not just where.** Founder: "the promotion is
  basically not just moving the classes to the next section, but also to
  identify who's getting promoted." A class opens straight to its student
  list only when it has someone already detained — in practice that's the
  senior grades (10-12, where results can fail a student); a junior class
  with nobody detained is one click, nothing to review. This is a default
  driven by the class's own detained count, never a hardcoded grade number —
  a class with detained students always exists to open by hand regardless.
- **Reshuffling is section-only, and can create a section that doesn't exist
  yet.** Founder: "I could also create a new section and then promote all
  the students to next year... in reshuffling I'll be able to create a new
  section if I need to, and move people there — if I have a list I can drop
  that too." Promote/Detain is already decided in step 1; this step only
  places promoted (and repeating) students into sections, with an explicit
  "New section" action (`POST /api/classes`) alongside the existing
  reshuffle-by-list paste.
- **Grade promotion never edits a section.** The class's target section
  shown in step 1 is always "same letter, next grade," read-only — founder
  (2026-09-15, third time flagging it): the step kept re-doing reshuffling's
  own job by letting the section be changed there too. Any section change,
  for a whole class or one student, happens only in Reshuffling.
- **Grade promotion is a class list + detail panel, same shape as
  Reshuffling.** Founder (2026-09-15): "grade promotion can also be like
  reshuffle, with a side panel and properties to alter on the right" — one
  class selected at a time instead of a single giant table; the identify
  list only shows automatically for a class with someone detained, with a
  "Review students" button as the manual escape hatch for any other class.
- **Neither panel is an accordion.** Founder: opening a long student list
  used to grow the whole row, stretching the short class list to match and
  leaving a visible gap under it. Both the class list and the detail panel
  are capped at the same height (`max-h-[32rem]`) and scroll independently —
  the container's height never depends on which class is selected.
- **The class detail header is a from → to, nothing else.** Founder's exact
  shape: "Grade 5A {10 students} / 2025-2026 batch → Grade 6A {10 students}
  / 2026-2027 batch." No detained count, no "change in Reshuffling" caption
  — he said plainly "we don't need any other details here."
- **Review is an itemized table, not just stat tiles.** Founder: "a complete
  table produced in a format of all the grades, all the sections, all the
  students." `POST /rollover/preview` now returns a `students` array (every
  student in the plan, their result, and exact destination) built by a
  read-only mirror of the execute engine's resolution
  (`buildItemizedPreview` in rollover.controller.js) — deliberately
  duplicated rather than reusing `executePlanCore`, since that function's
  `ensureTarget()` inserts classes as a side effect of resolving a target id
  and preview must never write anything.

## Department head is a single tag, not a widget (2026-09-15, founder)

- "Add head of department as a tag like dropdown to select from teachers
  rather than a widget" — the standalone "Heads of department" section on
  the department detail page is gone; a `HeadTag` pill sits next to the
  department name instead (`department-detail-page.tsx`), opening a
  Popover to search and pick.
- **One head per department.** Founder: "there can only be one HOD for a
  department." Picking a teacher replaces whoever held it — no multi-add
  chip list. The backend endpoint (`PUT /api/departments/:id/heads`, body
  `user_ids: string[]`) still technically accepts more than one; the
  frontend is what enforces "one" by always sending a 0-or-1-length array
  (`setHead()` in department-detail-page.tsx). Revisit the endpoint itself
  only if a real need for co-heads shows up.

## Edit department in one drawer (2026-09-15, founder)

- "There should be an option to edit department which opens as a side
  panel... adding [a subject] could be a lookup, a nested form for
  selection, and back to original form" — `EditDepartmentDrawer`
  (`src/modules/departments/components/edit-department-drawer.tsx`), opened
  by a new "Edit" button next to "Delete." One Sheet, four internal views
  (`main` / `add-teacher` / `add-subject` / `set-grades`), navigated with a
  back arrow — never a route change.
- **Grades stay derived from subjects, confirmed explicitly** (founder,
  answering directly): "grade selection" in the drawer is per-subject —
  picking which grades a newly-added subject with no grades yet runs in
  (`PUT /api/subjects/:id/grades`), shown only when that subject needs it.
  There is still no department-level grades field to set; `dept.grades` is
  read-only, same as before.
- **Teachers ARE addable here after all** — founder corrected an earlier
  read of "a teacher joins a department from their own profile": "I said
  we can nest the drawer... to select subjects and teachers for the
  department." The drawer's `add-teacher` view reuses the existing
  `PUT /api/auth/teacher/:id` endpoint with a `{ department_id }`-only body
  (no other teacher fields required) to move a teacher in or out. Moving a
  teacher already in another department is allowed and labeled as a move,
  not a copy — a teacher has exactly one department. Joining from a
  teacher's own profile still works too; this is an additional path, not a
  replacement.

## Custom route error screen (2026-09-15, founder)

- React Router's default crash page (a raw stack trace, "Unexpected
  Application Error!") is replaced by `RouteErrorPage`
  (`src/components/shared/route-error-page.tsx`), wired as `errorElement`
  on every top-level route in `src/routes/index.tsx`. Matches the
  Sticker-based empty-state convention used elsewhere (`worried`), with a
  Reload / Go home / Copy error action set — no 404 route was added, this
  covers only a route that actually throws.

## Edit-department drawer visual pass (2026-09-15, founder)

- Founder asked to borrow "the side panel we had for class details" — that
  exact component (`grade-overview-sheet.tsx`) no longer exists; it was
  converted to a routed page in `82c05e4` ("A grade opens as a page, not a
  sliding sheet"). What transferred is its VISUAL language (stat strip,
  chip-style tags, avatar rows, small-caps section labels), applied on top
  of the in-place back-arrow navigation already built for this drawer —
  not the old sheet's own interaction pattern (which stacked a second,
  separate Sheet instead, with no back button).
- `EditDepartmentDrawer` now opens on a hero (icon, inline-editable name,
  a `teachers · subjects · grades` stat line), a `CurlyDivider` (a fading
  squiggle, not a flat hairline) under it, then three sections: a "Head of
  department" picker, Teachers as avatar rows with a crown on whoever is
  head, and Subjects as chips carrying a grade pill (amber "No grades"
  when a subject has none yet). Each section's add action sits pinned
  above its list — founder: "as the list grows the CTA goes down as well"
  — not appended below it.
- The HOD picker inside the drawer reuses the department page's existing
  `setHead()` (one head, picking replaces) via a new `onSetHead` prop —
  the standalone `HeadTag` pill next to the department name on the main
  page is unchanged and still works; this is a second path to the same
  state, not a replacement.
- **Divider bug, fixed**: the first version built the wave against a fixed
  `viewBox="0 0 380 12"` stretched with `preserveAspectRatio="none"` — the
  real drawer renders narrower than 380px, so the same 39 bumps compressed
  into a tight, barely-visible tremor instead of a clean wave. Rebuilt as
  an SVG `<pattern>` tiled with `patternUnits="userSpaceOnUse"` (a fixed
  16px period, no viewBox scaling at all) so it looks identical at any
  drawer width; the fade is a separate opacity `<mask>` built from a
  gradient rect, not mixed into the stroke color, so the wave itself stays
  one consistent color end to end.
- Removed the redundant counts next to "Teachers"/"Subjects" section
  labels (founder: "we dont need counters against all the header like
  teachers 1") — the hero stat line already carries those numbers.
- **Resolved**: grades stay derived from subjects — no department-level
  grades field (`PUT /departments/:id/grades` stays unused). Founder: "we
  can have free flowing department association to grades, we can use
  subjects to aid in filling the grades for us by default but if they need
  they can add them eventually" — subjects aiding the department's grade
  range is the existing derivation, not a new mechanism, and per-chip grade
  editing beyond initial add is explicitly deprioritized ("eventually",
  via the Subjects page, not a new affordance in this drawer right now).
- **Mandatory grades on a brand-new subject, enforced at the exit, not just
  the button.** Founder: "if new subject like accounting is added, its
  mandatory [to] save grading before moving out, or else the subject
  getting added will be discarded." The "Add with these grades" button was
  already disabled at zero grades, but closing the whole drawer mid-step
  silently dropped the pending add with no explanation. `requestClose()`
  now intercepts a close attempt while `view === "set-grades"` and a
  `pendingSubject` is in flight, and an `AlertDialog` ("Discard Accounting?
  ... Closing now won't add it") requires an explicit choice — "Keep
  editing" or "Discard" — before the drawer actually closes.

## Teacher capability: subjects and grades, department auto-derived (2026-09-15, founder)

- A teacher's "what can they teach" is now a real, standalone capability —
  `teacher_subjects` (with one `is_primary` per teacher, enforced by a
  partial unique index) and `teacher_grades`
  (`paperhint-service/migrations/034_teacher_subjects_grades.sql`) —
  independent of `class_subjects`/`teacher_assignments`, which stay the
  live, per-section timetable rows they always were. Founder: "grades...
  will be associated in timetable selection for the respective section
  later, so we keep it as [a] multi-select" capability, not a live slot.
- **Subjects are mandatory, multi-select; one is primary.** The department
  Select on the teacher form is gone — `PUT /auth/teacher/:id/subjects`
  derives `users.department_id` server-side from the primary subject's
  department every time it's called. Confirmed: since a subject can belong
  to more than one department, when the primary subject itself has
  several, **the first by `created_at` wins, automatically, no manual
  tie-break UI** (founder's explicit choice among three options offered).
- **The "mark as head while adding a teacher" checkbox is gone.**
  `markAsHead()` in `teachers-page.tsx` called `PUT
  /departments/:id/heads` with an appended array (`[...heads, teacherId]`)
  — the OLD multi-head semantics from before the "one HOD" decision
  earlier this session. Rather than patch it to fit the new single-head
  model for one checkbox, it was dropped: marking a head now happens only
  from the department's own HeadTag/edit-drawer, which already do this
  correctly.
- **Visual pass applied here too**: the same hero (avatar, inline-editable
  name, a stat line) and `CurlyDivider` from the department edit drawer
  now open the teacher form, replacing the old "Basic Info" labeled-section
  header — extracted `CurlyDivider` to `src/components/shared/
  curly-divider.tsx` since it's now used in two places.
- **Not yet live**: migration 034 is written but NOT applied to
  production — this environment has no local Postgres to pre-validate it
  the way `migrations/README.md` prescribes, and there is no staging
  database, so it needs the founder's own go-ahead before running. Until
  it runs, `PUT /auth/teacher/:id/subjects` and `.../grades` will 500.
- **The capability fields narrow the live assignment picker below them,
  not sit beside it disconnected.** Founder: "we need to have the module
  linkage seamless... in teacher the fields still show as grade 5-A [for
  every class]" — the "Classes & Subjects" section's Class dropdown was
  still listing every class in the school regardless of what was just
  picked above. Now: the Class list only shows classes whose grade is in
  `teachableGrades` (unfiltered when none are picked yet — nothing to
  narrow by), and once a class is chosen, its Subject list only shows
  subjects in `subjectIds`. The two sections read as one form now, not
  two unrelated ones stacked in the same drawer.

## Teacher form: field order is a real filter chain (2026-09-15, founder)

- **Grade now comes before Subjects, and filters it.** Founder: "first the
  teacher should be selected [a] Class — no section yet — based on grade
  selected... subjects will be filtered... department can be auto
  picked... each item selected will be subset filtering the next." The
  order is now Grade → Subjects (only ones that run in a selected grade,
  via `TeachableSubjectOption.grades` from `/api/subjects/detail`) →
  Department (unchanged, derived server-side from the primary subject).
  Picking no grade yet shows every subject — nothing to narrow by.
- **Designation and Date of Joining moved up**, right after Phone, so the
  order reads: name → email → phone → designation → date of joining →
  [divider] → grade → subjects → department. Founder: "moved... to the
  top under work email and contact."
- **The header is a real header again, not scrolling hero content.**
  Founder: "a full header with divider, body containing the fields and
  footer with saving action" — the avatar/inline-name/stat-line hero now
  lives inside an actual `SheetHeader` (fixed, not part of the scrolling
  body), the name is set at title size (`text-xl`), and a `CurlyDivider`
  sits between the header and the scrollable body. Footer (Save/Close)
  was never touched — it already matched this.
- Every remaining plain `<Separator />` in this form was replaced with
  `CurlyDivider` for one consistent grouping device ("use the curly
  divider to do this grouping properly") — before Additional Details and
  before Classes & Subjects.

## "Classes & Subjects" removed from the teacher form entirely (2026-09-15, founder)

- Founder: "grade selection is already done... class... can be auto
  assigned from timetable... when configured... we don't need subject
  over here at all after that... class doesn't make any sense — classes
  and subjects, it's two repetitive fields selection happening." The
  live class/section assignment picker (pick a class, pick its subject,
  "Add More", existing-assignment chips, the disassociate confirm) was
  doing the same selection the new Grade → Subjects capability fields
  already do, just a second time with different UI.
- Removed entirely from `AddTeacherDrawer`: `classSubjects`/
  `existingAssignments` off `TeacherFormData`; the `classes`/
  `fetchSubjectsForClass`/`onDisassociate` props; all of the row-picker
  state and handlers (`handleClassChange`, `handleSubjectChange`,
  `addClassSubjectRow`, `removeClassSubjectRow`, `classOptions`,
  `subjectsByClass`, `confirmDisassociate`); the whole "Classes &
  Subjects" JSX section. `teachers-page.tsx` lost `handleDisassociate`,
  `fetchSubjectsForClass`, the `classes`/`ClassItem` fetch (nothing else
  on the page needed it), and the `newAssignments` POST loop in
  `handleSaveTeacher`.
- Which specific class/section a teacher actually teaches is the
  timetable's job now, not this form's — `class_subjects`/
  `teacher_assignments` and their endpoints
  (`POST /api/teacher-assignments`, `.../unassign`) are untouched; they
  just have no caller in this form anymore. A future timetable-side flow
  is where "auto assigned from timetable... when configured" would live.

## Department is a visible read-only field, not a caption (2026-09-15, founder)

- The "Maps to Commerce" caption next to the Subjects label was too easy
  to miss. Replaced with a real "Department" field — same visual weight
  as Designation/Phone (labeled, bordered box) — sitting right after
  Subjects in the derivation chain: Grade → Subjects → Department.
- **The auto-derivation direction is confirmed as the default, not the
  only one.** Founder: "sometimes a school would allot a teacher to a
  department and decide which class they can teach later too — for now
  we can make it auto populated and we can reverse this later when
  assigning them." Nothing built for the reverse (department-first) flow
  yet; the field's caption says to use that department's own page to
  override, which already works today via the department edit drawer's
  own teacher-adding flow.
- **Noted future direction, not yet built**: "this means in departments
  we will have a teacher tab where the teacher's subject and grade
  allotment will also be changed or assigned — tightly integrated."
  Today, `EditDepartmentDrawer`'s Teachers section can only add/remove a
  teacher from the department (via `PUT /auth/teacher/:id` department_id
  — actually via the subjects/department derivation path). Editing a
  teacher's `teachable_subjects`/`teachable_grades` FROM inside the
  department drawer (rather than only from the teacher's own form) is
  the follow-up this points at — ask before building, since it's a real
  scope addition to that drawer, not a small fix.
