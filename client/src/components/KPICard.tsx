import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
}

export function KPICard({ title, value, icon: Icon, description }: KPICardProps) {
  return (
    <Card className="p-6" data-testid={`card-kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-3xl font-bold mb-1" data-testid={`text-kpi-value-${title}`}>
        {value}
      </div>
      {description && (
        <div className="text-sm text-muted-foreground">
          {description}
        </div>
      )}
    </Card>
  );
}
