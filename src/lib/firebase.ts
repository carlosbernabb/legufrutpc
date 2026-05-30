import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCR-Y51_I-jVxai97nvXuAkIugNkAmRvWY",
  authDomain: "legufrut-71350.firebaseapp.com",
  projectId: "legufrut-71350",
  storageBucket: "legufrut-71350.firebasestorage.app",
  messagingSenderId: "951790695087",
  appId: "1:951790695087:web:07c1f3c6875d6f3d4a9a5a",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);
