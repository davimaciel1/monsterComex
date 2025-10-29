import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, XCircle, RefreshCw } from "lucide-react";

interface Ingestion {
  id: number;
  filename: string;
  uploadDate: string;
  status: 'queued' | 'processing' | 'done' | 'failed' | 'canceled';
  rowsTotal: number;
  rowsOk: number;
  rowsFailed: number;
}

interface IngestionHistoryTableProps {
  ingestions: Ingestion[];
  onViewErrors?: (id: number) => void;
  onReprocess?: (id: number) => void;
  onCancel?: (id: number) => void;
}

const statusConfig = {
  queued: { label: 'Queued', variant: 'secondary' as const, icon: Clock },
  processing: { label: 'Processing', variant: 'default' as const, icon: RefreshCw },
  done: { label: 'Done', variant: 'default' as const, icon: CheckCircle },
  failed: { label: 'Failed', variant: 'destructive' as const, icon: XCircle },
  canceled: { label: 'Canceled', variant: 'secondary' as const, icon: AlertCircle },
};

export function IngestionHistoryTable({ ingestions, onViewErrors, onReprocess, onCancel }: IngestionHistoryTableProps) {
  return (
    <Card className="p-6" data-testid="card-ingestion-history">
      <h2 className="text-2xl font-semibold mb-6">Ingestion History</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Filename</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Upload Date</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">Total Rows</th>
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">Rows OK</th>
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">Rows Failed</th>
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ingestions.map((ingestion) => {
              const config = statusConfig[ingestion.status];
              const StatusIcon = config.icon;
              
              return (
                <tr 
                  key={ingestion.id} 
                  className="border-b hover-elevate"
                  data-testid={`row-ingestion-${ingestion.id}`}
                >
                  <td className="p-3 text-sm font-medium">{ingestion.filename}</td>
                  <td className="p-3 text-sm font-mono text-muted-foreground">{ingestion.uploadDate}</td>
                  <td className="p-3">
                    <Badge variant={config.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm font-mono text-right">{ingestion.rowsTotal.toLocaleString()}</td>
                  <td className="p-3 text-sm font-mono text-right">{ingestion.rowsOk.toLocaleString()}</td>
                  <td className="p-3 text-sm font-mono text-right">
                    <span className={ingestion.rowsFailed > 0 ? 'text-destructive' : ''}>
                      {ingestion.rowsFailed.toLocaleString()}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      {ingestion.rowsFailed > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onViewErrors?.(ingestion.id);
                            console.log('View errors:', ingestion.id);
                          }}
                          data-testid={`button-view-errors-${ingestion.id}`}
                        >
                          View Errors
                        </Button>
                      )}
                      {ingestion.status === 'failed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onReprocess?.(ingestion.id);
                            console.log('Reprocess:', ingestion.id);
                          }}
                          data-testid={`button-reprocess-${ingestion.id}`}
                        >
                          Reprocess
                        </Button>
                      )}
                      {(ingestion.status === 'queued' || ingestion.status === 'processing') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onCancel?.(ingestion.id);
                            console.log('Cancel:', ingestion.id);
                          }}
                          data-testid={`button-cancel-${ingestion.id}`}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
