import { Search, Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface HeaderProps {
  onSearch?: (query: string) => void;
  compact?: boolean;
}

export function Header({ onSearch, compact = false }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch?.(searchQuery);
      console.log('Search triggered:', searchQuery);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-2">
            <Anchor className="h-6 w-6 text-primary" data-testid="logo-icon" />
            <span className="text-xl font-bold" data-testid="text-app-name">Trade Radar</span>
          </div>

          {compact && (
            <form onSubmit={handleSearch} className="flex-1 max-w-xl">
              <div className="relative">
                <Input
                  type="search"
                  placeholder="Busque por qualquer importador ou exportador..."
                  className="pr-10 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="ghost"
                  className="absolute right-0 top-0"
                  data-testid="button-search"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" data-testid="button-login">
              Entrar
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
