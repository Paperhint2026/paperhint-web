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
