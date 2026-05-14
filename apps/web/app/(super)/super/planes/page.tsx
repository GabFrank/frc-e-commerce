import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const PLANS = [
  {
    code: 'free',
    name: 'Free',
    price: 0,
    description: 'Para empezar — sin compromiso',
    features: [
      'Hasta 50 productos',
      'Hasta 100 órdenes/mes',
      'Subdominio frc-ecommerce.com',
      'Pagos manuales',
      'Soporte por email',
    ],
  },
  {
    code: 'starter',
    name: 'Starter',
    price: 49000,
    description: 'Para tiendas en crecimiento',
    features: [
      'Hasta 500 productos',
      'Órdenes ilimitadas',
      'Subdominio + dominio custom',
      'Stripe + Bancard',
      'Reportes avanzados',
    ],
  },
  {
    code: 'pro',
    name: 'Pro',
    price: 149000,
    description: 'Multi-bodega y POS avanzado',
    features: [
      'Productos ilimitados',
      'Multi-bodega',
      'POS offline',
      'API pública',
      'Soporte prioritario',
    ],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price: null,
    description: 'A medida — contactanos',
    features: [
      'Todo lo de Pro',
      'White label',
      'SLA garantizado',
      'Onboarding dedicado',
      'Integraciones a medida',
    ],
  },
];

export default function PlanesPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Planes</h1>
        <p className="text-sm text-muted-foreground">
          Vista informativa. Edición de planes y billing llegan post-MVP (Stripe Billing).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLANS.map((plan) => (
          <Card key={plan.code}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-bold">
                {plan.price === null
                  ? 'A medida'
                  : plan.price === 0
                    ? 'Gratis'
                    : `Gs. ${plan.price.toLocaleString('es-PY')}/mes`}
              </p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {plan.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
