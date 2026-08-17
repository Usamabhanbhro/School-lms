import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function RolePlaceholder({
  icon,
  title,
  blurb,
  planned,
}: {
  icon: LucideIcon;
  title: string;
  blurb: string;
  planned: string[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-text/60">{blurb}</p>
      </div>
      <Card className="p-6">
        <EmptyState
          icon={icon}
          title="Skeleton ready — modules land next"
          description={`Planned for this role: ${planned.join(", ")}. Each module is being added to this shell incrementally.`}
        />
      </Card>
    </div>
  );
}
