# Faith Buddies Backend

This repository is the standalone backend API service for Faith Buddies.
It supports:
- Express API routes for chat, users, posts, interactions, and follows
- MongoDB connection via `mongoose`
- Optional static serving of a local `frontend/dist` or `frontend/build` production bundle
- CORS configuration for a separate frontend during development

## Run locally

1. Copy `.env.example` to `.env`
2. Set `MONGO_URI`, `FRONTEND_URL`, and other environment variables
3. Install dependencies:

```bash
npm install
```

4. Start the backend:

```bash
npm run dev
```

