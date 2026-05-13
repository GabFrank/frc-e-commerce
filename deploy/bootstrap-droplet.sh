#!/usr/bin/env bash
# Bootstrap one-time del droplet para frc-e-commerce en producción.
# Idempotente: se puede correr varias veces sin daño.
#
# Uso:
#   sudo bash deploy/bootstrap-droplet.sh
#
# Pre-requisitos:
#   - Fedora con nginx, certbot, postgres 16 (puerto 5551) ya instalados.
#   - DNS app.frc-ecommerce.com → IP pública del droplet (propagado).
#   - Correr desde un clon del repo en el droplet (o tener los templates copiados).

set -euo pipefail

# ── Config (modificable vía env vars antes de invocar) ─────────────────────────
APP_USER="${APP_USER:-frc}"
APP_DIR="${APP_DIR:-/opt/frc-e-commerce}"
DOMAIN="${DOMAIN:-app.frc-ecommerce.com}"
LE_EMAIL="${LE_EMAIL:-frcsistemasinformaticos@gmail.com}"
PG_PORT="${PG_PORT:-5551}"
DB_NAME="${DB_NAME:-frc_ecommerce}"
DB_USER="${DB_USER:-frc_ecommerce}"
NODE_MAJOR="${NODE_MAJOR:-20}"

