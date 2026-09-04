# TMB Admin Portal

Vite + React admin dashboard for TMB Movie Platform.

## Local development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Vercel deploy

1. Import repo `muzammil922/tmb-frontend`
2. Framework: Vite
3. Build command: `pnpm build`
4. Output directory: `dist`
5. Set environment variable **before first build**:
   ```
   VITE_API_URL=https://api.yourdomain.com/api
   ```
6. Redeploy after changing `VITE_API_URL` (baked at build time)

Default login: `admin@tmb.com` / `Admin@123456`
