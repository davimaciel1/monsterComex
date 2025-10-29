import { Header } from "@/components/Header";
import { KPICard } from "@/components/KPICard";
import { ShipmentsChart } from "@/components/ShipmentsChart";
import { TopRankingCard } from "@/components/TopRankingCard";
import { ShipmentsTable } from "@/components/ShipmentsTable";
import { Badge } from "@/components/ui/badge";
import { Ship, Package, Weight, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";

interface Company {
  id: number;
  name: string;
  kind: 'importer' | 'exporter';
  countryCode: string;
}

export default function CompanyProfile() {
  const [, params] = useRoute("/company/:id");
  const companyId = params?.id ? parseInt(params.id) : 0;

  const { data: company } = useQuery<Company>({
    queryKey: [`/api/companies/${companyId}`],
    enabled: companyId > 0,
  });

  const { data: stats } = useQuery({
    queryKey: [`/api/companies/${companyId}/stats`],
    enabled: companyId > 0,
  });

  const { data: chartData = [] } = useQuery({
    queryKey: [`/api/companies/${companyId}/shipments-over-time`],
    enabled: companyId > 0,
  });

  const { data: topPartners = [] } = useQuery({
    queryKey: [`/api/companies/${companyId}/top-partners`],
    enabled: companyId > 0,
  });

  const { data: topOriginCountries = [] } = useQuery({
    queryKey: [`/api/companies/${companyId}/top-origin-countries`],
    enabled: companyId > 0,
  });

  const { data: topDestinationPorts = [] } = useQuery({
    queryKey: [`/api/companies/${companyId}/top-destination-ports`],
    enabled: companyId > 0,
  });

  const { data: topHSCodes = [] } = useQuery({
    queryKey: [`/api/companies/${companyId}/top-hs-codes`],
    enabled: companyId > 0,
  });

  const { data: shipmentsData } = useQuery({
    queryKey: [`/api/companies/${companyId}/shipments`],
    enabled: companyId > 0,
  });

  if (!company) {
    return (
      <div className="min-h-screen bg-background">
        <Header compact onSearch={(q) => console.log('Search:', q)} />
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const shipments = shipmentsData?.shipments || [];

  return (
    <div className="min-h-screen bg-background">
      <Header compact onSearch={(q) => console.log('Search:', q)} />
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 space-y-12">
        <div className="space-y-4">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-company-name">
                {company.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge data-testid="badge-company-type">
                  {company.kind === 'importer' ? 'IMPORTADOR' : 'EXPORTADOR'}
                </Badge>
                <span className="text-muted-foreground" data-testid="text-company-country">
                  {company.countryCode}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title="Embarques" value={stats?.totalShipments?.toLocaleString() || '0'} icon={Ship} />
          <KPICard title="TEUs" value={stats?.totalTEUs?.toLocaleString() || '0'} icon={Package} />
          <KPICard title="Peso (kg)" value={stats?.totalWeightKg?.toLocaleString() || '0'} icon={Weight} />
          <KPICard title="Parceiros" value={stats?.uniquePartners?.toString() || '0'} icon={Users} />
        </div>

        <ShipmentsChart data={chartData} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TopRankingCard title="Principais Parceiros" items={topPartners} />
          <TopRankingCard title="Principais Países de Origem" items={topOriginCountries} />
          <TopRankingCard title="Principais Portos de Destino" items={topDestinationPorts} />
        </div>

        {topHSCodes.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TopRankingCard title="Principais Códigos HS" items={topHSCodes} />
          </div>
        )}

        <ShipmentsTable shipments={shipments} onExport={() => console.log('Export CSV')} />
      </div>
    </div>
  );
}
