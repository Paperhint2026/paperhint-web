# 04 · School day (A3 configuration)

Group: Setup · Handoff: part of A3 (BUILD) · Today: one bell schedule per school in a
Timetable dialog; week settings in a Calendar form. **First migration that touches a
table the live timetable reads — staging decision due before this ships.**

## Scope

The shape of the school day, per grade. **Period templates**: named sets of periods and
breaks with times (KG: 5 periods; grades 6–12: 8). **Grade → template** assignment done as a multi-select of grades, so a band (primary,
seniors) is one action without a band object (truth.md: bands stay translucent). A school
with one shape assigns one template everywhere. **Week**: working days and week
start (moved from Calendar; shown here, stored on `schools` as today).

## Schema (additive; migration 025)

- `period_templates (id, school_id, name, is_default bool, created_at)`.
- `period_template_periods (id, template_id, period_number, name, start_time, end_time,
  is_break, day_of_week smallint NULL)`; NULL = every working day. UNIQUE (template_id,
  period_number, day_of_week); CHECK end > start. The nullable day is the readiness for a
  short-Saturday variant later (truth.md: not seen yet, be ready) without another migration.
- `grade_period_templates (school_id, grade, template_id, PRIMARY KEY (school_id, grade))`.
- Migration copies each school's `school_periods` into one template named "Default",
  marks it default, assigns it to every grade in use, and adds
  `timetable_slots.template_period_id` backfilled by matching `period_id` →
  same period_number. `school_periods` and `period_id` stay until the Timetable module
  switches readers, then a later migration drops them.

## API

- `GET|POST|PATCH|DELETE /api/timetable/templates` · `PUT /:id/periods` (replace set) ·
  `PUT /api/timetable/grade-templates` (grade → template map).
- `GET /api/timetable/periods` (exists) gains `?grade=` and returns that grade's template
  periods; without grade returns the default template (keeps today's callers working).
- `PATCH /api/calendar/week-settings` (exists) is called from this page now.

## Screens and pickers

- **Setup › School day**: templates as cards (periods rendered as a day strip); "New
  template" generator (start, end, period length, breaks → rows, editable, as today's
  BellScheduleSetup does); grade assignment as a 1–12 row of template pickers; Week
  panel. The Timetable page's Bell schedule dialog is removed and links here.
- **Timetable**: grid rows come from the class's grade template.

## Acceptance

- Existing schools see one "Default" template on every grade with their current
  periods; no timetable cell changes.
- KG on 5 periods and grade 6 on 8 render as different grids.
- Changing a template that has published slots warns with the affected section count
  and requires confirm; slots on removed periods are listed, not silently dropped.
- Calendar page no longer edits week settings.

## Out of scope

Per-day variant UI (schema is ready; UI when a pilot school needs it). Clash rules (05).
