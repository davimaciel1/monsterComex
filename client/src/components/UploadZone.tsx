import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useState } from "react";

interface UploadZoneProps {
  onFileSelect?: (file: File, companyName: string, companyKind: 'importer' | 'exporter') => void;
}

export function UploadZone({ onFileSelect }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyKind, setCompanyKind] = useState<'importer' | 'exporter'>('importer');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      console.log('File dropped:', file.name);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      console.log('File selected:', file.name);
    }
  };

  const handleUpload = () => {
    if (selectedFile && companyName.trim()) {
      onFileSelect?.(selectedFile, companyName.trim(), companyKind);
      setSelectedFile(null);
      setCompanyName("");
    }
  };

  return (
    <Card className="p-8" data-testid="card-upload-zone">
      <div className="space-y-6">
        <div
          className={`p-12 border-2 border-dashed rounded-lg transition-colors ${
            dragActive ? 'border-primary bg-accent' : 'border-border'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="p-4 rounded-full bg-muted">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                {selectedFile ? selectedFile.name : 'Enviar Arquivo Excel ou CSV'}
              </h3>
              <p className="text-sm text-muted-foreground">
                Arraste e solte seu arquivo aqui, ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos suportados: .xlsx, .xls, .csv (máx 50 MB)
              </p>
            </div>

            <Button variant="outline" asChild data-testid="button-browse-file">
              <label className="cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Selecionar Arquivo
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInput}
                />
              </label>
            </Button>
          </div>
        </div>

        {selectedFile && (
          <div className="space-y-4 p-6 bg-muted rounded-lg">
            <h4 className="font-semibold">Informações da Empresa</h4>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-name">Nome da Empresa</Label>
                <Input
                  id="company-name"
                  placeholder="Ex: TRS IMPORTACAO E EXPORTACAO LTDA"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  data-testid="input-company-name"
                />
                <p className="text-xs text-muted-foreground">
                  Nome da empresa para a qual este arquivo contém dados
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-kind">Tipo de Empresa</Label>
                <Select value={companyKind} onValueChange={(value) => setCompanyKind(value as 'importer' | 'exporter')}>
                  <SelectTrigger id="company-kind" data-testid="select-company-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="importer">Importador</SelectItem>
                    <SelectItem value="exporter">Exportador</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A empresa é importadora ou exportadora?
                </p>
              </div>
            </div>

            <Button 
              onClick={handleUpload}
              disabled={!companyName.trim()}
              data-testid="button-upload-file"
              className="w-full"
            >
              Enviar Arquivo
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
