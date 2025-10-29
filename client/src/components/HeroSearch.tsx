import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface HeroSearchProps {
  onSearch?: (query: string) => void;
}

export function HeroSearch({ onSearch }: HeroSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch?.(searchQuery);
      console.log('Search triggered:', searchQuery);
    }
  };

  return (
    <div className="py-20 md:py-32 px-4">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold" data-testid="text-hero-title">
            Encontre Qualquer Importador ou Exportador
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-hero-subtitle">
            Busque dados de comércio marítimo instantaneamente
          </p>
        </div>

        <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
          <div className="relative">
            <Input
              type="search"
              placeholder="Busque por qualquer importador ou exportador..."
              className="h-14 text-base pr-14 rounded-full border-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-hero-search"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-1 top-1 h-12 w-12 rounded-full bg-cyan-500 hover:bg-cyan-600" 
              data-testid="button-hero-search"
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </form>

        <Button variant="ghost" size="sm" data-testid="button-random-company">
          Experimente uma empresa aleatória
        </Button>
      </div>
    </div>
  );
}
