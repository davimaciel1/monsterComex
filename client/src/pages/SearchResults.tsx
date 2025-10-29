import { Header } from "@/components/Header";
import { CompanyCard } from "@/components/CompanyCard";
import { useLocation } from "wouter";

export default function SearchResults() {
  const [, setLocation] = useLocation();
  
  const mockCompanies = [
    { id: 1, name: 'ACME Corporation', kind: 'importer' as const, countryCode: 'US', score: 0.95 },
    { id: 2, name: 'Global Exports Ltd', kind: 'exporter' as const, countryCode: 'BR', score: 0.87 },
    { id: 3, name: 'Maritime Trading Co', kind: 'importer' as const, countryCode: 'CN', score: 0.82 },
    { id: 4, name: 'Ocean Freight Inc', kind: 'exporter' as const, countryCode: 'DE', score: 0.78 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header compact onSearch={(q) => console.log('Search:', q)} />
      
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-search-results-title">
            Search Results
          </h1>
          <p className="text-muted-foreground" data-testid="text-results-count">
            Found {mockCompanies.length} companies
          </p>
        </div>

        <div className="space-y-4">
          {mockCompanies.map((company) => (
            <CompanyCard
              key={company.id}
              {...company}
              onClick={() => setLocation(`/company/${company.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
