import { Header } from "@/components/Header";
import { HeroSearch } from "@/components/HeroSearch";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();

  const handleSearch = (query: string) => {
    console.log('Searching for:', query);
    setLocation(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSearch onSearch={handleSearch} />
    </div>
  );
}
