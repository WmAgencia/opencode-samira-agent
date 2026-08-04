# opencode-samira-agent

HTTP gateway service for the OpenCode Samira agent, powered by NVIDIA API.
Designed to run continuously on Railway.

## Architecture

```
Client -> HTTP API (Fastify) -> Samira Agent Service -> NVIDIA API -> AI Model
```

## Environment variables

| Variable          | Required | Default | Description                         |
|-------------------|----------|---------|-------------------------------------|
| `PORT`            | no       | `3000`  | HTTP port (Railway injects this)    |
| `NVIDIA_API_KEY`  | yes      | -       | NVIDIA API key (server side only)   |
| `SERVICE_NAME`    | no       | -       | Service name shown on `/api/status` |
| `SERVICE_VERSION` | no       | -       | Service version                     |
| `LOG_LEVEL`       | no       | `info`  | pino log level                      |
| `AGENT_MODEL`     | no       | -       | NVIDIA model id                     |
| `AGENT_MAX_TOKENS`| no       | `1024`  | Max tokens for the agent response   |

> Never commit real secrets. Copy `.env.example` to `.env` and fill in locally.

## Local development

```bash
npm install
cp .env.example .env   # then fill NVIDIA_API_KEY
npm run dev
```

## Production

```bash
npm install
npm run build
npm start
```

## Endpoints

- `GET /health` -> `{ "status": "ok" }`
- `GET /api/status` -> sanitized service info (no secrets)
- `POST /api/agent` -> `{ "task": "..." }` runs the agent and returns its response

## Railway deploy

1. Push this repo to GitHub.
2. Create a new service on Railway pointing to the repo.
3. Add the `NVIDIA_API_KEY` variable in the Railway dashboard.
4. Railway auto-detects the Dockerfile. Set `PORT` if needed (Railway injects it).
5. Deploy.
