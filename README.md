# SafeWalk — Real-Time Safety-Weighted Pedestrian Routing

SafeWalk is a prototype pedestrian routing application that computes the **safest** walking path between two points, dynamically avoiding high-danger zones. It uses AI-powered incident analysis to update street risk scores in real time.

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React, Tailwind CSS, React-Leaflet |
| Backend | Python, FastAPI, Uvicorn |
| Database | MongoDB Atlas (Motor async driver) |
| Auth | Auth0 (NextJS SDK v4) |
| AI Engine | Google Gemini 2.0 Flash |
| Audio | ElevenLabs TTS |
| Deployment | Docker / Docker Compose on Vultr |

## Quick Start (Local)

### Prerequisites
- Python 3.12+
- Node.js 20+
- MongoDB (local or Atlas)
- API keys: Gemini, ElevenLabs, Auth0

### Backend

```bash
cd backend
cp .env.example .env        # fill in your keys
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed           # seed demo graph
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # fill in Auth0 + API URL
npm install
npm run dev
```

### Docker Compose

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Fill in all keys in both files
docker compose up --build
```

## Core Algorithm

SafeWalk implements a modified Dijkstra's algorithm with two modes:

- **Safest** — edge weight = `danger_score` (0–100, updated by AI)
- **Shortest** — edge weight = `distance_m` (physical metres)

The algorithm builds an in-memory adjacency list from MongoDB, then finds the path with the lowest cumulative cost.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/route?start=&end=&mode=` | Compute safe/short route |
| GET | `/api/route/intersections` | List all graph nodes |
| GET | `/api/route/streets` | List all graph edges |
| GET | `/api/route/nearest?lng=&lat=` | Find nearest intersection |
| POST | `/api/incidents` | Report incident (Gemini parses) |
| GET | `/api/incidents` | List recent incidents |
| POST | `/api/emergency/panic` | Generate 911 dispatch audio |
| GET | `/health` | Liveness probe |
