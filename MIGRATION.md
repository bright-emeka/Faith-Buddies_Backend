# Firebase Migration Guide - Faith Buddies Backend

## Overview

This document describes the migration from Express/MongoDB to Firebase (Cloud Firestore + Cloud Functions v2 + Cloud Storage).

---

## Restructured File Layout

```
faith-buddies_backend/
├── functions/
│   ├── package.json              # Functions dependencies
│   ├── index.js                  # Main entry: all Cloud Functions (router + triggers)
│   └── src/
│       ├── config/
│       │   └── firebase.js       # Firebase Admin SDK init
│       ├── middleware/
│       │   └── auth.js           # Firebase ID token verification middleware
│       ├── controllers/
│       │   ├── authController.js # Auth (token-based, no JWT/bcrypt)
│       │   ├── userController.js # User profile, sync, search
│       │   ├── postController.js # Post CRUD, feed, delete
│       │   ├── interactionController.js # Likes, comments
│       │   ├── followController.js # Follow/unfollow/toggle/status
│       │   └── chatController.js # Chat with Gemini AI
│       └── utils/
│           ├── prompts.js        # Religion-specific system prompts
│           └── geminiService.js  # Gemini AI integration via axios
├── firebase.json                 # Firebase project config (emulator ports, etc.)
├── .firebaserc                   # Firebase project reference
├── firestore.rules               # Firestore RBAC security rules
├── firestore.indexes.json        # Firestore composite indexes
├── storage.rules                 # Cloud Storage security rules
├── .env.example                  # Environment variable template
├── package.json                  # Root package (devDep: firebase-tools)
└── MIGRATION.md                  # This file
```

### Removed Files (Old Architecture)

- `server.js` - Replaced by Firebase Functions
- `config/firebase.js` - Replaced by Firebase Admin auto-init in Functions runtime
- `middleware/jwtAuth.js` - Removed (no more custom JWT)
- `middleware/auth.js` - Replaced by functions middleware
- `middleware/rateLimiter.js` - Rate limiting now handled by Firebase quotas
- `models/*.js` (User, Post, Like, Comment, Chat, Follow) - Replaced by Firestore collections
- `routes/*.js` (auth, users, posts, interactions, follows, chat) - Replaced by Cloud Functions
- `controllers/authController.js` - Replaced by functions controllers
- `utils/jwt.js` - Removed
- `utils/password.js` - Removed (no more bcrypt)
- `services/geminiService.js` - Moved to `functions/src/utils/`
- `utils/prompts.js` - Moved to `functions/src/utils/`

---

## Data Model Mapping (MongoDB → Firestore)

| MongoDB Collection | Firestore Collection/Subcollection | Document ID |
|---|---|---|
| `users` | `users/{uid}` | Firebase UID |
| `posts` | `posts/{postId}` | Auto-generated |
| `likes` | `posts/{postId}/likes/{userId}` | Firebase UID |
| `comments` | `posts/{postId}/comments/{commentId}` | Auto-generated |
| `follows` | `follows/{followerId}_{followingId}` | Composite key |
| `chats` | `chats/{userId}` | Firebase UID |
| `chats.messages` | `chats/{userId}/messages/{messageId}` | Auto-generated |
| - | `users/{uid}/feed/{postId}` | Post ID (denormalized) |

### Key Design Decisions

1. **User profiles** use their Firebase UID as the document ID in `users/`
2. **Chat messages** live in a subcollection `chats/{userId}/messages/{messageId}` as specified
3. **Likes** are subdocuments under `posts/{postId}/likes/` for efficient reads
4. **Comments** are subdocuments under `posts/{postId}/comments/`
5. **Follows** use a composite document ID `{followerId}_{followingId}` for efficient lookups
6. **Feed** is denormalized: `users/{uid}/feed/{postId}` for fast feed queries without `in` operator limits

---

## Authentication

### Before (Express + Custom JWT + bcrypt)
- Custom `jsonwebtoken` access/refresh tokens
- Cookie-based token storage
- Bcrypt password hashing
- Express middleware verifying JWT locally
- Firebase Admin `verifyIdToken()` as fallback

### After (Firebase Authentication)
- Firebase ID tokens passed in `Authorization: Bearer <token>` header
- Firebase Admin SDK `admin.auth().verifyIdToken()` for verification
- No custom JWT generation
- No password hashing (handled by Firebase Auth)
- No cookie-based auth
- No `jsonwebtoken` or `bcrypt` dependencies

### Middleware (`functions/src/middleware/auth.js`)

```js
import { auth } from 'firebase-admin';

// Extracts Bearer token from Authorization header or cookies
// Verifies with Firebase Admin SDK
// Attaches decoded token to req.user
// Returns 401 if missing or invalid
```

---

## Cloud Functions & Express Refactoring

### Routing (`functions/index.js`)

A single `onRequest` function (`api`) handles all HTTP routes with internal path-based routing, preserving the existing URL structure (`/api/auth/register`, `/api/posts/feed`, etc.).

### Firestore Triggers

- `onDocumentCreated` for `posts/{postId}` - Writes to followers' feed via `users/{followerId}/feed/`
- `onDocumentDeleted` for `follows/{followId}` - Cleans up feed entries

### Real-Time Updates

Instead of custom polling/WebSockets, the following patterns are used:

1. **Feed reads**: Query the denormalized `users/{uid}/feed` subcollection
2. **Chat messages**: Firestore real-time listeners on `chats/{userId}/messages` on the client side
3. **Post interactions**: Firestore triggers can notify clients of count changes
4. **Like/comment counts**: Updated via Cloud Functions when documents are created/deleted

---

## File Storage

### Before
No dedicated file upload endpoint existed for images in the codebase. The `image` field on posts was a URL string.

