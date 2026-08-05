# Faith Buddies Backend

This repository is the standalone backend API service for Faith Buddies.
It supports:
- Firebase Cloud Functions for API routes
- Firestore database for data persistence
- Firebase Storage for media files
- Firebase Authentication for user management

## Run locally

1. Ensure you have the Firebase CLI installed:

```bash
npm install -g firebase-tools
```

2. Set up your `.env` file with Firebase configuration:

```bash
cp .env.example .env
```

3. Install dependencies:

```bash
npm install
cd functions && npm install
```

4. Start the Firebase emulator:

```bash
npm run serve
```

