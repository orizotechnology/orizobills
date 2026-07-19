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

Before running the app, install:

1. **Node.js** 20+ — https://nodejs.org
2. **Rust + Cargo** — https://rustup.rs
3. **MySQL 8.0** — https://dev.mysql.com/downloads/mysql/
4. **Tauri CLI prerequisites** — https://tauri.app/start/prerequisites/

---

## Setup (first time)

```bash
# 1. Clone the repo
git clone https://github.com/orizotechnology/orizobills.git
cd orizobills

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd server && npm install && cd ..

# 4. Copy environment files and fill in your MySQL credentials
copy server\.env.example server\.env
copy .env.example .env
```

Edit `server/.env` and set your MySQL password:
```
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/erp_system"
```

The database **erp_system** is created automatically on first run.

---

## Running the app

```bash
# Tauri desktop app (opens native window)
npm run dev
```

This single command:
- Starts Vite frontend on `:3000`
- Auto-starts the Fastify backend on `:5000`
- Creates `erp_system` MySQL database if it doesn't exist
- Pushes the Prisma schema (all tables created automatically)
- Seeds a default "Main Branch"
- Opens the Tauri native window

---

## Project structure

```
orizobills/
├── src/                    # React frontend
│   ├── app/                # Page components
│   ├── components/         # Shared components
│   ├── hooks/              # Custom hooks
│   ├── lib/                # HTTP client (axios.ts)
│   ├── store/              # Zustand stores
│   └── routes/             # React Router routes
├── server/                 # Fastify backend
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   ├── startup/        # DB init on boot
│   │   └── database/       # Prisma client manager
│   └── prisma/
│       └── schema.prisma   # MySQL schema (all tables)
├── src-tauri/              # Rust/Tauri config
├── launch.ps1              # Windows launch script
└── vite-plugin-backend.ts  # Auto-starts backend with Vite
```

---

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Launch full Tauri desktop app |
| `npm run dev:vite` | Vite only (frontend + backend, no Tauri window) |
| `npm run dev:server` | Backend only |
| `npm run build` | Build frontend for production |
| `npm run build:tauri` | Build distributable Tauri app |
| `npm run db:push` | Push Prisma schema to MySQL |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |

---

## Moving to another machine

1. Clone the repo
2. Install prerequisites (Node, Rust, MySQL)
3. Copy `.env.example` → `.env` in root and `server/`
4. Set your MySQL credentials in `server/.env`
5. Run `npm install` and `cd server && npm install`
6. Run `npm run dev` — DB is created automatically

**No manual SQL needed.** The app creates the database, tables, and default branch on first startup.
