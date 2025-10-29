import { KPICard } from '../KPICard';
import { Ship, Package, Weight, Users } from 'lucide-react';

export default function KPICardExample() {
  return (
    <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard title="Shipments" value="1,234" icon={Ship} />
      <KPICard title="TEUs" value="5,678" icon={Package} />
      <KPICard title="Weight (kg)" value="890K" icon={Weight} />
      <KPICard title="Partners" value="45" icon={Users} />
    </div>
  );
}
