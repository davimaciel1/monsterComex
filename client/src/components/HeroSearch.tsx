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
          <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-hero-title">
            Find Any Importer or Exporter
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-hero-subtitle">
            Search maritime trade data instantly
          </p>
        </div>

        <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
          <div className="flex gap-2">
            <Input
              type="search"
              placeholder="Search for any importer or exporter..."
              className="h-12 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-hero-search"
            />
            <Button type="submit" size="lg" className="h-12" data-testid="button-hero-search">
              <Search className="h-5 w-5 mr-2" />
              Search
            </Button>
          </div>
        </form>

        <Button variant="ghost" size="sm" data-testid="button-random-company">
          Try a random company
        </Button>
      </div>
    </div>
  );
}
