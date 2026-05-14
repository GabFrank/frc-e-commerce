# Deploy

Procedimiento de deploy a producción para `frc-e-commerce`.

## TL;DR — Deploy de una nueva versión

```
Repo en GitHub → Actions → Deploy to production → Run workflow
  Branch del workflow: master (o la branch que tenga el deploy.yml actualizado)
  Input "Branch o tag a deployar": master (o tag estable v1.2.3)
```

El workflow buildea en CI, rsync al droplet, swap atómico, restart systemd, healthcheck. Sin tocar el droplet manualmente.

## Estado actual de producción

| Componente | Valor |
|---|---|
| Droplet | DigitalOcean Fedora 39, IP pública `159.203.86.103` |
| Dominio | `app.frc-ecommerce.com` (A record) + `*.frc-ecommerce.com` (A wildcard) |
| TLS | Let's Encrypt wildcard (`*.frc-ecommerce.com` + apex), DNS-01 vía Cloudflare API |
| Reverse proxy | Nginx (server block en `/etc/nginx/conf.d/frc-ecommerce.conf`) |
| App | Next.js 16 standalone, systemd unit `frc-ecommerce.service`, puerto 3000 (loopback) |
| Process owner | system user `frc` (home `/opt/frc-e-commerce`) |
| DB | Postgres 16 local, puerto **5551**, DB `frc_ecommerce`, owner `frc_ecommerce` |
| Releases | `/opt/frc-e-commerce/releases/<timestamp-sha>/` + symlink `current` → último |
| Env file compartido | `/opt/frc-e-commerce/shared/.env` (0600, owner `frc`) |
| Password DB | `/opt/frc-e-commerce/shared/.db-password` |

⚠️ El droplet hostea **otras apps productivas** (3 Java services bajo user `deploy`). No se tocan.

## Variables de entorno críticas

En `/opt/frc-e-commerce/shared/.env`:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a postgres local (puerto 5551) |
| `BETTER_AUTH_SECRET` | Firma de sesiones (autogenerado por bootstrap) |
| `BETTER_AUTH_URL` | URL canónica de la app |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Lista separada por coma. Acepta wildcards (ej. `https://*.frc-ecommerce.com`) |
| `AUTH_COOKIE_DOMAIN` | `.frc-ecommerce.com` — habilita cookies cross-subdomain (sesión persiste entre tenants) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `frc-ecommerce.com` — usado por `enterTenantAsMember` para redirect cross-subdomain |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Cloudflare R2 (storage de imágenes) |
| `R2_PUBLIC_URL` | URL pública de assets (custom domain configurado en R2) |

Después de cambiar el `.env`, restart manual:

```bash
sudo systemctl restart frc-ecommerce.service
```

El template está en [`deploy/env.example`](../deploy/env.example).

## Deploy de actualizaciones (workflow normal)

1. Mergear cambios a `master` (vía PR develop → release/beta → master).
2. `Repo → Actions → Deploy to production → Run workflow`.
3. Branch del workflow: `master`. Input `ref`: vacío (default) o un tag específico.
4. Click **Run workflow**.
5. Esperar ~3 min. El run pasa por: Build → Package → Setup SSH → Upload bundle → Atomic swap + restart → Wait for service → Healthcheck público → Mark GitHub deployment.
6. Si falla en "Wait for service" o "Healthcheck público" pero el "Atomic swap + restart" pasó verde, el código nuevo ya está en producción (el step posterior es solo verificación). Probar manualmente `curl https://frc.frc-ecommerce.com/api/health`.

## Rollback rápido

Si un deploy rompió algo, podés volver al release anterior sin redeploy:

```bash
ssh gabfrank@159.203.86.103
ls /opt/frc-e-commerce/releases/
sudo ln -sfn /opt/frc-e-commerce/releases/<release-anterior> /opt/frc-e-commerce/current
sudo systemctl restart frc-ecommerce.service
```

El workflow mantiene los **últimos 5 releases**, así que podés moverte entre ellos. Para un rollback "limpio" desde CI, disparar el workflow apuntando a un tag anterior (ej. `v1.0.0-alpha.1`).

