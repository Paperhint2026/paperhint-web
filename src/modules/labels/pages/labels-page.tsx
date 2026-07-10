// src/modules/labels/pages/labels-page.tsx
import { useEffect, useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import {
  fetchLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  Label,
} from "@/store/labels-slice"
import { RootState, AppDispatch } from "@/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { PlusIcon, TrashIcon, EditIcon, TagIcon } from "lucide-react"

const COLORS = [
  "#A3E635", // lime
  "#38BDF8", // sky
  "#F472B6", // pink
  "#F59E42", // orange
  "#FCD34D", // yellow
  "#A78BFA", // violet
  "#F87171", // red
  "#34D399", // emerald
  "#C4B5FD", // indigo
]

function LabelsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { labels, isLoading, error } = useSelector((state: RootState) => state.labels)

  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState(COLORS[0])
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState(COLORS[0])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState("")

  useEffect(() => {
    dispatch(fetchLabels())
  }, [dispatch])

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName) return
    dispatch(createLabel({ name: newName, color: newColor })).then((res) => {
      if ((res as any).error) return
      setShowNew(false)
      setNewName("")
      setNewColor(COLORS[0])
    })
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editId || !editName) return
    dispatch(updateLabel({ id: editId, name: editName, color: editColor })).then((res) => {
      if ((res as any).error) return
      setEditId(null)
    })
  }

  function openEdit(label: Label) {
    setEditId(label.id)
    setEditName(label.name)
    setEditColor(label.color || COLORS[0])
  }

  function openDelete(label: Label) {
    setDeleteId(label.id)
    setDeleteName(label.name)
  }

  function confirmDelete() {
    if (!deleteId) return
    dispatch(deleteLabel({ id: deleteId })).then((res) => {
      if ((res as any).error) return
      setDeleteId(null)
      setDeleteName("")
    })
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <TagIcon className="inline-block size-6 text-lime-600" /> Student Labels
        </h1>
        <Button onClick={() => setShowNew((p) => !p)} variant="primary" className="gap-2">
          <PlusIcon className="size-4" /> New Label
        </Button>
      </div>

      {showNew && (
        <form
          onSubmit={handleCreate}
          className="mb-4 flex gap-2 items-center bg-muted rounded-2xl p-3"
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Label name"
            className="max-w-xs"
            autoFocus
            required
          />
          <select
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="rounded-4xl border border-input p-2 ml-2"
            style={{ backgroundColor: newColor, color: '#fff', width: 48 }}
          >
            {COLORS.map((color) => (
              <option key={color} value={color} style={{ backgroundColor: color, color: '#fff' }}>
                ●
              </option>
            ))}
          </select>
          <Button type="submit" disabled={!newName}>
            Save
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowNew(false)}>
            Cancel
          </Button>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Students</TableHead>
              <TableHead className="w-20"/>
            </TableRow>
          </TableHeader>
          <TableBody>
            {labels.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No labels yet. Add your first label!
                </TableCell>
              </TableRow>
            )}
            {labels.map((label) => (
              <TableRow key={label.id}>
                <TableCell>
                  {editId === label.id ? (
                    <form className="flex gap-2 items-center" onSubmit={handleSaveEdit}>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Name"
                        className="max-w-xs"
                        required
                        autoFocus
                      />
                      <select
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="rounded-4xl border border-input p-1"
                        style={{ backgroundColor: editColor, color: '#fff', width: 36 }}
                      >
                        {COLORS.map((color) => (
                          <option key={color} value={color} style={{ backgroundColor: color, color: '#fff' }}>
                            ●
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm">
                        Save
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditId(null)}>
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <span>{label.name}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    style={{ backgroundColor: label.color || COLORS[0], color: "#fff" }}
                    className="px-2"
                  >
                    {label.name[0].toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>{label.student_count ?? 0}</TableCell>
                <TableCell className="flex gap-3 space-x-2 pr-4">
                  {editId !== label.id && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Edit"
                        onClick={() => openEdit(label)}
                      >
                        <EditIcon className="size-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete"
                            onClick={() => openDelete(label)}
                          >
                            <TrashIcon className="size-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete label "{deleteName || label.name}"?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove this label from ALL students it is assigned to. This action cannot be undone. Continue?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-destructive">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {error && <div className="text-destructive mt-2">{error}</div>}
    </div>
  )
}

export default LabelsPage
