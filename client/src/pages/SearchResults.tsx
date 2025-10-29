import { Header } from "@/components/Header";
import { CompanyCard } from "@/components/CompanyCard";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface Company {
  id: number;
  name: string;
  kind: 'importer' | 'exporter';
  countryCode: string;
}

export default function SearchResults() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const query = searchParams.get('q') || '';
  
  const { data: results = [], isLoading } = useQuery<Array<{ company: Company; score: number }>>({
    queryKey: [`/api/companies/search?q=${encodeURIComponent(query)}`],
    enabled: !!query,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header compact onSearch={(q) => console.log('Search:', q)} />
      
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-search-results-title">
            Resultados da Busca
          </h1>
          {isLoading ? (
            <p className="text-muted-foreground">Buscando...</p>
          ) : (
            <p className="text-muted-foreground" data-testid="text-results-count">
              {results.length} empresas encontradas
            </p>
          )}
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando resultados...
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma empresa encontrada para "{query}"
            </div>
          ) : (
            results.map(({ company, score }) => (
              <CompanyCard
                key={company.id}
                {...company}
                score={score}
                onClick={() => setLocation(`/company/${company.id}`)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