## Logs

```bash
# Logs del servicio en tiempo real
sudo journalctl -u frc-ecommerce.service -f

# Últimas 100 líneas
sudo journalctl -u frc-ecommerce.service -n 100 --no-pager

# Logs de nginx
sudo tail -f /var/log/nginx/frc-ecommerce-access.log
sudo tail -f /var/log/nginx/frc-ecommerce-error.log
```

## Bootstrap one-time (nuevo droplet desde cero)

Si en el futuro se monta otro droplet:

1. **Prerequisitos**: Fedora 39+, nginx, certbot, postgres 16 (puerto custom OK), apertura de puertos 80/443 en firewall.
2. **DNS**: A record `app.<dominio>` + A wildcard `*.<dominio>` apuntando al droplet, **DNS-only** (sin proxy de Cloudflare).
3. **Token de Cloudflare** con permiso "Edit zone DNS" sobre el dominio.
4. **Clonar el repo** en el droplet:
   ```bash
   sudo dnf install -y git
   git clone --depth 1 -b master https://github.com/GabFrank/frc-e-commerce.git ~/rd
   ```
5. **Token CF al droplet** (sin pasar por shell history):
   ```bash
   read -srp "CF token: " T && echo
   sudo mkdir -p /etc/letsencrypt
   echo "dns_cloudflare_api_token = $T" | sudo tee /etc/letsencrypt/cloudflare.ini > /dev/null
   sudo chmod 600 /etc/letsencrypt/cloudflare.ini
   unset T
   ```
6. **Bootstrap script** (idempotente — instala Node 20, crea user `frc`, DB+role, systemd unit, nginx server block, cert HTTP-01 de `app.`):
   ```bash
   sudo bash ~/rd/deploy/bootstrap-droplet.sh
   ```
7. **Cert wildcard con DNS-01**:
   ```bash
   sudo dnf install -y python3-certbot-dns-cloudflare
   sudo certbot certonly --dns-cloudflare \
     --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
     --dns-cloudflare-propagation-seconds 30 \
     -d "<dominio>" -d "*.<dominio>" \
     --non-interactive --agree-tos --email <email>
   ```
8. **Reemplazar nginx server block** para usar el cert wildcard (`server_name <dominio> *.<dominio>`). Ver el archivo final en producción como referencia.
9. **Pegar la pubkey de GitHub Actions** en `/opt/frc-e-commerce/.ssh/authorized_keys` (clave generada con `ssh-keygen -t ed25519`).
10. **Editar `/opt/frc-e-commerce/shared/.env`** con las credenciales R2, `BETTER_AUTH_URL`, `AUTH_COOKIE_DOMAIN`, `NEXT_PUBLIC_ROOT_DOMAIN`, `BETTER_AUTH_TRUSTED_ORIGINS`.
11. **Schema DB**: correr `pnpm --filter @frc-e-commerce/web db:push` apuntando a la DB de prod (puede ser via SSH tunnel o desde el droplet).
12. **Seed**: correr `pnpm --filter @frc-e-commerce/web seed` con env vars:
    ```bash
    SEED_SUPER_EMAIL=...@... SEED_SUPER_PASSWORD=... \
    SEED_TENANT_SLUG=frc SEED_TENANT_NAME=FRC \
    pnpm --filter @frc-e-commerce/web seed
    ```
13. **Configurar secrets en GitHub** (Environment `production`):
    - `DROPLET_HOST`
    - `DROPLET_USER` (= `frc`)
    - `DROPLET_SSH_KEY` (la privada del par generado)
14. **Primer deploy** desde GitHub Actions.

## Renovación de certificado

Let's Encrypt renueva automáticamente vía `certbot.timer` (systemd timer). El cert wildcard usa DNS-01 con el token de CF en `/etc/letsencrypt/cloudflare.ini` (renovaciones no requieren interacción).

Verificar:

```bash
sudo systemctl status certbot-renew.timer
sudo certbot certificates
```

Si querés forzar renovación:

