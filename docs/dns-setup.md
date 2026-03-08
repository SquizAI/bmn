# Storefront DNS & Wildcard TLS Setup

This document covers the DNS, Caddy, and Cloudflare configuration needed for
influencer storefronts to be served at `<slug>.brandmenow.store`.

---

## 1. Cloudflare DNS Configuration

In the Cloudflare dashboard for `brandmenow.store`:

| Type  | Name | Content               | Proxy | TTL  |
|-------|------|-----------------------|-------|------|
| A     | @    | `<server-ip>`         | DNS only (grey cloud) | Auto |
| CNAME | *    | `brandmenow.store`    | DNS only (grey cloud) | Auto |

**Important:** Proxy must be **off** (grey cloud / DNS only) for both records.
Caddy handles TLS termination via Let's Encrypt, not Cloudflare. If Cloudflare
proxy is enabled, it will conflict with Caddy's certificate management.

### Verify DNS resolution

```bash
# Should resolve to your server IP
dig brandmenow.store +short
dig lumina.brandmenow.store +short
dig any-slug.brandmenow.store +short
```

All three should return the same server IP address.

---

## 2. Cloudflare API Token

Caddy needs a Cloudflare API token to solve DNS-01 challenges for wildcard
certificates (`*.brandmenow.store`). HTTP-01 challenges cannot issue wildcard
certs -- DNS-01 is required.

### Create the token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Use the **Edit zone DNS** template, or create a custom token with:
   - **Permissions:** Zone > DNS > Edit
   - **Zone Resources:** Include > Specific zone > `brandmenow.store`
4. Copy the token value

### Set the environment variable

Add to `.env.production`:

```bash
CLOUDFLARE_API_TOKEN=your-token-here
```

This is read by the Caddy container via `docker-compose.caddy.yml`.

---

## 3. Custom Caddy Build

The official `caddy:2-alpine` Docker image does **not** include the Cloudflare
DNS plugin. A custom Dockerfile is provided at `caddy/Dockerfile` that builds
Caddy with the plugin using `xcaddy`:

```dockerfile
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

This is automatically used when deploying with the Caddy compose overlay:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d --build
```

The first build will take a few minutes to compile Caddy with the plugin. The
Docker layer cache will speed up subsequent builds.

---

## 4. Caddyfile Configuration

The Caddyfile at `caddy/Caddyfile` includes the wildcard block:

```caddyfile
*.brandmenow.store {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }

    @api path /api/*
    handle @api {
        reverse_proxy server:4847
    }

    @socketio path /socket.io/*
    handle @socketio {
        reverse_proxy server:4847
    }

    handle {
        reverse_proxy storefront:80
    }
}
```

- **API and Socket.io** requests are forwarded to the Express server
- **All other requests** are forwarded to the storefront SPA (nginx)
- The storefront SPA reads the subdomain from `window.location.hostname` to
  determine which store slug to load

---

## 5. Docker Compose Deployment

Full deployment with storefront + wildcard TLS:

```bash
# Load environment variables
set -a && source .env.production && set +a

# Build and deploy all services
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d --build
```

This starts:
- `bmn-redis` -- Redis 7
- `bmn-server` -- Express API
- `bmn-client` -- Dashboard SPA (app.prznl.com)
- `bmn-storefront` -- Storefront SPA (*.brandmenow.store)
- `bmn-caddy` -- Reverse proxy with wildcard TLS

---

## 6. Preview Route (No DNS Required)

For development and dashboard previews, the server provides a preview route
that renders storefronts without needing subdomain DNS:

```
GET /api/v1/store/:slug/preview
```

Example: `https://api.prznl.com/api/v1/store/lumina/preview`

This returns a self-contained HTML page that fetches the store data from the
API and renders it inline. The dashboard can iframe this URL to show a
storefront preview without configuring DNS or subdomains.

---

## 7. Testing Checklist

1. **DNS resolution:**
   ```bash
   dig lumina.brandmenow.store +short
   # Should return your server IP
   ```

2. **Wildcard TLS certificate:**
   ```bash
   curl -vI https://lumina.brandmenow.store 2>&1 | grep "subject:"
   # Should show *.brandmenow.store
   ```

3. **Storefront loads:**
   ```bash
   curl -s https://lumina.brandmenow.store | head -20
   # Should return the storefront SPA index.html
   ```

4. **API passthrough works:**
   ```bash
   curl -s https://lumina.brandmenow.store/api/v1/store/lumina | jq .success
   # Should return true
   ```

5. **Preview route works (no DNS):**
   ```bash
   curl -s https://api.prznl.com/api/v1/store/lumina/preview | head -5
   # Should return HTML
   ```

6. **Bare domain redirects:**
   ```bash
   curl -sI https://brandmenow.store | grep location
   # Should redirect to https://app.prznl.com
   ```

---

## Troubleshooting

### Certificate not issuing
- Verify `CLOUDFLARE_API_TOKEN` is set and has DNS edit permissions
- Check Caddy logs: `docker logs bmn-caddy`
- Ensure Cloudflare proxy is **off** (grey cloud) for the wildcard CNAME

### Storefront returns 502
- Verify the storefront container is running: `docker ps | grep storefront`
- Check storefront logs: `docker logs bmn-storefront`
- Ensure the storefront is on both `bmn-internal` and `bmn-external` networks

### Subdomain not resolving
- Verify the wildcard CNAME record exists in Cloudflare
- Wait for DNS propagation (usually < 1 minute for Cloudflare)
- Test with: `dig <slug>.brandmenow.store +short`
