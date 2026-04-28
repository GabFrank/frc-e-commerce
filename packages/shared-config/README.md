# @frc-e-commerce/shared-config

Configuración base reutilizable: TypeScript, ESLint, Prettier.

## Uso

`tsconfig.json` de cualquier app:

```json
{
  "extends": "@frc-e-commerce/shared-config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

`.eslintrc.cjs` de cualquier app:

```js
module.exports = {
  root: true,
  extends: [require.resolve('@frc-e-commerce/shared-config/eslint.base.cjs')],
};
```
