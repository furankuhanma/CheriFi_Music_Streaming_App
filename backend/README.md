# CheriFi Backend

Node.js + Express + PostgreSQL + Prisma backend for the CheriFi music app.

---

## Prerequisites

### 1. Install Docker Desktop

Docker Desktop runs PostgreSQL in a container — no local Postgres install needed.

**Linux (Ubuntu/Debian):**
```bash
# Install Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to the docker group (so you don't need sudo)
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt-get install docker-compose-plugin

# Verify
docker --version
docker compose version
```

**macOS:**
1. Download Docker Desktop from https://www.docker.com/products/docker-desktop
2. Open the `.dmg` and drag Docker to Applications
3. Launch Docker Desktop and wait for it to start
4. Verify: `docker --version`

**Windows:**
1. Download Docker Desktop from https://www.docker.com/products/docker-desktop
2. Run the installer (requires WSL2 — the installer will prompt you)
3. Restart your machine
4. Verify in PowerShell: `docker --version`

### 2. Install Node.js 20+

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # or ~/.zshrc
nvm install 20
nvm use 20
node --version     # should print v20.x.x
```

---

## Setup

### 1. Clone and install dependencies

```bash
cd cherifi-backend
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and update the JWT secrets:

```bash
# Generate secure secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run that twice — once for `JWT_ACCESS_SECRET`, once for `JWT_REFRESH_SECRET`.

### 3. Start PostgreSQL

```bash
docker compose up -d
```

This starts a PostgreSQL container on port 5432. Data is persisted in a Docker volume so it survives restarts.

Verify it's running:
```bash
docker compose ps
```

### 4. Run database migrations

```bash
npm run db:generate   # generate Prisma client
npm run db:migrate    # create tables
```

When prompted for a migration name, type something like `initial`.

### 5. Add your audio file

Copy your mp3 to the uploads folder:
```bash
cp /path/to/your/song.mp3 uploads/bang-bang.mp3
```

### 6. Seed the database

```bash
npm run db:seed
```

This creates:
- A test user (`test@cherifi.com` / `password123`)
- An artist, album, and one track pointing to `uploads/bang-bang.mp3`

### 7. Start the dev server

```bash
npm run dev
```

The server starts at **http://localhost:3000**

---

## API Endpoints

### Health
```
GET /health
```

### Auth
```
POST /api/auth/register     { email, username, password }
POST /api/auth/login        { email, password }
POST /api/auth/refresh      { refreshToken }
POST /api/auth/logout       { refreshToken }
POST /api/auth/oauth        { provider, providerId, email, displayName }
GET  /api/auth/me           🔒 requires Bearer token
```

### Tracks
```
GET  /api/tracks            List all tracks (optional auth)
GET  /api/tracks/:id        Get track metadata (optional auth)
GET  /api/tracks/:id/stream Stream audio (public, supports range requests)
POST /api/tracks/:id/play   🔒 Record a play event
```

### Recommendations
```
GET /api/recommendations/for-you           🔒 Personalised recommendations
GET /api/recommendations/popular           Popular tracks (public)
GET /api/recommendations/related/:trackId  Related tracks (optional auth)
```

---

## Development

```bash
# View database in browser UI
npm run db:studio

# Stop PostgreSQL
docker compose down

# Stop and delete all data
docker compose down -v
```

---

## Deploying to Railway

1. Push your code to GitHub
2. Create a new project on https://railway.app
3. Add a PostgreSQL plugin — Railway gives you a `DATABASE_URL`
4. Add your repo as a service
5. Set environment variables in Railway dashboard (copy from `.env`, update `DATABASE_URL`)
6. Railway auto-deploys on push

For audio files on Railway, you'll need to migrate from local filesystem to a storage service (AWS S3, Cloudinary, or Supabase Storage) since Railway's filesystem is ephemeral.
