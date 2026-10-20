import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

const GUEST_KEY = 'fecalvision-guest-session';

async function saveUserToFirestore(firebaseUser) {
  const ref = doc(db, 'users', firebaseUser.uid);
  await setDoc(ref, {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
    lastLogin: serverTimestamp(),
  }, { merge: true });
  console.log('User saved to Firestore:', firebaseUser.uid);
}

/**
 * Auth hook.
 *
 * Returns:
 *  - user: Firebase user object, or null
 *  - isGuest: true when the user chose "Continue as Guest"
 *  - loading: true while Firebase checks the initial auth state
 *  - loginWithGoogle: opens Google sign-in popup
 *  - continueAsGuest: marks the session as guest (persists in sessionStorage)
 *  - logout: signs out or clears the guest flag
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [isGuest, setIsGuest] = useState(() => {
    try {
      return sessionStorage.getItem(GUEST_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (!firebaseUser) return;

      try {
        await saveUserToFirestore(firebaseUser);
      } catch (err) {
        console.error('Firestore write failed:', err);
        setAuthError('Signed in, but your profile could not be saved. Check your Firestore rules and try again.');
      }
    });
    return unsub;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      // popup-closed-by-user is not a real error, ignore it
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        console.error('Google sign-in failed:', err.code, err.message);
        setAuthError(err.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    setIsGuest(true);
    try {
      sessionStorage.setItem(GUEST_KEY, '1');
    } catch {
      /* guest flag lives only in memory */
    }
  }, []);

  const logout = useCallback(async () => {
    // Clear guest flag first so the landing page shows.
    setIsGuest(false);
    try {
      sessionStorage.removeItem(GUEST_KEY);
    } catch {
      /* no-op */
    }
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Sign-out failed:', err);
    }
  }, []);

  return { user, isGuest, loading, authError, signingIn, loginWithGoogle, continueAsGuest, logout };
}
