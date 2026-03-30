import { useMemo, useState } from "react"
import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface Student {
  id: string
  class_id: string
  full_name: string
  roll_number: number
  register_number: string
  created_at?: string
}

interface StudentTableProps {
  students: Student[]
}

export function StudentTable({ students }: StudentTableProps) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        String(s.roll_number).toLowerCase().includes(q) ||
        s.register_number?.toLowerCase().includes(q),
    )
  }, [students, search])

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, roll or register no..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Roll Number</TableHead>
              <TableHead>Register Number</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  {search
                    ? "No students match your search."
                    : "No students in this class."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((student, idx) => (
                <TableRow key={student.id}>
                  <TableCell className="text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {student.full_name}
                  </TableCell>
                  <TableCell>{student.roll_number}</TableCell>
                  <TableCell>{student.register_number}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {students.length} student
        {students.length !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
