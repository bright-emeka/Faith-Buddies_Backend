# Faith Buddies Backend - Firebase Migration

## Architecture

This backend has been migrated from Express/MongoDB to Firebase:

- **Cloud Functions v2** replaces Express routes (`functions/index.js`)
- **Cloud Firestore** replaces MongoDB (`firestore.rules`, `firestore.indexes.json`)
- **Firebase Authentication** replaces custom JWT/bcrypt auth
- **Cloud Storage** replaces any local file storage (`storage.rules`)

## Key Files

- `functions/index.js` - All Cloud Functions (HTTP router + Firestore triggers)
- `functions/src/controllers/` - Business logic controllers
- `functions/src/middleware/auth.js` - Firebase ID token verification
- `firestore.rules` - Firestore RBAC rules
- `storage.rules` - Cloud Storage rules
- `firestore.indexes.json` - Composite indexes

## Firestore Data Model

See `MIGRATION.md` for complete data model mapping and emulator setup instructions.

## Running Locally

```bash
# Install root deps
npm install

# Install functions deps
cd functions && npm install && cd ..

# Start emulators
firebase emulators:start

# Or start specific services
firebase emulators:start --only functions,firestore
```

## Deployment

```bash
firebase deploy
```

## Client-Side

Frontend must use Firebase Auth SDK to get ID tokens and pass them in `Authorization: Bearer <token>` headers.