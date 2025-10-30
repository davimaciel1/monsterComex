import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CompanyCardProps {
  id: number;
  name: string;
  kind: 'importer' | 'exporter';
  countryCode: string;
  score?: number;
  onClick?: () => void;
  allowed?: boolean;
  lockReason?: string;
}

export function CompanyCard({ name, kind, countryCode, score, onClick, allowed = true, lockReason }: CompanyCardProps) {
  return (
    <Card
      className={`p-6 transition ${allowed ? "hover-elevate cursor-pointer" : "border-dashed opacity-70"}`}
      onClick={allowed ? onClick : undefined}
      data-testid={`card-company-${name}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-1">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-semibold mb-2" data-testid={`text-company-name-${name}`}>
              {name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant={kind === 'importer' ? 'default' : 'secondary'}
                data-testid={`badge-company-type-${kind}`}
              >
                {kind === 'importer' ? 'IMPORTADOR' : 'EXPORTADOR'}
              </Badge>
              <span className="text-sm text-muted-foreground" data-testid={`text-country-${countryCode}`}>
                {countryCode}
              </span>
            </div>
          </div>
        </div>
        {score && (
          <div className="text-sm text-muted-foreground" data-testid="text-similarity-score">
            {Math.round(score * 100)}% compatível
          </div>
        )}
      </div>
      {!allowed && lockReason && (
        <p className="mt-4 text-sm text-muted-foreground" data-testid="text-company-locked">
          {lockReason}
        </p>
      )}
    </Card>
  );
}
