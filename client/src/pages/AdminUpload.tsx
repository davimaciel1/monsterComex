import { Header } from "@/components/Header";
import { UploadZone } from "@/components/UploadZone";
import { IngestionHistoryTable } from "@/components/IngestionHistoryTable";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

export default function AdminUpload() {
  const mockIngestions = [
    {
      id: 1,
      filename: 'shipments_2024_Q1.xlsx',
      uploadDate: '2024-01-15 14:30',
      status: 'done' as const,
      rowsTotal: 15000,
      rowsOk: 14950,
      rowsFailed: 50,
    },
    {
      id: 2,
      filename: 'export_data.csv',
      uploadDate: '2024-01-14 09:15',
      status: 'processing' as const,
      rowsTotal: 8000,
      rowsOk: 6500,
      rowsFailed: 0,
    },
    {
      id: 3,
      filename: 'import_records.xlsx',
      uploadDate: '2024-01-13 16:45',
      status: 'failed' as const,
      rowsTotal: 5000,
      rowsOk: 2300,
      rowsFailed: 2700,
    },
    {
      id: 4,
      filename: 'trade_data_Q4.csv',
      uploadDate: '2024-01-12 11:20',
      status: 'done' as const,
      rowsTotal: 12000,
      rowsOk: 12000,
      rowsFailed: 0,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header compact onSearch={(q) => console.log('Search:', q)} />
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 space-y-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-admin-title">
              Admin Upload
            </h1>
            <Badge variant="default" data-testid="badge-admin-role">ADMIN</Badge>
          </div>
          <p className="text-muted-foreground" data-testid="text-admin-description">
            Upload and manage Excel/CSV files for maritime trade data ingestion
          </p>
        </div>

        <UploadZone onFileSelect={(file) => console.log('File selected:', file)} />

        <IngestionHistoryTable 
          ingestions={mockIngestions}
          onViewErrors={(id) => console.log('View errors:', id)}
          onReprocess={(id) => console.log('Reprocess:', id)}
          onCancel={(id) => console.log('Cancel:', id)}
        />
      </div>
    </div>
  );
}
