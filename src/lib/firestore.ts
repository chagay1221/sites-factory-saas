import { getFirestore } from "firebase/firestore";
import { app } from "./firebaseClient";

// Initialize Cloud Firestore and get a reference to the service
// Initialize Cloud Firestore and get a reference to the service
const db = app ? getFirestore(app) : {} as ReturnType<typeof getFirestore>; // Safe fallback to prevent crash on module load

export { db };
