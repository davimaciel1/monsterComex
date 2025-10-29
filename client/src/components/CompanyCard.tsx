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
}

export function CompanyCard({ name, kind, countryCode, score, onClick }: CompanyCardProps) {
  return (
    <Card 
      className="p-6 hover-elevate cursor-pointer" 
      onClick={onClick}
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
                {kind.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground" data-testid={`text-country-${countryCode}`}>
                {countryCode}
              </span>
            </div>
          </div>
        </div>
        {score && (
          <div className="text-sm text-muted-foreground" data-testid="text-similarity-score">
            {Math.round(score * 100)}% match
          </div>
        )}
      </div>
    </Card>
  );
}
