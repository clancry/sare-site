# SARE · sare-exclusive.com

Static site + small Node server.

- `public/` : the site (generated, do not edit by hand)
- `server.js` : serves the site, receives booking requests at `/api/request`, stores them in `$DATA_DIR/requests.jsonl`, emails them, and lists them at `/admin` (password: `ADMIN_PASSWORD`).

## Environment variables
| Name | Purpose |
|---|---|
| `ADMIN_PASSWORD` | Password for /admin (any username) |
| `DATA_DIR` | Where requests are stored (mount a volume here, default `/data`) |
| `NOTIFY_TO` | Who receives the request emails (comma-separated) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Outgoing mail account |
