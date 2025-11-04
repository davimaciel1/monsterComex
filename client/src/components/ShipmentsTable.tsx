import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Shipment {
  id: number;
  shipmentNo: string;
  ets: string;
  eta: string;
  partner: string;
  origin: string;
  destination: string;
  hsCode: string;
  teus: number;
  weight: number;
}

interface ShipmentsTableProps {
  shipments: Shipment[];
  onExport?: () => void;
}

export function ShipmentsTable({ shipments, onExport }: ShipmentsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const itemsPerPage = 10;

  const filteredShipments = useMemo(() => (
    shipments.filter((s) =>
      s.shipmentNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.partner.toLowerCase().includes(searchQuery.toLowerCase())
    )
  ), [shipments, searchQuery]);

  const totalResults = filteredShipments.length;
  const hasShipments = totalResults > 0;
  const totalPages = hasShipments ? Math.max(1, Math.ceil(totalResults / itemsPerPage)) : 1;

  useEffect(() => {
    setCurrentPage((prev) => {
      if (!hasShipments) {
        return prev === 1 ? prev : 1;
      }

      const normalized = Math.min(Math.max(1, prev), totalPages);
      return normalized === prev ? prev : normalized;
    });
  }, [hasShipments, totalPages]);

  const safeCurrentPage = hasShipments ? Math.min(Math.max(currentPage, 1), totalPages) : 1;
  const startIndex = hasShipments ? (safeCurrentPage - 1) * itemsPerPage : 0;
  const paginatedShipments = hasShipments
    ? filteredShipments.slice(startIndex, startIndex + itemsPerPage)
    : [];
  const endIndex = hasShipments ? Math.min(startIndex + itemsPerPage, totalResults) : 0;
  const startDisplay = hasShipments ? startIndex + 1 : 0;

  return (
    <Card className="p-6" data-testid="card-shipments-table">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h2 className="text-2xl font-semibold">Embarques</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <Input
            type="search"
            placeholder="Buscar embarques..."
            className="w-64"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            data-testid="input-shipments-search"
          />
          <Button 
            variant="outline" 
            onClick={() => {
              onExport?.();
              console.log('Export CSV triggered');
            }}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Nº Embarque</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Embarque</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Chegada</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Parceiro</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Origem</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Destino</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Código HS</th>
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">TEUs</th>
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">Peso (kg)</th>
            </tr>
          </thead>
          <tbody>
            {hasShipments ? (
              paginatedShipments.map((shipment) => (
                <tr
                  key={shipment.id}
                  className="border-b hover-elevate"
                  data-testid={`row-shipment-${shipment.id}`}
                >
                  <td className="p-3 text-sm font-mono">{shipment.shipmentNo}</td>
                  <td className="p-3 text-sm font-mono">{shipment.ets}</td>
                  <td className="p-3 text-sm font-mono">{shipment.eta}</td>
                  <td className="p-3 text-sm">{shipment.partner}</td>
                  <td className="p-3 text-sm">{shipment.origin}</td>
                  <td className="p-3 text-sm">{shipment.destination}</td>
                  <td className="p-3 text-sm font-mono">{shipment.hsCode}</td>
                  <td className="p-3 text-sm font-mono text-right">{shipment.teus || 0}</td>
                  <td className="p-3 text-sm font-mono text-right">{shipment.weight?.toLocaleString() || '0'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-6 text-center text-sm text-muted-foreground" colSpan={9}>
                  Nenhum embarque encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-muted-foreground">
          Mostrando {startDisplay}-{endIndex} de {totalResults} embarques
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={!hasShipments || safeCurrentPage === 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm">
            Página {hasShipments ? safeCurrentPage : 0} de {hasShipments ? totalPages : 0}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={!hasShipments || safeCurrentPage === totalPages}
            data-testid="button-next-page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
