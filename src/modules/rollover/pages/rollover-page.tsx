import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowLeftIcon,
  CaretRightIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Sticker } from "@/components/shared/sticker"
import { ClassPlanStep } from "@/modules/rollover/components/class-plan-step"
import { ReviewStep } from "@/modules/rollover/components/review-step"
import { StudentsStep } from "@/modules/rollover/components/students-step"
import type { RolloverPlan } from "@/modules/rollover/lib/types"

const STEPS = [
  { key: "classes", label: "Class plan" },
  { key: "students", label: "Students" },
  { key: "review", label: "Review & run" },
] as const
type StepKey = (typeof STEPS)[number]["key"]

type YearRow = { id: string; label: string; status: "open" | "closed" }

/**
 * The rollover wizard (module 06). Every step is a tool the plan is built
 * through — a person and, later, an assistant edit the same saved draft
 * (docs/truth.md, founder 2026-09-13). Reached from Batches' "Start new
 * academic year"; it will move under Setup once the founder has seen the
 * class-and-student mock for that move.
 */
export function RolloverPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const navigate = useNavigate()

  const [plan, setPlan] = useState<RolloverPlan | null | undefined>(undefined)
  const [error, setError] = useState("")
  const [step, setStep] = useState<StepKey>("classes")
  const [done, setDone] = useState<Record<string, unknown> | null>(null)

  const load = () => {
    apiClient
      .get<{ plan: RolloverPlan | null }>("/api/rollover/plan")
      .then((r) => setPlan(r.plan))
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Could not load the rollover plan"
        )
      )
  }
  useEffect(load, [])

  const startDraft = async () => {
    try {
      const years = await apiClient.get<{ years: YearRow[] }>(
        "/api/academic-years"
      )
      const open = years.years.find((y) => y.status === "open")
      const closed = years.years
        .filter((y) => y.status === "closed")
        .sort((a, b) => b.label.localeCompare(a.label))[0]
      if (!open) {
        setError(
          "No academic year is open yet. Open one under Setup › Academic year first."
        )
        return
      }
      const r = await apiClient.post<{ plan: RolloverPlan }>(
        "/api/rollover/plan/start",
        { to_year: open.label, from_year: closed?.label ?? "" }
      )
      setPlan(r.plan)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the rollover")
    }
  }

  if (!isAdmin) {
    return (
      <div
        className={cn(
          PAGE_GUTTER,
          PAGE_TOP,
          "flex min-h-full flex-col items-center justify-center gap-4 pb-12"
        )}
      >
        <Sticker name="peek" size={96} />
        <p className="text-base font-medium text-secondary-foreground">
          Year rollover is for admins
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "flex min-h-full flex-col gap-5 pb-12"
      )}
    >
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link
          to="/batches"
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Batches
        </Link>
        <CaretRightIcon className="size-3" aria-hidden />
        <span className="truncate text-foreground">Year rollover</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Year rollover
        </h1>
        <p className="text-sm text-muted-foreground">
          Promote, detain and graduate whole classes, with a place for every
          exception. Nothing moves until the last step.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {plan === undefined ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : done ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 px-5 py-10 text-center">
          <Sticker name="excited" size={96} />
          <div className="flex max-w-md flex-col gap-1">
            <p className="text-base font-medium text-foreground">
              Rollover completed
            </p>
            <p className="text-sm text-muted-foreground">
              {String(done.moved ?? 0)} moved · {String(done.graduated ?? 0)}{" "}
              graduated · {String(done.classes_created ?? 0)} classes created ·{" "}
              {String(done.classes_reused ?? 0)} classes reused
            </p>
          </div>
          <Button onClick={() => navigate("/batches")}>Back to Batches</Button>
        </div>
      ) : !plan ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-background px-5 py-10 text-center">
          <Sticker name="point" size={96} />
          <div className="flex max-w-md flex-col gap-1">
            <p className="text-base font-medium text-secondary-foreground">
              No rollover in progress
            </p>
            <p className="text-sm text-muted-foreground">
              Start one once the next academic year is open.
            </p>
          </div>
          <Button onClick={startDraft}>Start the rollover</Button>
        </div>
      ) : (
        <>
          <nav
            aria-label="Rollover steps"
            className="-mb-px flex shrink-0 gap-1 overflow-x-auto border-b border-border"
          >
            {STEPS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(s.key)}
                aria-current={step === s.key ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 px-3 pb-2.5 text-sm whitespace-nowrap transition-colors",
                  step === s.key
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UsersThreeIcon className="size-3.5" />
            {plan.from_year} → {plan.to_year}
          </p>

          {step === "classes" && (
            <ClassPlanStep
              toYear={plan.to_year}
              plan={plan}
              onSaved={setPlan}
            />
          )}
          {step === "students" && (
            <StudentsStep
              planClasses={plan.plan.classes}
              onExceptionsChanged={(students) =>
                setPlan((p) =>
                  p ? { ...p, plan: { ...p.plan, students } } : p
                )
              }
            />
          )}
          {step === "review" && (
            <ReviewStep
              planId={plan.id}
              onExecuted={(result) => setDone(result)}
            />
          )}
        </>
      )}
    </div>
  )
}
