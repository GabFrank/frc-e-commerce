# theme-manager

## Scope

Lee custom fields del Channel (definidos por `tenant-management`) y los expone como query GraphQL `activeChannelTheme` para que el storefront inyecte CSS variables.

## GraphQL

```graphql
type ChannelTheme {
  channelToken: String!
  name: String!
  slogan: String
  logoUrl: String
  primaryColor: String!
  secondaryColor: String!
  accentColor: String!
}

extend type Query {
  activeChannelTheme: ChannelTheme!
}
```

## Storefront integration

```ts
// app/layout.tsx server component
const theme = await fetchTheme();
return (
  <html style={{ '--color-primary': theme.primaryColor, ... }}>
    ...
  </html>
);
```

Tailwind `tailwind.config.ts` usa esos CSS vars: `colors: { primary: 'var(--color-primary)' }`.

## Dependencias

- `tenant-management` (define los custom fields).
