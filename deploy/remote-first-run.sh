#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APP_NAME="${APP_NAME:-sub2api}"
REPO_URL="${REPO_URL:-https://github.com/AMtanks/sub2api_purecodex.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/sub2api_purecodex}"
PRIMARY_DOMAIN="${PRIMARY_DOMAIN:-}"
EXTRA_SERVER_NAMES="${EXTRA_SERVER_NAMES:-}"
SERVER_NAMES=""

SUB2API_BIND_HOST="${SUB2API_BIND_HOST:-127.0.0.1}"
SUB2API_SERVER_PORT="${SUB2API_SERVER_PORT:-8080}"
SUB2API_ADMIN_EMAIL="${SUB2API_ADMIN_EMAIL:-}"
SUB2API_ADMIN_PASSWORD="${SUB2API_ADMIN_PASSWORD:-}"

TAILSCALE_HOSTNAME="${TAILSCALE_HOSTNAME:-$(hostname)}"
TAILSCALE_AUTHKEY="${TAILSCALE_AUTHKEY:-}"
SKIP_TAILSCALE="${SKIP_TAILSCALE:-false}"

ENV_FILE=""
ENV_EXAMPLE=""
CERT_SOURCE_DIR=""
CERT_TARGET_DIR="/etc/nginx/cloudflare-origin"
CERT_SOURCE_CRT=""
CERT_SOURCE_KEY=""
CERT_TARGET_CRT=""
CERT_TARGET_KEY=""
HTTPS_READY="false"
GENERATED_ADMIN_PASSWORD=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

success() {
  echo -e "${GREEN}[OK]${NC} $*"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

error() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    error "Please run this script as root."
    exit 1
  fi
}

require_ubuntu() {
  if [[ ! -f /etc/os-release ]]; then
    error "/etc/os-release not found."
    exit 1
  fi

  # shellcheck disable=SC1091
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    error "This script currently supports Ubuntu only."
    exit 1
  fi
}

require_domain() {
  if [[ -z "${PRIMARY_DOMAIN}" ]]; then
    error "PRIMARY_DOMAIN is required. Example: PRIMARY_DOMAIN=purecodex.asia"
    exit 1
  fi

  SERVER_NAMES="${PRIMARY_DOMAIN}"
  if [[ -n "${EXTRA_SERVER_NAMES}" ]]; then
    SERVER_NAMES="${SERVER_NAMES} ${EXTRA_SERVER_NAMES}"
  fi
}

install_apt_packages() {
  local compose_package=""

  if apt-cache show docker-compose-plugin >/dev/null 2>&1; then
    compose_package="docker-compose-plugin"
  elif apt-cache show docker-compose-v2 >/dev/null 2>&1; then
    compose_package="docker-compose-v2"
  fi

  info "Installing system packages..."
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates \
    curl \
    git \
    jq \
    nginx \
    openssl \
    docker.io

  if [[ -n "${compose_package}" ]]; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y "${compose_package}"
  fi

  systemctl enable --now docker
  systemctl enable --now nginx

  if ! docker compose version >/dev/null 2>&1; then
    error "docker compose plugin is not available after package installation."
    exit 1
  fi

  success "Docker and Nginx are installed."
}

install_tailscale() {
  if [[ "${SKIP_TAILSCALE}" == "true" ]]; then
    warn "Skipping Tailscale because SKIP_TAILSCALE=true."
    return
  fi

  if ! command -v tailscale >/dev/null 2>&1; then
    info "Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
  else
    info "Tailscale is already installed."
  fi

  systemctl enable --now tailscaled

  if [[ -n "${TAILSCALE_AUTHKEY}" ]]; then
    info "Bringing up Tailscale with auth key..."
    tailscale up --ssh --hostname="${TAILSCALE_HOSTNAME}" --authkey="${TAILSCALE_AUTHKEY}"
  else
    info "Bringing up Tailscale interactively..."
    tailscale up --ssh --hostname="${TAILSCALE_HOSTNAME}"
  fi

  success "Tailscale setup step finished."
}

prepare_install_root() {
  mkdir -p "${INSTALL_ROOT}"
  chown root:root "${INSTALL_ROOT}"
}

