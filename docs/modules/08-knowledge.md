# 08 · Knowledge: Class knowledge (A17/T10) and Shared library (T11)

Group: Knowledge · Handoff: DONE. Today: materials attach per section; Knowledge Library
and Shared Library pages exist; nav labels kept matching page titles until this ships.

## Scope

Two pages, never confused. **Class knowledge**: curriculum sources at grade × subject,
inherited by every section; a section may add its own extras that never leak. Admin
curates school-wide; teachers see their subjects' sets. **Shared library**: teacher-made
items shared to the school shelf; provenance is the teacher. Every paper and note
records the materials it used.

## Schema (additive; migration 027)

- `knowledge_materials.grade_subject_id uuid NULL REFERENCES grade_subjects` — backfill
  from each material's class_subject's grade+subject; materials attached to several
  sections of one grade collapse to one grade-level row (dedupe by file hash / title,
  report the rest for manual merge).
- `knowledge_material_class_subjects` stays for section-only extras.
- `paper_sources (paper_id, material_id)` and `note_sources (note_id, material_id)`.
- `exams.paper_id` if papers are not first-class today (verify in exams module).

## API

Knowledge routes exist (upload, analyze, visibility). Add `?grade_subject_id=` filters,
`POST /api/knowledge/:id/scope` (section-only ↔ grade-wide), and sources endpoints on
exams/blueprints. `match_knowledge_materials` RPC gains a grade_subject filter.

## Screens and pickers

- **Knowledge › Class knowledge**: grade × subject matrix with counts; drill to the set;
  upload attaches at grade level by default with "only for this section" toggle.
- **Knowledge › Shared library**: as today, plus source links on each item.
- **Class page › Knowledge tab**: inherited set + section extras, labelled.
- **Setup › Departments & subjects**: counts link here.

## Acceptance

- Upload once for Grade 6 Maths → visible in 6A, 6B, 6C knowledge tabs.
- Section extra never appears in another section.
- A generated paper lists its sources; Ask Hint answers cite grade-level sources.

## Out of scope

Rename of nav labels lands here (Knowledge Library → Class knowledge).

## From interview batch 3 (truth.md)

- Uploaders are the office and department heads; teachers add personal material and
  share. Board textbooks pre-loaded per grade × subject (crawl or upload) as the seed set.
- Visibility: `private` (only me) · `shared` with an explicit audience: people or a whole
  department (`material_shares (material_id, user_id | department_id)`) · `school`.
- Class knowledge page gets a **Pre-load board textbooks** action on an empty grade-subject.
