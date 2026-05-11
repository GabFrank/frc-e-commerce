import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function KpiCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description?: string;
  tone?: 'default' | 'positive' | 'negative' | 'muted';
}) {
  const valueClass =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-destructive'
        : tone === 'muted'
          ? 'text-muted-foreground'
          : '';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={`text-2xl font-mono ${valueClass}`}>{value}</CardTitle>
      </CardHeader>
      {description && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      )}
    </Card>
  );
}
