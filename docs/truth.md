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