clone_or_update_repo() {
  if [[ ! -d "${INSTALL_ROOT}/.git" ]]; then
    info "Cloning repository into ${INSTALL_ROOT}..."
    rm -rf "${INSTALL_ROOT}"
    git clone --branch "${REPO_BRANCH}" "${REPO_URL}" "${INSTALL_ROOT}"
  else
    info "Updating existing repository at ${INSTALL_ROOT}..."
    git -C "${INSTALL_ROOT}" fetch origin "${REPO_BRANCH}" --depth=1
    git -C "${INSTALL_ROOT}" checkout "${REPO_BRANCH}"
    git -C "${INSTALL_ROOT}" pull --ff-only origin "${REPO_BRANCH}"
  fi

  ENV_FILE="${INSTALL_ROOT}/deploy/.env"
  ENV_EXAMPLE="${INSTALL_ROOT}/deploy/.env.example"
  CERT_SOURCE_DIR="${INSTALL_ROOT}/deploy/certs"
  CERT_SOURCE_CRT="${CERT_SOURCE_DIR}/cloudflare-origin.crt"
  CERT_SOURCE_KEY="${CERT_SOURCE_DIR}/cloudflare-origin.key"
  CERT_TARGET_CRT="${CERT_TARGET_DIR}/${PRIMARY_DOMAIN}.crt"
  CERT_TARGET_KEY="${CERT_TARGET_DIR}/${PRIMARY_DOMAIN}.key"
}

ensure_env_file() {
  if [[ ! -f "${ENV_EXAMPLE}" ]]; then
    error ".env.example not found at ${ENV_EXAMPLE}"
    exit 1
  fi

  if [[ ! -f "${ENV_FILE}" ]]; then
    cp "${ENV_EXAMPLE}" "${ENV_FILE}"
  fi
}

ensure_env_kv() {
  local key="$1"
  local value="$2"
  local escaped_value=""

  escaped_value="${value//\\/\\\\}"
  escaped_value="${escaped_value//&/\\&}"
  escaped_value="${escaped_value//#/\\#}"

  if grep -qE "^${key}=" "${ENV_FILE}"; then
    sed -i "s#^${key}=.*#${key}=${escaped_value}#g" "${ENV_FILE}"
  else
    printf '\n%s=%s\n' "${key}" "${value}" >> "${ENV_FILE}"
  fi
}

current_env_value() {
  local key="$1"
  if grep -qE "^${key}=" "${ENV_FILE}"; then
    grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 | cut -d'=' -f2-
  else
    echo ""
  fi
}

ensure_secret_if_missing() {
  local key="$1"
  local current_value
  current_value="$(current_env_value "${key}")"

  if [[ -z "${current_value}" || "${current_value}" == "change_this_secure_password" ]]; then
    ensure_env_kv "${key}" "$(openssl rand -hex 32)"
  fi
}

prepare_env() {
  local admin_email=""
  local admin_password=""

  info "Preparing deploy/.env..."
  ensure_env_file

  ensure_env_kv "BIND_HOST" "${SUB2API_BIND_HOST}"
  ensure_env_kv "SERVER_PORT" "${SUB2API_SERVER_PORT}"

  ensure_secret_if_missing "POSTGRES_PASSWORD"
  ensure_secret_if_missing "JWT_SECRET"
  ensure_secret_if_missing "TOTP_ENCRYPTION_KEY"

  if [[ -n "${SUB2API_ADMIN_EMAIL}" ]]; then
    admin_email="${SUB2API_ADMIN_EMAIL}"
  else
    admin_email="admin@${PRIMARY_DOMAIN}"
  fi
  ensure_env_kv "ADMIN_EMAIL" "${admin_email}"

  admin_password="$(current_env_value "ADMIN_PASSWORD")"
  if [[ -n "${SUB2API_ADMIN_PASSWORD}" ]]; then
    admin_password="${SUB2API_ADMIN_PASSWORD}"
    ensure_env_kv "ADMIN_PASSWORD" "${admin_password}"
  elif [[ -z "${admin_password}" ]]; then
    admin_password="$(openssl rand -base64 18 | tr -d '\n' | tr '/+' 'AB' | cut -c1-20)"
    GENERATED_ADMIN_PASSWORD="${admin_password}"
    ensure_env_kv "ADMIN_PASSWORD" "${admin_password}"
  fi

  mkdir -p "${INSTALL_ROOT}/deploy/data" "${INSTALL_ROOT}/deploy/postgres_data" "${INSTALL_ROOT}/deploy/redis_data"
  chmod 600 "${ENV_FILE}"
  success "deploy/.env and data directories are ready."
}

prepare_cloudflare_cert_dir() {
  mkdir -p "${CERT_TARGET_DIR}"
  chmod 755 "${CERT_TARGET_DIR}"

  if [[ -f "${CERT_SOURCE_CRT}" && -f "${CERT_SOURCE_KEY}" ]]; then
    info "Installing Cloudflare Origin CA certificate..."
    install -m 644 "${CERT_SOURCE_CRT}" "${CERT_TARGET_CRT}"
    install -m 600 "${CERT_SOURCE_KEY}" "${CERT_TARGET_KEY}"
    HTTPS_READY="true"
    success "Cloudflare Origin CA certificate installed."
  elif [[ -f "${CERT_TARGET_CRT}" && -f "${CERT_TARGET_KEY}" ]]; then
    HTTPS_READY="true"
    info "Using existing Cloudflare Origin CA certificate from ${CERT_TARGET_DIR}."
  else
    HTTPS_READY="false"
    warn "Cloudflare Origin CA files not found at ${CERT_SOURCE_DIR}. HTTPS will stay disabled until you place:"
    warn "  ${CERT_SOURCE_CRT}"
    warn "  ${CERT_SOURCE_KEY}"
  fi
}

