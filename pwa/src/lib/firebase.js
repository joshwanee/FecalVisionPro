/**
 * Firebase configuration and initialization.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBTShvEiT8P3_n8DT9fFKDp8X2UfRYDDk0",
  authDomain: "fecalvision-514d1.firebaseapp.com",
  projectId: "fecalvision-514d1",
  storageBucket: "fecalvision-514d1.firebasestorage.app",
  messagingSenderId: "242521753275",
  appId: "1:242521753275:web:b65f85047ad3719a66cb9e",
  measurementId: "G-0TLLWK26C7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

  