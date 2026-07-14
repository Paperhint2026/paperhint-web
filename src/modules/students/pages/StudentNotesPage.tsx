import { useParams } from 'react-router-dom';
import { StudentNotesSection } from '../components/StudentNotesSection';

export function StudentNotesPage() {
  const { studentId } = useParams<{ studentId: string }>();

  if (!studentId) {
    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <h1 className="text-2xl font-bold text-destructive">Error</h1>
            <p className="text-muted-foreground">Student ID not found in URL.</p>
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* This page is a wrapper for the notes section. In a real app, this section would likely be a tab on the main student detail page. */}
        <StudentNotesSection studentId={studentId} />
      </div>
    </div>
  );
}
