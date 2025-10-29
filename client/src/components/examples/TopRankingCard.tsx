import { TopRankingCard } from '../TopRankingCard';

export default function TopRankingCardExample() {
  const mockPartners = [
    { name: 'ABC Trading Co', count: 245 },
    { name: 'Global Imports Ltd', count: 189 },
    { name: 'Ocean Freight Inc', count: 156 },
    { name: 'Maritime Solutions', count: 134 },
    { name: 'Trade Express LLC', count: 98 },
  ];

  return (
    <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <TopRankingCard title="Top Partners" items={mockPartners} />
      <TopRankingCard 
        title="Top Origin Countries" 
        items={[
          { name: 'China', count: 456 },
          { name: 'United States', count: 342 },
          { name: 'Brazil', count: 298 },
        ]} 
      />
      <TopRankingCard 
        title="Top Destination Ports" 
        items={[
          { name: 'Port of Los Angeles', count: 567 },
          { name: 'Port of Shanghai', count: 489 },
          { name: 'Port of Rotterdam', count: 412 },
        ]} 
      />
    </div>
  );
}
