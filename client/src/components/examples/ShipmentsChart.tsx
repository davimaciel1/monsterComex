import { ShipmentsChart } from '../ShipmentsChart';

export default function ShipmentsChartExample() {
  const mockData = [
    { month: 'Jan', shipments: 120 },
    { month: 'Feb', shipments: 150 },
    { month: 'Mar', shipments: 180 },
    { month: 'Apr', shipments: 140 },
    { month: 'May', shipments: 200 },
    { month: 'Jun', shipments: 170 },
  ];

  return (
    <div className="p-8 max-w-4xl">
      <ShipmentsChart data={mockData} />
    </div>
  );
}
