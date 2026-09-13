import { Button } from "@/components/ui/button"

type ButtonProps = React.ComponentProps<typeof Button>

/**
 * A module's primary action: the green pill at the far right of a page header
 * (founder, 2026-09-13). One component, so the size, the shape and the place
 * are decided once and every module comes out the same. Pass `variant`
 * for the quieter companion beside it — "outline" for a second action.
 */
export function ModuleAction({
  variant = "default",
  ...props
}: Omit<ButtonProps, "size" | "shape">) {
  return <Button size="lg" shape="pill" variant={variant} {...props} />
}