### After
- **Cloud Storage** is used for file uploads via `admin.storage()`
- Storage security rules restrict uploads to authenticated users
- Files are limited to 10MB
- Avatars and post images are stored in Cloud Storage buckets

### Storage Rules

```
allow read: if true;
allow write: if request.auth != null && request.resource.size < 10 * 1024 * 1024;
```

---

## Step-by-Step Instructions for Running Locally

### Prerequisites

1. **Node.js 20+** installed (`node -v` should show v20+)
2. **Firebase CLI** installed:
   ```bash
   npm install -g firebase-tools
   ```
3. **Firebase project** `faith-social-ef895` with Firestore, Auth, and Cloud Storage enabled
4. **Git** (for cloning the project)

---

### Step 1: Clone and Navigate

```bash
git clone <repo-url>
cd faith-buddies_backend
```

### Step 2: Install Dependencies

```bash
# Root dependencies (firebase-tools for CLI)
npm install

# Functions dependencies
cd functions
npm install
cd ..
```

### Step 3: Configure Environment

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

Edit `.env`:
```
FIREBASE_PROJECT_ID=faith-social-ef895
GEMINI_API_KEY=your-gemini-api-key-here
```

**Note:** Firebase Admin SDK credentials are auto-provided by the emulator. For production deployment, set `FIREBASE_SERVICE_ACCOUNT_KEY` in your CI/CD environment or Firebase Console > Functions > Runtime secrets.

### Step 4: Start the Emulator Suite

```bash
# Start all emulators (Functions, Firestore, Storage)
firebase emulators:start
```

Or start specific emulators:

```bash
# Functions only
firebase emulators:start --only functions

# Functions + Firestore
firebase emulators:start --only functions,firestore

# Functions + Firestore + Storage
firebase emulators:start --only functions,firestore,storage
```

### Step 5: Access the Emulators

Once running, the API is available at:

| Service | URL |
|---|---|
| Cloud Functions | `http://localhost:5001` |
| Firestore Emulator | `http://localhost:8080` |
| Storage Emulator | `http://localhost:9199` |

The full API base URL is: `http://localhost:5001/faith-social-ef895/us-central1/api/`

### Step 6: Test Endpoints

Register a user (Firebase Auth must be set up in the emulator):

```bash
curl -X POST http://localhost:5001/faith-social-ef895/us-central1/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"uid": "test-uid-123", "email": "test@example.com", "displayName": "Test User"}'
```

Create a post:

```bash
curl -X POST http://localhost:5001/faith-social-ef895/us-central1/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <firebase-id-token>" \
  -d '{"content": "Hello from Faith Buddies!"}'
```

### Step 7: Seed Test Data in Firestore Emulator UI

Open the Firestore Emulator UI at `http://localhost:8080` (the port shown in terminal output). You can manually create documents, view collections, and inspect data.

### Step 8: Run Tests (when available)

```bash
cd functions
npm test
```

### Step 9: Deploy to Production

```bash
firebase deploy
```

This deploys:
- Cloud Functions (to Firebase Functions)
- Firestore rules and indexes
- Storage rules

---

## Client-Side Integration

The frontend must be updated to use Firebase Authentication and call the new Cloud Functions URLs:

1. **Auth**: Use Firebase client SDK (`signInWithPopup`, `signInAnonymously`, etc.) to get ID tokens
2. **Token passing**: Include `Authorization: Bearer <idToken>` header on all API requests
3. **API base URL** (emulator): `http://localhost:5001/faith-social-ef895/us-central1/api/`
4. **API base URL** (production): `https://<region>-<project-id>.cloudfunctions.net/api/`

### Firebase Client SDK Setup (Frontend)

```js
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
```

---

## Firebase Emulator Suite CLI Commands Quick Reference

| Command | Description |
|---|---|
| `firebase emulators:start` | Start all emulators |
| `firebase emulators:start --only functions` | Start Functions emulator only |
| `firebase emulators:start --only firestore` | Start Firestore emulator only |
| `firebase emulators:start --only storage` | Start Storage emulator only |
| `firebase emulators:exec "npm test"` | Run tests against emulator environment |
| `firebase emulators:export ./emulator-data` | Export emulator data to directory |
| `firebase emulators:import ./emulator-data` | Import data into emulator |
| `firebase deploy` | Deploy all resources to production |
| `firebase deploy --only functions` | Deploy Functions only |
| `firebase deploy --only firestore` | Deploy Firestore rules + indexes only |
| `firebase deploy --only storage` | Deploy Storage rules only |

---

## Security Rules Summary

The `firestore.rules` file enforces:

- **Users**: Can read all users, can only write their own profile
- **Posts**: Authenticated users can read; only the author can create/update/delete
- **Likes**: Only the liking user can create/delete their like
- **Comments**: Authenticated users can read; only the author can create/update/delete
- **Follows**: Authenticated users can read; users can only follow/unfollow themselves
- **Chats**: Users can only read/write their own chat and messages
- **Feed**: Users can read their own feed; writes are server-only (via Cloud Functions)

---

## Migration Checklist

- [x] Firestore collections and subcollections designed
- [x] Firebase Admin SDK replacing custom JWT/bcrypt
- [x] All Express routes converted to Firebase v2 Cloud Functions
- [x] Firestore triggers for feed denormalization
- [x] Cloud Storage rules for file uploads
- [x] Firestore RBAC rules drafted
- [x] Emulator setup instructions documented
- [ ] Frontend updated to use Firebase Auth client SDK
- [ ] Frontend updated to call new Cloud Functions URLs
- [ ] Firebase project created with Firestore, Auth, Storage enabled
- [ ] Production deployment tested
- [ ] CI/CD pipeline updated for Firebase deploy