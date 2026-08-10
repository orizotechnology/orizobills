# Orizo Bills — ERP Desktop Application

A Tauri v2 desktop ERP application built with React + Fastify + MySQL.

---

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Desktop  | Tauri v2 (Rust) |
| Frontend | React 19, Vite 8, TypeScript, Zustand, TanStack Query |
| Backend  | Fastify 5, Prisma 6, Node.js |
| Database | MySQL 8.0 |

---

## Prerequisites

Install these once on each machine before running the app:

1. **Node.js 20+** — https://nodejs.org
2. **Rust + Cargo** — https://rustup.rs
3. **MySQL 8.0** — https://dev.mysql.com/downloads/mysql/
4. **Tauri prerequisites** — https://tauri.app/start/prerequisites/

---

## Setup on a new machine (first time only)

```bash
# 1. Clone the repo
git clone https://github.com/orizotechnology/orizobills.git
cd orizobills

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd server
npm install
cd ..

# 4. Create your local .env from the template
copy server\.env.example server\.env
```

### ✏️ The only thing you need to change — your MySQL password

Open `server/.env` and find this line:

```
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/erp_system"
```

Replace `YOUR_PASSWORD` with your actual MySQL root password:

```
DATABASE_URL="mysql://root:MyActualPassword@localhost:3306/erp_system"
```

**That's it.** Save the file. The database, tables, and default branch are all created automatically on first run.

---

## Running the app

```bash
npm run dev
```

This one command:
- Starts Vite frontend on port `3000`
- Auto-starts the Fastify backend on port `5000`
- Creates the `erp_system` MySQL database if it doesn't exist
- Pushes the Prisma schema (all tables created automatically)
- Creates a default "Main Branch"
- Opens the Tauri native desktop window

---

## Project structure

```
orizobills/
├── src/                    # React frontend
│   ├── app/                # Page components
│   ├── store/              # Zustand stores
│   ├── lib/                # HTTP client
│   └── styles/             # Global CSS
├── server/                 # Fastify backend
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── startup/        # DB auto-init on boot
│   │   └── database/       # Prisma multi-branch manager
│   ├── prisma/
│   │   └── schema.prisma   # MySQL schema
│   └── .env.example        # ← copy this to .env and set password
├── src-tauri/              # Rust/Tauri shell
└── launch.ps1              # Windows quick-launch script
```

---

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Launch full Tauri desktop app |
| `npm run dev:vite` | Frontend + backend only (no Tauri window) |
| `npm run dev:server` | Backend only |
| `npm run build:tauri` | Build distributable installer |
| `npm run db:push` | Sync Prisma schema to MySQL |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |

---

## Moving to a different machine — checklist

| Step | What to do |
|------|-----------|
| 1 | Install Node 20+, Rust, MySQL 8.0, Tauri prerequisites |
| 2 | `git clone` the repo |
| 3 | `npm install` in root |
| 4 | `cd server && npm install` |
| 5 | `copy server\.env.example server\.env` |
| 6 | Open `server\.env` → change `YOUR_PASSWORD` to your MySQL root password |
| 7 | `npm run dev` — everything else is automatic |

> **No manual SQL required.** The app creates the database, all tables, and the default branch on first startup.

---

## Troubleshooting

**"DATABASE_URL still has the placeholder password"**
→ Open `server/.env` and replace `YOUR_PASSWORD` with your real MySQL password.

**"MySQL unreachable after 5 attempts"**
→ Make sure MySQL service is running: `net start MySQL80` (Windows) or `sudo service mysql start` (Linux/Mac).

**"Access denied for user 'root'"**
→ Your MySQL root password is wrong. Check it in `server/.env`.

**Port 5000 already in use**
→ Run `launch.ps1` — it automatically kills whatever is on port 5000 before starting.
