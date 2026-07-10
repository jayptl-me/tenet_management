# Tenet PG Management — Credentials

## MongoDB Atlas (Production)

```
Username: pg
Password: mF79egx3obyL1aYi
Cluster:  pg-prod.sqmu1sc.mongodb.net
Database: pg_management
URI:      mongodb+srv://pg:<db_password>@pg-prod.sqmu1sc.mongodb.net/pg_management?retryWrites=true&w=majority&appName=pg-prod
```

## Demo Accounts

| Role   | Email                    | Password     |
| ------ | ------------------------ | ------------ |
| Admin  | admin@pgmanagement.local | Admin@123456 |
| Tenant | rahul@example.com        | password123  |
| Tenant | priya@example.com        | password123  |
| Tenant | amit@example.com         | password123  |

## Environment

The `apps/api/.env` file contains the full MongoDB URI and all config.
**Do not commit `.env` to git** — it's in `.gitignore` already.

## Local Development

```bash
bun run dev        # Starts API (port 8000) + Web (port 3000)
```

The API connects to the shared Atlas cluster — no local MongoDB needed.
