# 01 · School & academic year (A1)

Group: Setup · Status: TWEAK in handoff (batch tag exists, no year module) · First
module in setup order; everything else dates from the year that is open here.

## Scope

One page with two parts. **School profile**: name, board, address, contact, logo,
week start and working days (moved here from Calendar's form; School day keeps the
period templates). **Academic years**: the list of years, exactly one *open*, the
rest *closed* (read-only). Opening a year is the first step of Year rollover, not a
separate action: "Start new academic year" on this page hands off to the rollover
flow, which creates the year, promotes classes and memberships, and closes the old
year at the end. Rooms live here too as a small list (name, capacity, optional
building), because the timetable's clash rule needs them and nothing else owns them.

## Schema (additive; migration 023)

- `academic_years (id, school_id, label text e.g. "2026–27", start_date, end_date,
  status enum open|closed, created_at)`; UNIQUE (school_id, label); at most one
  `open` per school (partial unique index).
- `classes.academic_year_id uuid REFERENCES academic_years` — nullable at first;
  backfill from the existing `classes.academic_year` text tag (one row per distinct
  tag per school), then keep the text column until every reader moves.
- `schools`: add `board text`, `address text`, `contact_email text`, `contact_phone
  text`, `logo_url text`. `week_start` / `working_days` already exist (018).
- `rooms (id, school_id, name, capacity int null, building text null)`; UNIQUE
  (school_id, name).
- RLS: enabled, no policies, service-role only — same posture as 020.

## API

- `GET /api/schools/me` → profile + open year + counts (exists in part; extend).
- `PATCH /api/schools/me` — profile fields, week settings.
- `GET /api/academic-years` · `POST /api/academic-years` (used by rollover) ·
  `PATCH /api/academic-years/:id` (dates, label) · `POST /api/academic-years/:id/close`.
- `GET|POST|PATCH|DELETE /api/rooms`.
- Every list endpoint that is year-scoped (classes, allotments, timetable, exams)
  accepts `?year=<id>` and defaults to the open year.

## Screens and pickers

- **Setup › School & year**: profile card (edit in place), Years list with the open
  year pinned and "Start new academic year →" (hands off to Year rollover), Rooms
  list with inline add. Admin only.
- **Year picker in the header** (shell): defaults to the open year; choosing a
  closed year puts the app in read-only mode with a visible band. This is how a
  teacher opens last year's paper without anything being editable.
- Calendar page loses its week-settings form; it links here instead.

## Acceptance

- A brand-new school lands on Home's setup checklist at step 1 and can complete the
  profile and open its first year without touching the database.
- Exactly one open year per school is enforced by the database, not the UI.
- Every existing class resolves to an `academic_years` row after backfill; no class
  left with a null year.
- Selecting a closed year renders every page read-only; no write endpoint accepts a
  closed year.
- Rooms appear as a picker in the timetable cell once the Timetable module reads them.

## Out of scope

Rollover mechanics (A15, own document). Department list (02). Period templates (03).
Custom staff fields (decision pending on `users.custom_fields`).
