import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  addStudentNote,
  fetchStudentNotes,
  selectStudentNotes,
  selectStudentNotesStatus,
} from '@/store/studentNotes-slice';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

interface StudentNotesSectionProps {
  studentId: string;
}

export function StudentNotesSection({ studentId }: StudentNotesSectionProps) {
  const dispatch = useAppDispatch();
  const notes = useAppSelector(selectStudentNotes);
  const status = useAppSelector(selectStudentNotesStatus);
  const [newNoteContent, setNewNoteContent] = useState('');

  useEffect(() => {
    if (studentId) {
      dispatch(fetchStudentNotes(studentId));
    }
  }, [studentId, dispatch]);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNoteContent.trim() && status !== 'loading') {
      dispatch(addStudentNote({ studentId, content: newNoteContent.trim() })).then(() => {
        setNewNoteContent('');
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const isSubmitting = status === 'loading' && newNoteContent !== '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleAddNote} className="space-y-4">
          <Textarea
            placeholder="Add a new note..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            rows={3}
            disabled={isSubmitting}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={!newNoteContent.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Note
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          {status === 'loading' && notes.length === 0 && (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {status === 'succeeded' && notes.length === 0 && (
            <p className="text-center text-muted-foreground">No notes for this student yet.</p>
          )}

          {notes.map((note) => (
            <div key={note.id} className="flex items-start space-x-4 p-4 border rounded-lg bg-background">
              <Avatar>
                <AvatarImage src={note.author.avatar_url || undefined} alt={note.author.full_name} />
                <AvatarFallback>{getInitials(note.author.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{note.author.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(note.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
