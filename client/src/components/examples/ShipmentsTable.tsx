import { ShipmentsTable } from '../ShipmentsTable';

export default function ShipmentsTableExample() {
  const mockShipments = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    shipmentNo: `BL${1000 + i}`,
    ets: '2024-01-15',
    eta: '2024-02-10',
    partner: `Partner ${i + 1}`,
    origin: 'Shanghai',
    destination: 'Los Angeles',
    hsCode: '8471.30',
    teus: Math.floor(Math.random() * 20) + 5,
    weight: Math.floor(Math.random() * 50000) + 10000,
  }));

  return (
    <div className="p-8">
      <ShipmentsTable shipments={mockShipments} onExport={() => console.log('Export')} />
    </div>
  );
}
