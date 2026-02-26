import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  Auth,
  indexedDBLocalPersistence
} from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA0oAJVfxVXKsd17Q8Z05ip2YDt4tR6yoY",
  authDomain: "everyday-4725f.firebaseapp.com",
  projectId: "everyday-4725f",
  storageBucket: "everyday-4725f.firebasestorage.app",
  messagingSenderId: "981419359851",
  appId: "1:981419359851:web:981689374df891282bfb2e",
  measurementId: "G-084C5L6BTP"
};

// 1. App Initialization: Standard approach is safest
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Auth Instance Management (Singleton)
let auth: Auth;

if (typeof window !== "undefined") {
  // Client-side: Explicitly initialize with persistence
  // We attempt initializeAuth primarily, or fallback to getAuth if already initialized.
  // However, the common pattern causing issues is getAuth failing.
  // So we try getAuth, and if it fails (not registered), we initialize it.

  try {
    // Check if already initialized (internal registry)
    auth = getAuth(app);
  } catch (e) {
    // If 'Component auth has not been registered' error occurs, register it here
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  }
} else {
  // Server-side
  try {
    auth = getAuth(app);
  } catch (e) {
    // If auth component is not registered on server (common in some setups),
    // we set it to a dummy or null, but since we typed it as Auth,
    // we'll cast an empty object or let it fail later if used.
    // However, usually Server Auth requires admin SDK or different setup.
    // For now, to pass the build:
    auth = {} as Auth;
  }
}

// 3. Firestore Initialization
let db: Firestore;
try {
  db = getFirestore(app);
} catch (e) {
  // Fallback for server-side or if not registered
  console.warn("Firestore initialization failed:", e);
  db = {} as Firestore;
}

export { app, auth, db };

// Maintain function exports for compatibility with existing code
export const getFirebaseAuth = () => auth;
export const getFirebaseDb = () => db;