# Directorio que contiene este script (asumimos repo clonado o copiado)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Helpers ────────────────────────────────────────────────────────────────────
log() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m  ⚠ %s\033[0m\n' "$*"; }
err() { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    err "Este script debe correrse como root (usá sudo)."
    exit 1
  fi
}

# ── 1. Node.js 20 ──────────────────────────────────────────────────────────────
install_node() {
  log "Verificando Node.js ${NODE_MAJOR}"
  if command -v node >/dev/null 2>&1; then
    local current
    current="$(node -v | sed 's/v//' | cut -d. -f1)"
    if [[ "$current" == "$NODE_MAJOR" ]]; then
      ok "Node ${NODE_MAJOR} ya instalado ($(node -v))"
      return
    fi
    warn "Hay otra versión de Node ($(node -v)). Voy a instalar la ${NODE_MAJOR}."
  fi

  log "Instalando Node ${NODE_MAJOR} desde NodeSource"
  curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  dnf install -y nodejs
  ok "Node $(node -v) instalado"
}

# ── 2. System user ─────────────────────────────────────────────────────────────
create_user() {
  log "Creando system user '${APP_USER}'"
  if id -u "$APP_USER" >/dev/null 2>&1; then
    ok "User ${APP_USER} ya existe"
  else
    useradd --system --shell /bin/bash --home-dir "$APP_DIR" --create-home "$APP_USER"
    ok "User ${APP_USER} creado"
  fi
}

# ── 3. Estructura de directorios ───────────────────────────────────────────────
create_dirs() {
  log "Estructura de directorios en ${APP_DIR}"
  mkdir -p "$APP_DIR"/{releases,shared}
  # 'current' es un symlink que se actualiza en cada deploy. Si no existe aún, lo dejamos sin crear.
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  chmod 750 "$APP_DIR"
  ok "Estructura OK: releases/, shared/, current → (pendiente)"
}

# ── 4. SSH key del deploy user ─────────────────────────────────────────────────
setup_ssh() {
  log "SSH para deploy remoto"
  local ssh_dir="$APP_DIR/.ssh"
  mkdir -p "$ssh_dir"
  touch "$ssh_dir/authorized_keys"
  chmod 700 "$ssh_dir"
  chmod 600 "$ssh_dir/authorized_keys"
  chown -R "$APP_USER:$APP_USER" "$ssh_dir"

  if [[ ! -s "$ssh_dir/authorized_keys" ]]; then
    warn "El authorized_keys de ${APP_USER} está vacío."
    warn "Pegá la clave PÚBLICA de deploy (ed25519) cuando termine este script en:"
    warn "  ${ssh_dir}/authorized_keys"
  else
    ok "authorized_keys ya tiene contenido"
  fi
}

# ── 5. Postgres: role + DB ─────────────────────────────────────────────────────
setup_db() {
  log "Creando role y DB en postgres :${PG_PORT}"

  # Verificar conectividad
  if ! sudo -u postgres psql -p "$PG_PORT" -c '\q' >/dev/null 2>&1; then
    err "No puedo conectar a postgres en puerto ${PG_PORT} como user postgres."
    err "Verificá que el cluster esté corriendo: ps aux | grep '[p]ostgres.*${PG_PORT}'"
    exit 1
  fi

  local role_exists
  role_exists=$(sudo -u postgres psql -p "$PG_PORT" -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")

  local db_password_file="$APP_DIR/shared/.db-password"
  local db_password

  if [[ "$role_exists" == "1" ]]; then
    ok "Role ${DB_USER} ya existe — no se cambia el password"
    if [[ -f "$db_password_file" ]]; then
      db_password=$(cat "$db_password_file")
    else
      warn "No encuentro el archivo con el password. Vas a tener que regenerarlo manualmente"
      db_password="<DESCONOCIDO>"
    fi
  else
    db_password=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
    sudo -u postgres psql -p "$PG_PORT" -c \
      "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${db_password}';" >/dev/null
    echo -n "$db_password" > "$db_password_file"
    chown "$APP_USER:$APP_USER" "$db_password_file"
    chmod 600 "$db_password_file"
    ok "Role ${DB_USER} creado. Password guardado en ${db_password_file}"
  fi

  local db_exists
  db_exists=$(sudo -u postgres psql -p "$PG_PORT" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")
  if [[ "$db_exists" == "1" ]]; then
    ok "DB ${DB_NAME} ya existe"
  else
    sudo -u postgres psql -p "$PG_PORT" -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null
    ok "DB ${DB_NAME} creada"
  fi

  # Exporto para que setup_env la use
  export DB_PASSWORD_FOR_ENV="$db_password"
}

# ── 6. .env esqueleto ──────────────────────────────────────────────────────────
setup_env() {
  log "Archivo .env en ${APP_DIR}/shared/.env"
  local env_file="$APP_DIR/shared/.env"
  if [[ -f "$env_file" ]]; then
    ok ".env ya existe — no se sobreescribe"
    return
  fi
  if [[ ! -f "$SCRIPT_DIR/env.example" ]]; then
    err "No encuentro deploy/env.example en ${SCRIPT_DIR}/env.example"
    exit 1
  fi
  cp "$SCRIPT_DIR/env.example" "$env_file"

  # Reemplazar DB_PASSWORD si lo tenemos
  if [[ -n "${DB_PASSWORD_FOR_ENV:-}" ]]; then
    sed -i "s|<DB_PASSWORD>|${DB_PASSWORD_FOR_ENV}|" "$env_file"
  fi
  # Generar BETTER_AUTH_SECRET
  local auth_secret
  auth_secret=$(openssl rand -base64 32)
  sed -i "s|<GENERAR_32_CHARS_RANDOM>|${auth_secret}|" "$env_file"

  chown "$APP_USER:$APP_USER" "$env_file"
  chmod 600 "$env_file"
  ok ".env creado con DB_URL y BETTER_AUTH_SECRET ya rellenados"
  warn "Falta completar R2_* manualmente antes de iniciar el servicio:"
  warn "  sudo -u ${APP_USER} \$EDITOR ${env_file}"
}

# ── 7. systemd unit ────────────────────────────────────────────────────────────
setup_systemd() {
  log "Instalando systemd unit"
  local unit_src="$SCRIPT_DIR/frc-ecommerce.service"
  local unit_dst="/etc/systemd/system/frc-ecommerce.service"

  if [[ ! -f "$unit_src" ]]; then
    err "No encuentro deploy/frc-ecommerce.service en ${SCRIPT_DIR}/"
    exit 1
  fi
  cp "$unit_src" "$unit_dst"
  systemctl daemon-reload
  systemctl enable frc-ecommerce.service >/dev/null 2>&1 || true
  ok "Unit instalado y habilitado (NO se inicia hasta tener un release deployado)"
}

# ── 7b. sudoers: que el user pueda reiniciar el servicio desde el deploy ──────
setup_sudoers() {
  log "Configurando sudo NOPASSWD para systemctl (deploy workflow)"
  local sudoers_file="/etc/sudoers.d/frc-deploy"
  cat > "$sudoers_file" <<EOF
# Permitir al user ${APP_USER} controlar el servicio frc-ecommerce sin password.
# Esto lo usa el workflow de GitHub Actions para reiniciar después de un deploy.
${APP_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl restart frc-ecommerce.service, /usr/bin/systemctl reload frc-ecommerce.service, /usr/bin/systemctl status frc-ecommerce.service, /usr/bin/systemctl is-active frc-ecommerce.service, /usr/bin/systemctl start frc-ecommerce.service
EOF
  chmod 440 "$sudoers_file"
  if ! visudo -c -f "$sudoers_file" >/dev/null; then
    err "Sudoers inválido en ${sudoers_file}"
    rm -f "$sudoers_file"
    exit 1
  fi
  ok "Sudoers OK (${sudoers_file})"
}

# ── 8. Nginx server block + cert ───────────────────────────────────────────────
setup_nginx() {
  log "Instalando nginx server block"
  local nginx_src="$SCRIPT_DIR/frc-ecommerce.nginx.conf"
  local nginx_dst="/etc/nginx/conf.d/frc-ecommerce.conf"

  if [[ ! -f "$nginx_src" ]]; then
    err "No encuentro deploy/frc-ecommerce.nginx.conf en ${SCRIPT_DIR}/"
    exit 1
  fi
  cp "$nginx_src" "$nginx_dst"
  mkdir -p /var/www/certbot

  if ! nginx -t; then
    err "nginx -t falló. Revisá ${nginx_dst}"
    exit 1
  fi
  systemctl reload nginx
  ok "nginx config válido y recargado"

  # SELinux: permitir nginx → 127.0.0.1:3000
  if command -v setsebool >/dev/null 2>&1; then
    setsebool -P httpd_can_network_connect 1 || warn "No pude setear httpd_can_network_connect"
    ok "SELinux: httpd_can_network_connect = on"
  fi

  log "Obteniendo certificado Let's Encrypt para ${DOMAIN}"
  if certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    ok "Cert para ${DOMAIN} ya existe — se renueva automáticamente"
  else
    certbot --nginx \
      -d "$DOMAIN" \
      --non-interactive --agree-tos \
      --email "$LE_EMAIL" \
      --redirect
    ok "Cert obtenido y redirect 80→443 configurado"
  fi
}

# ── 9. Resumen final ───────────────────────────────────────────────────────────
print_summary() {
  cat <<EOF

================================================================================
  Bootstrap completado.
================================================================================

  Próximos pasos manuales:

  1. Pegar la clave PÚBLICA de deploy en:
     ${APP_DIR}/.ssh/authorized_keys

  2. Editar el .env y completar R2_* + cualquier otra variable pendiente:
     sudo -u ${APP_USER} \$EDITOR ${APP_DIR}/shared/.env

  3. Aplicar el schema de la DB la PRIMERA VEZ (desde tu máquina local):
     DATABASE_URL="postgres://${DB_USER}:<PASSWORD>@${DOMAIN%%.*}.frc-ecommerce.com:5551/${DB_NAME}" \\
       pnpm --filter @frc-e-commerce/web db:push
     (o desde el droplet con DATABASE_URL apuntando a 127.0.0.1:${PG_PORT})

     El password de DB está en: ${APP_DIR}/shared/.db-password

  4. Disparar el primer deploy desde GitHub Actions:
     Repo → Actions → Deploy → Run workflow

  5. Verificar:
     curl -i https://${DOMAIN}/api/health

  Comandos útiles:
    sudo systemctl status frc-ecommerce
    sudo journalctl -u frc-ecommerce -f
    sudo systemctl restart frc-ecommerce
================================================================================

EOF
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  require_root
  log "Bootstrap droplet para ${DOMAIN}"
  install_node
  create_user
  create_dirs
  setup_ssh
  setup_db
  setup_env
  setup_systemd
  setup_sudoers
  setup_nginx
  print_summary
}

main "$@"
