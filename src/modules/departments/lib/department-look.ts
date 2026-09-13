import {
  AtomIcon,
  BooksIcon,
  BriefcaseIcon,
  CalculatorIcon,
  ChalkboardTeacherIcon,
  FlaskIcon,
  GlobeIcon,
  LeafIcon,
  MonitorIcon,
  MusicNotesIcon,
  PaletteIcon,
  PenNibIcon,
  PersonSimpleRunIcon,
  TranslateIcon,
  type Icon,
} from "@phosphor-icons/react"

import { coverFor } from "@/modules/classes/lib/grade-palette"

/**
 * A department's look. Grades carry a number on their card; a department has no
 * number, so it carries an icon instead (founder, 2026-09-13) — recognised from
 * its name the same way a new subject finds its department, so nobody has to
 * pick one. The cover palette is shared with the grade cards, so the two grids
 * read as one family: students live in grades, teachers live in departments.
 */

const LOOKS: { icon: Icon; match: string[] }[] = [
  { icon: FlaskIcon, match: ["science", "chemistry", "lab"] },
  { icon: AtomIcon, match: ["physics"] },
  { icon: LeafIcon, match: ["biology", "botany", "zoology", "environment"] },
  { icon: CalculatorIcon, match: ["math", "statistic"] },
  { icon: GlobeIcon, match: ["social", "history", "geography", "civic"] },
  {
    icon: BriefcaseIcon,
    match: ["commerce", "account", "business", "economic"],
  },
  {
    icon: MonitorIcon,
    match: ["computer", "it", "cse", "information", "technology"],
  },
  { icon: PenNibIcon, match: ["english", "literature", "language arts"] },
  {
    icon: TranslateIcon,
    match: [
      "hindi",
      "tamil",
      "sanskrit",
      "language",
      "regional",
      "french",
      "german",
    ],
  },
  {
    icon: PersonSimpleRunIcon,
    match: ["physical", "sport", "game", "yoga", "pt"],
  },
  { icon: MusicNotesIcon, match: ["music", "dance", "drama"] },
  { icon: PaletteIcon, match: ["art", "culture", "craft", "draw", "paint"] },
  { icon: BooksIcon, match: ["library", "reading"] },
]

export function lookFor(name: string) {
  const n = String(name || "").toLowerCase()
  const hit = LOOKS.find((l) => l.match.some((m) => n.includes(m)))
  return {
    Icon: hit?.icon ?? ChalkboardTeacherIcon,
    palette: coverFor(name),
  }
}
