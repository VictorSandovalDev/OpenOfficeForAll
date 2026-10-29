[English](DEPLOY.md) · **Español**

# Desplegar Open Office For All

Esta guía pone tu oficina en internet con HTTPS, clave de invitación, decoración solo para administradores y un servidor TURN para que las llamadas funcionen entre redes distintas. Toma unos quince minutos en cualquier servidor Linux con Docker.

## Qué necesitas

- Un servidor con IP pública (1 vCPU y 1 GB de RAM bastan para un equipo pequeño).
- Un dominio o subdominio cuyo registro DNS apunte a ese servidor, por ejemplo `oficina.ejemplo.org`.
- Docker con el complemento Compose.
- Puertos abiertos: `80` y `443` (TCP, HTTPS), `3478` (TCP y UDP, TURN), `49160-49200` (UDP, retransmisión TURN) y, para el servidor de medios, `7881` (TCP) y `50000-50100` (UDP).

## Pasos

1. Clona el repositorio en el servidor.

   ```sh
   git clone https://github.com/VictorSandovalDev/OpenOfficeForAll.git
   cd OpenOfficeForAll
   ```

2. Crea tu configuración y cambia cada valor `change-me` por cadenas largas y aleatorias.

   ```sh
   cp .env.example .env
   openssl rand -hex 24   # ejecútalo tres veces: clave de invitación, de administrador y contraseña TURN
   ```

3. Arranca los servicios. Caddy obtiene el certificado HTTPS automáticamente.

   ```sh
   docker compose up -d --build
   ```

4. Abre una vez `https://oficina.ejemplo.org/?admin=<tu clave de administrador>`. Ese navegador queda como administrador de la oficina y puede decorar, renombrar salas y crear canales.

5. Invita a tu equipo desde **Invitar colaboradores**. El enlace ya incluye la clave de invitación.

## Referencia de configuración

| Variable | Para qué sirve |
| --- | --- |
| `OFFICE_ACCESS_KEY` | Clave de invitación necesaria para entrar. Déjala vacía para una oficina abierta. |
| `OFFICE_ADMIN_KEY` | Clave que da el rol de administrador (`?admin=` en la dirección). |
| `EDIT_POLICY` | `admins` o `everyone`. Es `admins` por defecto cuando hay clave de administrador. |
| `ICE_SERVERS` | Lista JSON de servidores STUN/TURN que reciben los navegadores. |
| `ALLOWED_ORIGINS` | Orígenes adicionales que pueden abrir el WebSocket. El dominio propio siempre está permitido. |
| `HOST`, `PORT` | Dirección de escucha del proceso Node (`0.0.0.0:3001` en Docker). |
| `SERVE_CLIENT` | Ponlo en `false` si otro servidor web aloja el cliente compilado. |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Servidor de medios para las salas de reunión. Con él, una reunión de 20 personas necesita una conexión por persona en vez de 19. Apunta un subdominio `livekit.` al servidor y mantén la clave igual que en `deploy/livekit.yaml`. |
| `WORKSPACE_TEMPLATE` | Oficina cuyo diseño actual copian los espacios nuevos (por defecto `mi-oficina`, Vivo). |
| `ACCOUNTS` | `off` (solo nombres, por defecto), `optional` (cuentas o invitados) o `required` (correo y contraseña para entrar). Las contraseñas se guardan con scrypt; las sesiones duran 30 días. |

Los datos de la oficina (decoración, nombres de salas, canales, mensajes y calendario) viven en el volumen `office-data`. Haz copias con `docker run --rm -v openofficeforall_office-data:/data -v "$PWD":/backup alpine tar czf /backup/office-data.tgz -C /data .`.

## Sin Docker

```sh
npm ci && npm run build
OFFICE_ACCESS_KEY=... OFFICE_ADMIN_KEY=... HOST=0.0.0.0 PORT=3001 node server/index.mjs
```

Pon cualquier proxy inverso con HTTPS delante del puerto 3001 y reenvía las conexiones WebSocket de `/ws`. Los navegadores solo permiten micrófono, cámara y pantalla compartida con HTTPS.

## Notas de seguridad

- La clave de invitación protege la oficina; cualquiera con el enlace puede entrar, así que cámbiala si se filtra (modifica `OFFICE_ACCESS_KEY` y reinicia).
- Las identidades son nombres que elige cada persona y se recuerdan por navegador. Todavía no hay contraseñas ni cuentas.
- Las llamadas por cercanía son entre pares. Las salas de reunión usan el servidor de medios LiveKit cuando está configurado, lo que mantiene fluidas las reuniones grandes.
