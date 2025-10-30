import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface NcmSummary {
  code: string;
  description: string | null;
  totalShipments: number;
  totalWeightKg: number;
  totalTeus: number;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export default function NcmProfile() {
  const [, params] = useRoute("/ncm/:code");
  const code = params?.code || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [user, isLoading, setLocation]);

  const ncmQuery = useQuery<NcmSummary>({
    queryKey: [`/api/ncm/${code}`],
    enabled: !!code && !!user,
  });

  useEffect(() => {
    if (ncmQuery.error) {
      const message = ncmQuery.error instanceof Error ? ncmQuery.error.message : "";
      if (message.startsWith("401")) {
        setLocation(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      } else if (message.startsWith("403")) {
        toast({
          title: "Plano insuficiente",
          description: "Você atingiu o limite contratado para consultar este NCM. Ajuste sua franquia em planos.",
          variant: "destructive",
        });
      }
    }
  }, [ncmQuery.error, setLocation, toast]);

  const statusMessage = ncmQuery.error instanceof Error ? ncmQuery.error.message : "";
  const hasPlanRestriction = statusMessage.startsWith("403");
  const notFound = statusMessage.startsWith("404");

  return (
    <div className="min-h-screen bg-background">
      <Header compact onSearch={(q) => setLocation(`/search?q=${encodeURIComponent(q)}`)} />
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-12 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Detalhes do NCM</h1>
          <p className="text-muted-foreground">
            Consulte o volume total de embarques e indicadores consolidados para o código informado.
          </p>
        </div>

        {ncmQuery.isLoading ? (
          <Card>
            <CardHeader>
              <CardTitle>Carregando...</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Buscando informações do NCM selecionado.</p>
            </CardContent>
          </Card>
        ) : hasPlanRestriction ? (
          <Card>
            <CardHeader>
              <CardTitle>Plano insuficiente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>O NCM "{code}" está além da sua franquia contratada.</p>
              <p>Ajuste a quantidade de NCMs em <button className="underline" onClick={() => setLocation("/planos")}>Planos</button> para continuar.</p>
            </CardContent>
          </Card>
        ) : notFound ? (
          <Card>
            <CardHeader>
              <CardTitle>NCM não encontrado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>Não localizamos o código "{code}" na base de dados atual.</p>
              <p>Entre em contato com nossa equipe ou ajuste seu plano para cadastrar novos dados.</p>
            </CardContent>
          </Card>
        ) : ncmQuery.data ? (
          <Card>
            <CardHeader>
              <CardTitle>{ncmQuery.data.code}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ncmQuery.data.description && (
                <p className="text-muted-foreground">{ncmQuery.data.description}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total de embarques</p>
                  <p className="text-2xl font-semibold">{formatNumber(ncmQuery.data.totalShipments)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Peso movimentado (kg)</p>
                  <p className="text-2xl font-semibold">{formatNumber(ncmQuery.data.totalWeightKg)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">TEUs estimados</p>
                  <p className="text-2xl font-semibold">{formatNumber(ncmQuery.data.totalTeus)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Selecione um NCM</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Informe um código NCM válido para visualizar os dados consolidados.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
