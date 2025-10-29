import { Header } from "@/components/Header";
import { KPICard } from "@/components/KPICard";
import { ShipmentsChart } from "@/components/ShipmentsChart";
import { TopRankingCard } from "@/components/TopRankingCard";
import { ShipmentsTable } from "@/components/ShipmentsTable";
import { Badge } from "@/components/ui/badge";
import { Ship, Package, Weight, Users } from "lucide-react";

export default function CompanyProfile() {
  const mockChartData = [
    { month: 'Jan', shipments: 120 },
    { month: 'Feb', shipments: 150 },
    { month: 'Mar', shipments: 180 },
    { month: 'Apr', shipments: 140 },
    { month: 'May', shipments: 200 },
    { month: 'Jun', shipments: 170 },
    { month: 'Jul', shipments: 190 },
    { month: 'Aug', shipments: 210 },
    { month: 'Sep', shipments: 185 },
    { month: 'Oct', shipments: 195 },
    { month: 'Nov', shipments: 205 },
    { month: 'Dec', shipments: 220 },
  ];

  const mockShipments = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    shipmentNo: `BL${1000 + i}`,
    ets: '2024-01-15',
    eta: '2024-02-10',
    partner: `Trading Partner ${i + 1}`,
    origin: 'Shanghai, CN',
    destination: 'Los Angeles, US',
    hsCode: '8471.30',
    teus: Math.floor(Math.random() * 20) + 5,
    weight: Math.floor(Math.random() * 50000) + 10000,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header compact onSearch={(q) => console.log('Search:', q)} />
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 space-y-12">
        <div className="space-y-4">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-company-name">
                ACME Corporation
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge data-testid="badge-company-type">IMPORTADOR</Badge>
                <span className="text-muted-foreground" data-testid="text-company-country">Estados Unidos</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title="Embarques" value="2.340" icon={Ship} />
          <KPICard title="TEUs" value="8.456" icon={Package} />
          <KPICard title="Peso (kg)" value="1,2M" icon={Weight} />
          <KPICard title="Parceiros" value="67" icon={Users} />
        </div>

        <ShipmentsChart data={mockChartData} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TopRankingCard 
            title="Principais Parceiros" 
            items={[
              { name: 'ABC Trading Co', count: 245 },
              { name: 'Global Imports Ltd', count: 189 },
              { name: 'Ocean Freight Inc', count: 156 },
              { name: 'Maritime Solutions', count: 134 },
              { name: 'Trade Express LLC', count: 98 },
            ]} 
          />
          <TopRankingCard 
            title="Principais Países de Origem" 
            items={[
              { name: 'China', count: 456 },
              { name: 'Vietnã', count: 342 },
              { name: 'Coreia do Sul', count: 298 },
              { name: 'Japão', count: 234 },
              { name: 'Taiwan', count: 187 },
            ]} 
          />
          <TopRankingCard 
            title="Principais Portos de Destino" 
            items={[
              { name: 'Los Angeles', count: 567 },
              { name: 'Long Beach', count: 489 },
              { name: 'Nova York', count: 412 },
              { name: 'Savannah', count: 356 },
              { name: 'Oakland', count: 298 },
            ]} 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TopRankingCard 
            title="Principais Códigos HS" 
            items={[
              { name: '8471.30 - Computadores', count: 234 },
              { name: '8528.72 - Monitores', count: 189 },
              { name: '8517.62 - Roteadores', count: 156 },
              { name: '8443.32 - Impressoras', count: 134 },
              { name: '8504.40 - Fontes de alimentação', count: 98 },
            ]} 
          />
        </div>

        <ShipmentsTable shipments={mockShipments} onExport={() => console.log('Export CSV')} />
      </div>
    </div>
  );
}
