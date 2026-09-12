# 09 · Exams & papers and Operations (A12, A13, A9, A10, A11, A14)

All BUILD. Each replaces one "Soon" row. Written as one document so the shared
dependency — the Notifications rail — is decided once.

## Order

1. **Notifications rail (A11)** first, as infrastructure: `notifications (id, school_id,
   recipient_user_id | student_id (parent), channel, kind, source_type, source_id,
   payload, status, sent_at)` + daily digest per recipient per channel (edge case 12).
   Publishers: attendance, homework, results, exchanges, circulars.
2. **Attendance oversight (A9)**: web surface over the mobile scan flow; day view per
   section, missing registers, resend. Tags: section, date, marker, student.
3. **Exam manager (A12)**: `exams` gains `academic_year_id` and a calendar **exam window**
   (truth.md: windows are set per grade range when the calendar is defined; exams are
   scheduled inside them, teachers do not invent dates); can span sections; papers and
   grading link; publish results in one action.
4. **Results & report cards (A13)**: `report_cards (student_id, academic_year_id, term,
   generated_at, pdf_url)` compiled from results + attendance; visible in the student
   profile to teachers of that student (edge case 8: full card by default).
5. **Leave & substitution (A10)**: office view over T2 exchanges; unfilled periods list;
   suggested free teachers; cover assignment; exam-duty check (edge case 5). Depends on
   Timetable versions (05) and T2 (teacher pass).
6. **Reports & KPI (A14)**: read-only aggregates; needs period logs (T4) for the
   teacher-completion KPI — ships with marks and attendance first, adds KPI when T4 exists.

## Cross-cutting acceptance

- Every artefact carries its tag columns from the module map matrix.
- No module sends its own messages; all go through the rail.
- Every list is year-scoped by the header picker.

## From interview (truth.md, 2026-09-10)

- Attendance: per period, by the period's teacher (including staff periods). Absence
  notifications go to the two primary guardian contacts.
- Homework assignment triggers a push to parents (rail).

## From interview batch 3 (truth.md)

- **Exam manager models term exams only.** Papers have `status draft → submitted →
  approved`; a committee prepares, the school approves, and the exam cannot be
  scheduled without an approved paper and an answer key. Class tests stay in the class
  module and never enter Exam manager.
- Unit tests count toward results only when scheduled on the calendar (a flag on the exam).
- Grading: every AI mark requires teacher verification; publication is blocked until all
  sheets are approved. Results to parents are the marked-up sheet as PDF with remarks,
  not a marks feed. **Report cards parked** — internal view only, Paperhint layout.
- Notifications: no parent app; channel messages. Absence digest after the day's roll.
  Circulars admin-sent; class-level announcements route via class teacher.
- Homework module is **preparation only**: draft, assign, notify. No submissions.
- Copilot state changes: confirm, then execute (edge case 10 stands).
