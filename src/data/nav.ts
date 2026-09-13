import type { Icon } from "@phosphor-icons/react"
import type { FeatureKey } from "@/hooks/use-features"
import {
  ArchiveIcon,
  BellIcon,
  BookOpenIcon,
  BooksIcon,
  BuildingsIcon,
  CalendarCheckIcon,
  CalendarDotsIcon,
  CertificateIcon,
  ChalkboardIcon,
  ChalkboardTeacherIcon,
  ChartBarIcon,
  ClipboardTextIcon,
  FilesIcon,
  GraduationCapIcon,
  HouseIcon,
  IdentificationCardIcon,
  ListChecksIcon,
  SparkleIcon,
  StackIcon,
  TableIcon,
  UserSwitchIcon,
} from "@phosphor-icons/react"

/**
 * One source for the sidebar, per role. The shell is shared; the menu is not.
 *
 * Admin groups follow how the office sets up and runs the school (see
 * docs/admin-ia-evaluation.md). The teacher menu is, for now, exactly what
 * teachers see today — its own restructure is a later pass.
 *
 * `status: "soon"` rows are modules from the Sept 2026 handoff that are not
 * built yet. They stay in the nav so the whole application is visible, and
 * land on /soon/<slug>, which shows the module's own description.
 */

export type NavStatus = "live" | "soon"

export type NavItem = {
  /** Stable key; for "soon" rows it is also the /soon/:slug. */
  key: string
  title: string
  icon: Icon
  path: string
  status: NavStatus
  /** Active when the current path matches. Default: startsWith(path). */
  match?: "exact" | "prefix"
  /** Plan feature that must be enabled for the row to show (see use-features). */
  feature?: FeatureKey
  /** Handoff code (A1, T4…) — shown on the placeholder page. */
  code?: string
  /** One-paragraph description from the handoff — placeholder page body. */
  blurb?: string
}

export type NavGroup = {
  /** Omit for the primary (unlabelled) group at the top. */
  label?: string
  items: NavItem[]
}

const soon = (
  key: string,
  title: string,
  icon: Icon,
  code: string,
  blurb: string
): NavItem => ({
  key,
  title,
  icon,
  path: `/soon/${key}`,
  status: "soon",
  code,
  blurb,
})

export const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      {
        key: "home",
        title: "Home",
        icon: HouseIcon,
        path: "/",
        status: "live",
        match: "exact",
      },
      {
        key: "ask",
        title: "Ask Hint",
        icon: SparkleIcon,
        path: "/ask",
        status: "live",
        feature: "copilot",
      },
    ],
  },
  {
    label: "Setup",
    items: [
      {
        key: "setup",
        title: "School setup",
        icon: BuildingsIcon,
        path: "/setup",
        status: "live",
      },
      {
        key: "calendar",
        title: "Calendar",
        icon: CalendarDotsIcon,
        path: "/calendar",
        status: "live",
        feature: "calendar",
      },
      {
        key: "departments",
        title: "Departments",
        icon: BookOpenIcon,
        path: "/departments",
        status: "live",
      },
      {
        key: "subjects",
        title: "Subjects",
        icon: StackIcon,
        path: "/subjects",
        status: "live",
      },
      {
        key: "batches",
        title: "Batches",
        icon: ArchiveIcon,
        path: "/batches",
        status: "live",
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        key: "teachers",
        title: "Teachers",
        icon: IdentificationCardIcon,
        path: "/teachers",
        status: "live",
      },
      {
        key: "students",
        title: "Students",
        icon: GraduationCapIcon,
        path: "/students",
        status: "live",
      },
    ],
  },
  {
    label: "Classes",
    items: [
      {
        key: "classes",
        title: "Classes",
        icon: ChalkboardIcon,
        path: "/classes",
        status: "live",
      },
      {
        key: "allotments",
        title: "Allotments",
        icon: ChalkboardTeacherIcon,
        path: "/allotments",
        status: "live",
      },
      {
        key: "timetable",
        title: "Timetable",
        icon: TableIcon,
        path: "/timetable",
        status: "live",
        feature: "timetable",
      },
    ],
  },
  {
    label: "Exams & papers",
    items: [
      soon(
        "exam-manager",
        "Exam manager",
        CalendarCheckIcon,
        "A12",
        "Schedule an exam across classes on the calendar; question papers and grading link to it; results publish in one action."
      ),
      soon(
        "question-papers",
        "Question papers",
        FilesIcon,
        "T13",
        "Every paper in the school in one place — drafted from class sources or uploaded — instead of one class at a time."
      ),
      soon(
        "grading",
        "Grading",
        ListChecksIcon,
        "T14",
        "Answer sheets photographed and scored against the same rubric for every student; the school-level view over what teachers review."
      ),
      soon(
        "results",
        "Results & report cards",
        CertificateIcon,
        "A13",
        "Marks per student per exam, and a printable term report card compiled from the records that already exist. Also shown inside each student's profile."
      ),
    ],
  },
  {
    label: "Operations",
    items: [
      soon(
        "attendance",
        "Attendance",
        ClipboardTextIcon,
        "A9",
        "The day's roll across the school; absences dispatched to parents; registers that haven't come in are visible and can be chased."
      ),
      soon(
        "substitution",
        "Leave & substitution",
        UserSwitchIcon,
        "A10",
        "Approve leave, watch every alteration, and cover the gaps: for any period no colleague filled, free teachers are suggested and a cover assigned."
      ),
      soon(
        "notifications",
        "Notifications & circulars",
        BellIcon,
        "A11",
        "One place to send school-wide or targeted messages to parents and staff. Homework, absence and marks notifications ride these rails automatically."
      ),
      soon(
        "reports",
        "Reports & KPI",
        ChartBarIcon,
        "A14",
        "School performance in one place: class scores, attendance trends, teacher chapter-completion, pending work — exportable for management."
      ),
    ],
  },
  {
    label: "Knowledge",
    items: [
      {
        key: "library",
        title: "Knowledge Library",
        icon: StackIcon,
        path: "/library",
        status: "live",
        match: "exact",
      },
      {
        key: "bank",
        title: "Shared Library",
        icon: BooksIcon,
        path: "/library/bank",
        status: "live",
      },
    ],
  },
]

