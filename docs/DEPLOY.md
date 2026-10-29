**English** · [Español](DEPLOY.es.md)

# Deploying Open Office For All

This guide puts your office on the internet with HTTPS, an invite key, admin-only decorating and a TURN relay so calls work across networks. It takes about fifteen minutes on any Linux server with Docker.

## What you need

- A server with a public IP address (1 vCPU and 1 GB of RAM are enough for a small team).
- A domain or subdomain whose DNS record points to that server, for example `office.example.org`.
- Docker with the Compose plugin.
- Open ports: `80` and `443` (TCP, HTTPS), `3478` (TCP and UDP, TURN) and `49160-49200` (UDP, TURN relay).

## Steps

1. Clone the repository on the server.

   ```sh
   git clone https://github.com/VictorSandovalDev/OpenOfficeForAll.git
   cd OpenOfficeForAll
   ```

2. Create your configuration and replace every `change-me` value with long random strings.

   ```sh
   cp .env.example .env
   openssl rand -hex 24   # run it three times: invite key, admin key, TURN password
   ```

3. Start the stack. Caddy obtains the HTTPS certificate automatically.

   ```sh
   docker compose up -d --build
   ```

4. Open `https://office.example.org/?admin=<your admin key>` once. That browser is now an office admin and can decorate, rename rooms and create channels.

5. Invite your team from **Invite collaborators**. The link already contains the invite key.

## Configuration reference

| Variable | Purpose |
| --- | --- |
| `OFFICE_ACCESS_KEY` | Invite key required to enter. Leave empty for an open office. |
| `OFFICE_ADMIN_KEY` | Key that grants the admin role (`?admin=` in the URL). |
| `EDIT_POLICY` | `admins` or `everyone`. Defaults to `admins` when an admin key is set. |
| `ICE_SERVERS` | JSON list of STUN/TURN servers sent to browsers at runtime. |
| `ALLOWED_ORIGINS` | Extra origins allowed to open the WebSocket. The office's own domain is always allowed. |
| `HOST`, `PORT` | Listening address of the Node process (`0.0.0.0:3001` in Docker). |
| `SERVE_CLIENT` | Set to `false` if another web server hosts the built client. |
| `ACCOUNTS` | `off` (names only, default), `optional` (accounts or guests) or `required` (e-mail and password to enter). Passwords are hashed with scrypt; sessions last 30 days. |

Office data (decorations, room names, channels, messages and the calendar) lives in the `office-data` volume. Back it up with `docker run --rm -v openofficeforall_office-data:/data -v "$PWD":/backup alpine tar czf /backup/office-data.tgz -C /data .`.

## Without Docker

```sh
npm ci && npm run build
OFFICE_ACCESS_KEY=... OFFICE_ADMIN_KEY=... HOST=0.0.0.0 PORT=3001 node server/index.mjs
```

Put any HTTPS reverse proxy in front of port 3001 and forward WebSocket upgrades on `/ws`. Browsers only allow the microphone, camera and screen sharing over HTTPS.

## Security notes

- The invite key protects the office; anyone with the link can enter, so rotate the key if it leaks (change `OFFICE_ACCESS_KEY` and restart).
- Identities are names chosen by each person, remembered per browser. There are no passwords or accounts yet.
- Calls are peer to peer. For large meetings (more than about eight people with cameras on) a media server (SFU) is still on the roadmap.
