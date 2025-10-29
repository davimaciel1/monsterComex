import { IngestionHistoryTable } from '../IngestionHistoryTable';

export default function IngestionHistoryTableExample() {
  const mockIngestions = [
    {
      id: 1,
      filename: 'shipments_2024_Q1.xlsx',
      uploadDate: '2024-01-15',
      status: 'done' as const,
      rowsTotal: 15000,
      rowsOk: 14950,
      rowsFailed: 50,
    },
    {
      id: 2,
      filename: 'export_data.csv',
      uploadDate: '2024-01-14',
      status: 'processing' as const,
      rowsTotal: 8000,
      rowsOk: 6500,
      rowsFailed: 0,
    },
    {
      id: 3,
      filename: 'import_records.xlsx',
      uploadDate: '2024-01-13',
      status: 'failed' as const,
      rowsTotal: 5000,
      rowsOk: 2300,
      rowsFailed: 2700,
    },
  ];

  return (
    <div className="p-8">
      <IngestionHistoryTable 
        ingestions={mockIngestions}
        onViewErrors={(id) => console.log('View errors:', id)}
        onReprocess={(id) => console.log('Reprocess:', id)}
        onCancel={(id) => console.log('Cancel:', id)}
      />
    </div>
  );
}
