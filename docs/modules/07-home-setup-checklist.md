# 07 · Home as setup checklist

Handoff: not a module; the founder's call (2026-09-10). Teacher home kept. Admin home
already has "Set up your school", "Needs a look", "Staffing".

## Scope

For a school that has not published a timetable, Home leads with a nine-step checklist,
each step linking into its page, done state computed live: School & year → Calendar →
Departments & subjects → Classes & sections → Teachers → Students → Allotments →
School day → Timetable published. Once published, the checklist folds into a compact
"setup complete" line and the operations view (Needs a look: gaps, missing registers,
pending exchanges) leads. The View-as switch previews the teacher home.

## Schema

None. Readiness is derived.

## API

`GET /api/schools/readiness` — one call returning each step's state and count
(reuses `/api/timetable/readiness`, allotment board gaps, counts of departments,
classes, teachers, students, calendar published, open year).

## Screens and pickers

Admin home: greeting; checklist card with progress (done / total); each row: step, state,
count, "Open →". Below it today's Needs a look and Staffing, unchanged. When all done:
checklist collapses to one line with "Setup complete · 9 of 9".

## Acceptance

- New school: step 1 open, others pending, every row links to the correct Setup page.
- Completing a step elsewhere updates the row on return without reload.
- Published timetable collapses the checklist.

## Out of scope

Teacher home changes; Ask Hint panel changes.

## From interview batch 3 (truth.md)

- Post-setup Home leads with today's gaps: unfilled periods and registers not taken.
- Setup checklist gains **Import**: from a table (CSV/XLSX) for students and teachers;
  Google Workspace calendar sync as an option on the Calendar step.

## Import, generalised (truth.md, 2026-09-13)

The Import step is one component used by every list module: download our template
(prefilled where possible) or upload theirs with column mapping; a preview table of
every row and what will happen to it; then apply. Subjects' paste-a-list is the first
instance and the shape to copy. Order: Students and Teachers (the big lists an office
already has in Excel), then Classes, Departments, Subjects.
