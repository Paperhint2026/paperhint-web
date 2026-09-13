# Execution principles (apply to every module document)

Founder's rule, 2026-09-10: **the whole app should be seamless.** In testable terms:

1. **No dead ends.** Every nav row opens something. Every artefact opens from every
   horizontal it is tagged with (subject, section, teacher, student, year). Every
   empty state names the next action and links to it.
2. **Pickers are pre-filtered, never full lists.** Candidates come from the junction
   (allotment, department, roster, free-at-period), with "show all" behind a step.
3. **One record, many views.** The same rows serve admin and teacher; scope changes,
   the data does not. Never build a second table for a second role.
4. **Setup flows into use.** Finishing one setup step offers the next. Data entered
   once is picked everywhere; nothing is typed twice.
5. **Tags and provenance are mandatory.** Every artefact row carries its horizontal
   keys and a link to what it was made from (see `docs/module-map.md`).

Each module document has the same six headings: Scope · Schema · API · Screens and
pickers · Acceptance · Out of scope. Migrations are additive, idempotent, and
recorded in `paperhint-service/migrations/README.md` in the same commit.

## Navigation depth — the thumb rule (founder, 2026-09-13)

At most **three levels of navigation** on any screen, always in this order:

1. **Level 1 — main sidebar.** The modules. The only vertical rail that belongs to
   the shell.
2. **Level 2 — tabs** across the top of the content area. Sections within a module
   (e.g. School setup: Academic year · Working week · Bell timing · Departments &
   subjects · Student form · Teacher form).
3. **Level 3 — a side panel inside the tab.** A master list whose selection drives
   the detail beside it (e.g. the department list beside the department's detail).

Never a fourth. Anything deeper opens as a drawer or dialog over the content.

**The swap.** Tabs hold up to **seven** sections. A module with more than seven
sections swaps levels 2 and 3: the sections become a side panel (level 2) and the
tabs move inside it (level 3). Below seven, a section list is never a vertical rail. Pickers show what is selected and offer an Add button with search — never
every candidate as a chip.
