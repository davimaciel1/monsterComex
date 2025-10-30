import { Header } from "@/components/Header";
import { UploadZone } from "@/components/UploadZone";
import { IngestionHistoryTable } from "@/components/IngestionHistoryTable";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminUpload() {
  const { toast } = useToast();

  const { data: ingestionsData, isLoading } = useQuery<{ ingestions: any[]; total: number }>({
    queryKey: ['/api/ingestions'],
    refetchInterval: 3000, // Poll every 3 seconds for status updates
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload falhou');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingestions'] });
      toast({
        title: "Arquivo enviado",
        description: `Ingestão #${data.id} criada e processando em segundo plano`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const ingestions = ingestionsData?.ingestions || [];

  return (
    <div className="min-h-screen bg-background">
      <Header compact onSearch={(q) => console.log('Search:', q)} />
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 space-y-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-admin-title">
              Administração
            </h1>
            <Badge variant="default" data-testid="badge-admin-role">ADMIN</Badge>
          </div>
          <p className="text-muted-foreground" data-testid="text-admin-description">
            Envie e gerencie arquivos Excel/CSV para ingestão de dados de comércio marítimo
          </p>
        </div>

        <UploadZone onFileSelect={(file) => uploadMutation.mutate(file)} />

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando histórico...
          </div>
        ) : (
          <IngestionHistoryTable 
            ingestions={ingestions}
            onViewErrors={(id) => console.log('View errors:', id)}
            onReprocess={(id) => console.log('Reprocess:', id)}
            onCancel={(id) => console.log('Cancel:', id)}
          />
        )}
      </div>
    </div>
  );
}
