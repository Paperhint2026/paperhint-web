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
