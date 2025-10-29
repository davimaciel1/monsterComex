import { Card } from "@/components/ui/card";

interface RankingItem {
  name: string;
  count: number;
  percentage?: number;
}

interface TopRankingCardProps {
  title: string;
  items: RankingItem[];
}

export function TopRankingCard({ title, items }: TopRankingCardProps) {
  const maxCount = Math.max(...items.map(item => item.count));

  return (
    <Card className="p-6" data-testid={`card-ranking-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="space-y-1" data-testid={`ranking-item-${index}`}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate" data-testid={`text-ranking-name-${index}`}>
                {item.name}
              </span>
              <span className="text-muted-foreground ml-2 flex-shrink-0" data-testid={`text-ranking-count-${index}`}>
                {item.count.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