/** Unchanged from today's teacher sidebar; the teacher restructure is a later pass. */
export const TEACHER_NAV: NavGroup[] = [
  {
    items: [
      {
        key: "home",
        title: "Home",
        icon: HouseIcon,
        path: "/",
        status: "live",
        match: "exact",
      },
      {
        key: "ask",
        title: "Ask Hint",
        icon: SparkleIcon,
        path: "/ask",
        status: "live",
        feature: "copilot",
      },
      {
        key: "classes",
        title: "Classes",
        icon: ChalkboardIcon,
        path: "/classes",
        status: "live",
      },
      {
        key: "teachers",
        title: "Teachers",
        icon: IdentificationCardIcon,
        path: "/teachers",
        status: "live",
      },
      {
        key: "students",
        title: "Students",
        icon: GraduationCapIcon,
        path: "/students",
        status: "live",
      },
      {
        key: "calendar",
        title: "Calendar",
        icon: CalendarDotsIcon,
        path: "/calendar",
        status: "live",
        feature: "calendar",
      },
      {
        key: "timetable",
        title: "Timetable",
        icon: TableIcon,
        path: "/timetable",
        status: "live",
        feature: "timetable",
      },
    ],
  },
  {
    label: "Library",
    items: [
      {
        key: "library",
        title: "Knowledge Library",
        icon: BookOpenIcon,
        path: "/library",
        status: "live",
        match: "exact",
      },
      {
        key: "bank",
        title: "Shared Library",
        icon: BooksIcon,
        path: "/library/bank",
        status: "live",
      },
    ],
  },
]

/** PaperHint team accounts: no school, only the console. */
export const PLATFORM_NAV: NavGroup[] = [
  {
    items: [
      {
        key: "platform",
        title: "Platform Console",
        icon: BuildingsIcon,
        path: "/platform",
        status: "live",
      },
    ],
  },
]

export function navForRole(role: string | undefined): NavGroup[] {
  if (role === "platform") return PLATFORM_NAV
  return role === "teacher" ? TEACHER_NAV : ADMIN_NAV
}

/** Placeholder lookup for /soon/:slug — searches both menus. */
export function findSoonItem(
  slug: string
): (NavItem & { group?: string }) | undefined {
  for (const menu of [ADMIN_NAV, TEACHER_NAV]) {
    for (const group of menu) {
      const hit = group.items.find((i) => i.status === "soon" && i.key === slug)
      if (hit) return { ...hit, group: group.label }
    }
  }
  return undefined
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.match === "exact") return pathname === item.path
  return pathname.startsWith(item.path)
}
