import { HeroSearch } from '../HeroSearch';

export default function HeroSearchExample() {
  return (
    <div className="min-h-screen bg-background">
      <HeroSearch onSearch={(q) => console.log('Search:', q)} />
    </div>
  );
}
