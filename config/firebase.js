import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let db, auth, adminInstance;


try {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  if (!serviceAccountKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not provided');
  }

  const serviceAccount = JSON.parse(serviceAccountKey);

  adminInstance = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  db = admin.firestore();
  auth = admin.auth();

  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.warn('⚠️  Firebase initialization failed:', error.message);
  console.warn('   Running in DEVELOPMENT MODE with mocked Firebase');
  
  // Create mock objects for development
  db = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => ({ exists: false, data: () => ({}) }),
        set: async () => ({}),
        update: async () => ({}),
        delete: async () => ({}),
      }),
      add: async () => ({ id: 'mock-id' }),
      where: () => ({
        where: () => ({
          where: () => ({
            get: async () => ({ empty: true, forEach: () => {} }),
            orderBy: () => ({
              startAt: () => ({
                endAt: () => ({
                  limit: () => ({
                    get: async () => ({ empty: true, docs: [] }),
                  }),
                }),
              }),
              endAt: () => ({
                limit: () => ({
                  get: async () => ({ empty: true, docs: [] }),
                }),
              }),
              get: async () => ({ empty: true, docs: [] }),
            }),
          }),
          get: async () => ({ empty: true, forEach: () => {} }),
        }),
        where: () => ({
          get: async () => ({ docs: [] }),
          where: () => ({
            get: async () => ({ docs: [] }),
          }),
        }),
        get: async () => ({ empty: true, docs: [] }),
        orderBy: () => ({
          startAt: () => ({
            endAt: () => ({
              limit: () => ({
                get: async () => ({ empty: true, docs: [] }),
              }),
            }),
          }),
          endAt: () => ({
            limit: () => ({
              get: async () => ({ empty: true, docs: [] }),
            }),
          }),
          get: async () => ({ empty: true, docs: [] }),
          limit: () => ({
            get: async () => ({ empty: true, docs: [] }),
          }),
        }),
        limit: () => ({
          get: async () => ({ empty: true, docs: [] }),
        }),
      }),
      orderBy: () => ({
        startAt: () => ({
          endAt: () => ({
            limit: () => ({
              get: async () => ({ empty: true, docs: [] }),
            }),
          }),
        }),
        endAt: () => ({
          limit: () => ({
            get: async () => ({ empty: true, docs: [] }),
          }),
        }),
        get: async () => ({ empty: true, docs: [] }),
        limit: () => ({
          get: async () => ({ empty: true, docs: [] }),
        }),
      }),
      limit: () => ({
        get: async () => ({ empty: true, docs: [] }),
      }),
      get: async () => ({ empty: true, docs: [], forEach: () => {} }),
    }),
  };

  auth = {
    verifyIdToken: async () => ({ uid: 'dev-user' }),
  };
}

export { db, auth, admin as adminInstance };
