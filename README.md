# iSmart On-call (check-in app)

A phone-first web app (installable PWA) for **on-call relievers**. Registration happens in the iSmart mobile app ("On-call" on the login screen) or by ops on the web portal. This app does only the daily part.

## What the app does
1. **Sign in:** mobile number + SMS code (the same OTP as Join iSmart).
2. **Allow access:** location and camera, asked once on first use.
3. **Pick a site:** sites near the phone are listed, nearest first, within 2 km. The nearest one is preselected if it is under 500 m. Search by name covers the rest. People are often just told to "go to that site" and don't know its name, so nothing is pre-assigned.
4. **Check in:** a normal photo (no face matching) with the ON id, name, site, IST date/time and GPS coordinates burned into it.
5. **Check out:** another stamped photo the same way.
6. **Hours worked:** today, this week and this month. There is no shift, so it's simply check-out minus check-in. Rejected days are not counted.

Ops then verify each check-in on the web portal (**Reliever Management → On-call Reliever → Check-ins**). After that they map it to the absent employee it covered in **Cover mapping**, which is what gets paid. The absent employee's attendance is not touched.

## How it talks to the backend
- **Calls:** `https://api.ismartfacitech.com/api/v1/oncall/public/*` **directly**, not through a proxy, so the gateway's per-phone OTP limits see each phone's own address. The gateway allows this origin in CORS (`https://oncall.ismartfacitech.com`, api-gateway `main.ts`).
- **Photos:** go to storage through a presigned PUT. The presigned URL points at the public storage host, which already allows any origin.
- **Session:** the OTP token lasts 24 h and is kept in `localStorage`; after that the person verifies the number again.

Build-time setting: `VITE_API_BASE` (default `https://api.ismartfacitech.com/api/v1`).

## Develop
```bash
npm ci
npm run dev        # http://localhost:5173 (allowed by the gateway CORS list)
npm run build      # typecheck + production build in dist/
```
Camera and location need HTTPS (or localhost).

## Deploy (frontend VM, next to smartfm-frontend)
1. **DNS:** point `oncall.ismartfacitech.com` at the same address as `smartfm.ismartfacitech.com`.
2. **TLS:** issue a certificate for `oncall.ismartfacitech.com` the same way as the smartfm one. It must end up under `/etc/letsencrypt/live/oncall.ismartfacitech.com/`.
3. **Code:** clone this repo to `/opt/oncall-web`.
4. **Compose:** add the service to `/opt/smartfm-frontend/docker-compose.yml`:
   ```yaml
     oncall:
       image: oncall-web:latest
       build:
         context: /opt/oncall-web
         network: host
       restart: unless-stopped
       networks:
         - frontend-net
   ```
5. **nginx:** add this server block to `/opt/smartfm-frontend/docker/nginx/default.conf`, and add `oncall.ismartfacitech.com` to the port-80 redirect's `server_name`:
   ```nginx
   server {
       listen 443 ssl;
       server_name oncall.ismartfacitech.com;
       ssl_certificate     /etc/letsencrypt/live/oncall.ismartfacitech.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/oncall.ismartfacitech.com/privkey.pem;
       ssl_protocols       TLSv1.2 TLSv1.3;
       resolver 127.0.0.11 valid=10s;
       set $oncall_upstream oncall;
       location / {
           proxy_pass http://$oncall_upstream:80;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
6. **Start it:** `docker compose up -d --build oncall`, then `docker compose exec nginx nginx -s reload`.
7. **Check:** open `https://oncall.ismartfacitech.com` on a phone. Sign in, allow access, check that sites are listed, then check in and check out with a test registration.

**Releasing a change:** `git pull && docker compose up -d --build oncall`. The service worker re-checks `index.html` and `sw.js` on every load, so phones pick up a new release on the next open.
