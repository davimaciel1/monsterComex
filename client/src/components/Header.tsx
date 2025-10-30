import { Search, Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useState } from "react";

interface HeaderProps {
  onSearch?: (query: string) => void;
  compact?: boolean;
}

export function Header({ onSearch, compact = false }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { user, logout, logoutStatus } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch?.(searchQuery);
      console.log('Search triggered:', searchQuery);
    }
  };

  const handleLoginClick = () => {
    const currentPath = window.location.pathname + window.location.search;
    setLocation(`/login?redirect=${encodeURIComponent(currentPath)}`);
  };

  const handlePlanClick = () => {
    setLocation("/planos");
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Você saiu da sua conta",
        description: "Entre novamente quando quiser continuar as consultas.",
      });
      setLocation("/login");
    } catch (error: any) {
      toast({
        title: "Não foi possível sair",
        description: error?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {compact && (
            <form onSubmit={handleSearch} className="flex-1 max-w-xl">
              <div className="relative">
                <Input
                  type="search"
                  placeholder="Busque por qualquer importador, exportador ou NCM..."
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
            {user ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handlePlanClick} data-testid="button-planos">
                  Meu Plano
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={logoutStatus === "pending"}
                  data-testid="button-logout"
                >
                  Sair
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleLoginClick} data-testid="button-login">
                Entrar
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