write_nginx_config() {
  local conf_path="/etc/nginx/sites-available/${APP_NAME}.conf"
  local access_log="/var/log/nginx/${APP_NAME}.access.log"
  local error_log="/var/log/nginx/${APP_NAME}.error.log"

  info "Writing Nginx config..."

  cat >"${conf_path}" <<EOF
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
}

upstream ${APP_NAME}_upstream {
    server 127.0.0.1:${SUB2API_SERVER_PORT};
    keepalive 64;
}
EOF

  if [[ "${HTTPS_READY}" == "true" ]]; then
    cat >>"${conf_path}" <<EOF

server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAMES};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${SERVER_NAMES};

    ssl_certificate ${CERT_TARGET_CRT};
    ssl_certificate_key ${CERT_TARGET_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:20m;
    ssl_session_tickets off;

    access_log ${access_log};
    error_log ${error_log};

    client_max_body_size 256m;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_connect_timeout 60s;

    location / {
        proxy_pass http://${APP_NAME}_upstream;
        proxy_http_version 1.1;
        proxy_buffering off;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
    }
}
EOF
  else
    cat >>"${conf_path}" <<EOF

server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAMES};

    access_log ${access_log};
    error_log ${error_log};

    client_max_body_size 256m;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_connect_timeout 60s;

    location / {
        proxy_pass http://${APP_NAME}_upstream;
        proxy_http_version 1.1;
        proxy_buffering off;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
    }
}
EOF
  fi

  ln -sfn "${conf_path}" "/etc/nginx/sites-enabled/${APP_NAME}.conf"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
  success "Nginx is configured."
}

remove_conflicting_containers() {
  local name=""
  for name in sub2api sub2api-postgres sub2api-redis; do
    if docker ps -a --format '{{.Names}}' | grep -qx "${name}"; then
      info "Removing existing container ${name}..."
      docker rm -f "${name}" >/dev/null
    fi
  done
}

start_compose_stack() {
  info "Starting Docker stack from local source build..."
  remove_conflicting_containers
  docker compose -f "${INSTALL_ROOT}/deploy/docker-compose.build.yml" --env-file "${ENV_FILE}" up -d --build
  success "Docker stack is running."
}

print_summary() {
  local tailscale_ipv4=""

  if command -v tailscale >/dev/null 2>&1; then
    tailscale_ipv4="$(tailscale ip -4 2>/dev/null | head -n 1 || true)"
  fi

  echo
  echo "============================================================"
  echo "Sub2API first-run bootstrap completed"
  echo "============================================================"
  echo "Repo:           ${INSTALL_ROOT}"
  echo "Deploy dir:     ${INSTALL_ROOT}/deploy"
  echo "Domain:         ${SERVER_NAMES}"
  echo "Nginx HTTPS:    ${HTTPS_READY}"
  echo "App URL:        http://${PRIMARY_DOMAIN}"
  if [[ "${HTTPS_READY}" == "true" ]]; then
    echo "App URL (TLS):  https://${PRIMARY_DOMAIN}"
  fi
  echo "Health check:   curl http://127.0.0.1:${SUB2API_SERVER_PORT}/health"
  if [[ -n "${GENERATED_ADMIN_PASSWORD}" ]]; then
    echo "Admin email:    $(current_env_value "ADMIN_EMAIL")"
    echo "Admin password: ${GENERATED_ADMIN_PASSWORD}"
  fi
  if [[ -n "${tailscale_ipv4}" ]]; then
    echo "Tailscale IPv4: ${tailscale_ipv4}"
    echo "SSH example:    ssh root@${tailscale_ipv4}"
  fi
  if [[ "${HTTPS_READY}" != "true" ]]; then
    echo
    echo "Cloudflare Origin CA is not installed yet."
    echo "Place cert files at:"
    echo "  ${CERT_SOURCE_CRT}"
    echo "  ${CERT_SOURCE_KEY}"
    echo "Then rerun this script to enable HTTPS in Nginx."
  fi
  echo
  echo "Future rebuild command:"
  echo "  cd ${INSTALL_ROOT}"
  echo "  git pull"
  echo "  cd deploy"
  echo "  docker compose -f docker-compose.build.yml up -d --build"
  echo "============================================================"
}

main() {
  require_root
  require_ubuntu
  require_domain
  install_apt_packages
  install_tailscale
  prepare_install_root
  clone_or_update_repo
  prepare_env
  prepare_cloudflare_cert_dir
  write_nginx_config
  start_compose_stack
  print_summary
}

main "$@"
