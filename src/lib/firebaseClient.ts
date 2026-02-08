import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

import { FirebaseApp } from "firebase/app";

// Initialize Firebase (server-side safe)
let app: FirebaseApp | undefined;
let auth: ReturnType<typeof getAuth> | undefined;

if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
} else {
  console.warn("Firebase Config Error: Missing NEXT_PUBLIC_FIREBASE_API_KEY in .env.local");
}

export { app, auth };