```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

## Crear un nuevo tenant

Desde la UI (recomendado):

1. Login como superadmin → `/super/tenants/new`.
2. Escribir nombre — el slug se auto-rellena con `slugify()`.
3. Crear.
4. El subdominio `<slug>.frc-ecommerce.com` queda activo de inmediato (el wildcard DNS + cert cubren todos los subdominios).
5. Asignar miembros desde `/super/tenants/<id>`.

Desde DB directo: `INSERT INTO tenant ...` + `INSERT INTO tenant_currency ...` + `INSERT INTO pos_config ...` + `INSERT INTO tenant_member ...`. Mejor evitar.

## Backup de DB

⚠️ **TODO**: agregar cron diario con `pg_dump` + upload a R2. Pendiente para una iteración futura.

Manual:

```bash
sudo -u postgres pg_dump -p 5551 -d frc_ecommerce -Fc -f /tmp/frc-ecommerce.dump
# después subirlo a algún lado seguro
```

## Sudoers (qué puede hacer el user `frc` con sudo)

El bootstrap configura `/etc/sudoers.d/frc-deploy` con:

```
frc ALL=(root) NOPASSWD: /usr/bin/systemctl restart frc-ecommerce.service,
                         /usr/bin/systemctl reload  frc-ecommerce.service,
                         /usr/bin/systemctl status  frc-ecommerce.service,
                         /usr/bin/systemctl is-active frc-ecommerce.service,
                         /usr/bin/systemctl start   frc-ecommerce.service
```

⚠️ Los argumentos son **exactos**: agregar un flag (ej. `--quiet`) hace que sudo pida password y rompa el workflow.

## Troubleshooting

**Workflow falla en "Wait for service to be ready"** → ver logs `journalctl -u frc-ecommerce.service`. Causas comunes:
- `.env` con variable rota (URL malformada, password con caracteres especiales sin escapar).
- Postgres no responde en el puerto esperado.
- Healthcheck `/api/health` tarda más que los 90s del timeout (build pesado).

**Healthcheck público falla con CORS** → revisar `BETTER_AUTH_TRUSTED_ORIGINS` en `.env`. Debe incluir el dominio del subdominio del tenant.

**Loop login ↔ /mis-tiendas** → verificar `AUTH_COOKIE_DOMAIN=.frc-ecommerce.com` y `NEXT_PUBLIC_ROOT_DOMAIN=frc-ecommerce.com` en `.env`. Reiniciar servicio después de cambiar.

**"Entrar a [tenant]" no cambia de subdominio** → `NEXT_PUBLIC_ROOT_DOMAIN` no está seteado en build time. Recordá que `NEXT_PUBLIC_*` se compila al bundle — necesita estar disponible al `pnpm build` del workflow. Si lo agregaste recién, **re-deployar** para que entre.

**Cert expirado o por expirar** → `sudo certbot renew --force-renewal && sudo systemctl reload nginx`.

**El user de GitHub Actions no puede SSHear** → revisar:
1. `frc` está en `AllowUsers` de `/etc/ssh/sshd_config`.
2. La pubkey de GitHub está en `/opt/frc-e-commerce/.ssh/authorized_keys` con permisos `600`.
3. `/opt/frc-e-commerce/.ssh/` con permisos `700`, owner `frc:frc`.
4. SELinux contexto correcto: `sudo restorecon -R /opt/frc-e-commerce/.ssh/`.

## Archivos relevantes en este repo

- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — pipeline CI/CD.
- [`deploy/bootstrap-droplet.sh`](../deploy/bootstrap-droplet.sh) — script one-time del droplet.
- [`deploy/frc-ecommerce.service`](../deploy/frc-ecommerce.service) — systemd unit template.
- [`deploy/frc-ecommerce.nginx.conf`](../deploy/frc-ecommerce.nginx.conf) — nginx server block template (HTTP only; certbot lo amplía).
- [`deploy/env.example`](../deploy/env.example) — variables de entorno requeridas.
- [`apps/web/next.config.ts`](../apps/web/next.config.ts) — `output: 'standalone'` para builds compactos.
- [`apps/web/scripts/seed.ts`](../apps/web/scripts/seed.ts) — seed idempotente configurable vía env.
