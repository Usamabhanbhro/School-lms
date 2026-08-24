import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BookOpenCheck,
  CheckCircle2,
  ClipboardX,
  UserRoundX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface NeedsAttentionItem {
  id: string;
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
}

export function NeedsAttention({ items }: { items: NeedsAttentionItem[] }) {
  return (
    <section className="mb-8" aria-labelledby="needs-attention-heading">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h2 id="needs-attention-heading" className="text-sm font-semibold uppercase tracking-wide text-text/60">
            Needs attention
          </h2>
          <p className="mt-1 text-sm text-text/60">
            Operational items that may need an Admin decision.
          </p>
        </div>
        {items.length > 0 && (
          <span className="border border-danger/30 bg-danger/5 px-2 py-1 text-xs font-semibold tabular-nums text-danger" aria-label={`${items.length} items need attention`}>
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="flex items-center gap-3 border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">All caught up</p>
            <p className="mt-0.5 text-sm text-text/60">No open attendance, staffing, or setup items were found.</p>
          </div>
        </Card>
      ) : (
        <div className="border border-border bg-bg">
          {items.map(({ id, title, detail, href, icon: Icon }, index) => (
            <Link
              key={id}
              href={href}
              className={`group flex min-w-0 items-center gap-3 p-4 transition-colors duration-150 ease-out hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${index > 0 ? "border-t border-border" : ""}`}
            >
              <span className="flex size-9 shrink-0 items-center justify-center border border-danger/30 bg-danger/5 text-danger">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block break-words text-sm text-text/60">{detail}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-text/30 transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-text/60" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export const needsAttentionIcons = {
  attendance: ClipboardX,
  classTeacher: UserRoundX,
  salary: Banknote,
  agenda: BookOpenCheck,
  warning: AlertTriangle,
} satisfies Record<string, LucideIcon>;
