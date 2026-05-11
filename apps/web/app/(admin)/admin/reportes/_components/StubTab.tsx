import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function StubTab({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-dashed bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm font-medium">Próximamente</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Este reporte está planificado en el roadmap M7. La data necesaria ya está
            disponible en la DB.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
