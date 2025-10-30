import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface NcmCardProps {
  code: string;
  description?: string | null;
  totalShipments: number;
  allowed?: boolean;
  lockReason?: string;
  onClick?: () => void;
}

export function NcmCard({ code, description, totalShipments, allowed = true, lockReason, onClick }: NcmCardProps) {
  return (
    <Card
      className={`p-6 transition ${allowed ? "hover-elevate cursor-pointer" : "border-dashed opacity-70"}`}
      onClick={allowed ? onClick : undefined}
      data-testid={`card-ncm-${code}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xl font-semibold" data-testid="text-ncm-code">{code}</h3>
            {description && (
              <p className="text-sm text-muted-foreground" data-testid="text-ncm-description">{description}</p>
            )}
          </div>
          <Badge variant="secondary">{totalShipments.toLocaleString()} embarques</Badge>
        </div>
        {!allowed && lockReason && (
          <p className="text-sm text-muted-foreground" data-testid="text-ncm-locked">{lockReason}</p>
        )}
      </div>
    </Card>
  );
}
