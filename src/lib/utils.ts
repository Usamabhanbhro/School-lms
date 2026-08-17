/**
 * Tiny class combiner — no dependency needed for the skeleton's needs.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
