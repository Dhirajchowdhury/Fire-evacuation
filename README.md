# Smart Fire Evacuation System

A real-time smart building fire evacuation system with 3D visualization, zone-based alerting, and dynamic route calculation.

---

## Project Overview

This monorepo contains:
- **Backend** — Node.js + Express REST API with Supabase integration and BFS-based evacuation routing
- **Frontend** — Next.js 14 dashboard with real-time zone status and evacuation route display
- **Visualization** — Three.js 3D building map with live node status rendering
- **AR Navigation** — Stubbed WebXR overlay (Phase 2)
- **Shared** — Single source of truth for building graph and TypeScript types

---

## Folder Structure

```
smart-fire-evacuation/
├── backend/              # Express API, Supabase, evacuation engine
├── frontend/             # Next.js 14 dashboard
├── visualization/        # Three.js 3D building renderer
├── ar-navigation/        # AR overlay (stubbed, Phase 2)
├── shared/               # building-graph.json + types.ts
├── .gitignore
├── package.json          # Monorepo root
└── README.md
```

---

## How to Run

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Set up environment variables

Copy the example files and fill in your Supabase credentials:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

### 3. Set up the database

Run `backend/database/schema.sql` then `backend/database/seed.sql` in your Supabase SQL editor.

### 4. Start development servers

```bash
npm run dev
```

This starts both backend (port 4000) and frontend (port 3000) concurrently.

Or run individually:

```bash
npm run dev:backend
npm run dev:frontend
```

---

## Environment Variables

### backend/.env

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only) |
| `PORT` | Backend port (default: 4000) |

### frontend/.env.local

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_BACKEND_URL` | Backend API base URL (default: http://localhost:4000) |

---

## Shared Building Graph

`shared/building-graph.json` is the single source of truth for the building layout. Both backend and frontend import it directly. Do not duplicate node/edge definitions elsewhere.

---

## ESP32 Integration

See [ESP32_INTEGRATION.md](./ESP32_INTEGRATION.md) for hardware sensor integration details.
