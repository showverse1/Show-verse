// firebase.js - Shared Firebase Client Module for Show Verse
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  getFirestore, 
  setLogLevel,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache
} from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyCH-LYBYGMDRjkcu4RObtih_afuqzIsGGg",
  authDomain: "show-verse-901fe.firebaseapp.com",
  projectId: "show-verse-901fe",
  storageBucket: "show-verse-901fe.firebasestorage.app",
  messagingSenderId: "774807739924",
  appId: "1:774807739924:web:ef9f40adc12cfe557ad101"
};

let appInstance = null;
let authInstance = null;
let dbInstance = null;

try {
  appInstance = initializeApp(firebaseConfig);
  authInstance = getAuth(appInstance);
  
  try {
    // Silence internal Firestore transport connection retry logs
    setLogLevel('silent');
  } catch (_) {}

  try {
    dbInstance = initializeFirestore(appInstance, {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (cacheErr) {
    try {
      dbInstance = initializeFirestore(appInstance, {
        experimentalAutoDetectLongPolling: true,
        localCache: memoryLocalCache()
      });
    } catch (pollErr) {
      try {
        dbInstance = getFirestore(appInstance);
      } catch (getErr) {
        dbInstance = null;
      }
    }
  }
} catch (e) {
  // Silent fallback
  dbInstance = null;
}

export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;

if (typeof window !== "undefined") {
  window.showverseFirebase = { app, auth, db };
  window.db = db;
  window.auth = auth;
}
