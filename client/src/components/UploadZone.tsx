import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useState } from "react";

interface UploadZoneProps {
  onFileSelect?: (file: File) => void;
}

export function UploadZone({ onFileSelect }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
      onFileSelect?.(file);
      console.log('File dropped:', file.name);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      onFileSelect?.(file);
      console.log('File selected:', file.name);
    }
  };

  return (
    <Card 
      className={`p-12 border-2 border-dashed transition-colors ${
        dragActive ? 'border-primary bg-accent' : 'border-border'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      data-testid="card-upload-zone"
    >
      <div className="flex flex-col items-center justify-center space-y-4 text-center">
        <div className="p-4 rounded-full bg-muted">
          <Upload className="h-8 w-8 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">
            {selectedFile ? selectedFile.name : 'Upload Excel or CSV File'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop your file here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Supported formats: .xlsx, .xls, .csv (max 50 MB)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild data-testid="button-browse-file">
            <label className="cursor-pointer">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Browse Files
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
              />
            </label>
          </Button>
          
          {selectedFile && (
            <Button 
              onClick={() => {
                console.log('Upload started:', selectedFile.name);
              }}
              data-testid="button-upload-file"
            >
              Upload File
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
