import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

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

  const filteredShipments = shipments.filter(s => 
    s.shipmentNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.partner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredShipments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedShipments = filteredShipments.slice(startIndex, startIndex + itemsPerPage);

  return (
    <Card className="p-6" data-testid="card-shipments-table">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h2 className="text-2xl font-semibold">Shipments</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <Input
            type="search"
            placeholder="Search shipments..."
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
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Shipment No</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">ETS</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">ETA</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Partner</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Origin</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Destination</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">HS Code</th>
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">TEUs</th>
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">Weight (kg)</th>
            </tr>
          </thead>
          <tbody>
            {paginatedShipments.map((shipment, index) => (
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
                <td className="p-3 text-sm font-mono text-right">{shipment.teus}</td>
                <td className="p-3 text-sm font-mono text-right">{shipment.weight.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredShipments.length)} of {filteredShipments.length} shipments
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            data-testid="button-next-page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
