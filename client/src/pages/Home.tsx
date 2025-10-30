import { useEffect } from "react";
import { Header } from "@/components/Header";
import { HeroSearch } from "@/components/HeroSearch";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation(`/login?redirect=${encodeURIComponent("/")}`);
    }
  }, [user, isLoading, setLocation]);

  const handleSearch = (query: string) => {
    console.log('Searching for:', query);
    setLocation(`/search?q=${encodeURIComponent(query)}`);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 py-12">
          <p className="text-muted-foreground">Preparando sua experiência personalizada...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSearch onSearch={handleSearch} />
    </div>
  );
}
