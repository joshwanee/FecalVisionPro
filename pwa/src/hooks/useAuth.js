import { useCallback, useEffect, useRef, useState } from 'react';
import { copyGuestHistoryToAccount, reassignGuestHistory, syncScans } from '../lib/history';
import { supabase } from '../lib/supabase';

const GUEST_KEY = 'fecalvision-guest-session';
const GUEST_AUTH_SESSION_KEY = 'fecalvision-guest-auth-session';
const GUEST_MIGRATION_KEY = 'fecalvision-pending-guest-migration';

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const parts = [
      error.message,
      error.details,
      error.hint,
      error.code ? `Code: ${error.code}` : null,
    ].filter((part, index, values) => typeof part === 'string' && part && values.indexOf(part) === index);
    if (parts.length) return parts.join(' ');
    try {
      return JSON.stringify(error);
    } catch {
      return 'An unknown sync error occurred.';
    }
  }
  return typeof error === 'string' ? error : 'An unknown sync error occurred.';
}

function getGuestMode() {
  try {
    if (localStorage.getItem(GUEST_KEY) === '1') return true;
    if (sessionStorage.getItem(GUEST_KEY) === '1') {
      localStorage.setItem(GUEST_KEY, '1');
      sessionStorage.removeItem(GUEST_KEY);
      return true;
    }
  } catch (error) {
    console.warn('Could not read the saved guest mode:', error);
  }
  return false;
}

function setGuestMode(active) {
  try {
    if (active) localStorage.setItem(GUEST_KEY, '1');
    else localStorage.removeItem(GUEST_KEY);
    sessionStorage.removeItem(GUEST_KEY);
  } catch (error) {
    console.warn('Could not persist guest mode:', error);
  }
}

function getPendingGuestMigration(userId) {
  try {
    const guestUserId = sessionStorage.getItem(GUEST_MIGRATION_KEY);
    return guestUserId && guestUserId !== userId ? guestUserId : null;
  } catch {
    return null;
  }
}

function saveGuestAuthSession(session) {
  if (!session?.user?.is_anonymous || !session.access_token || !session.refresh_token) return;
  try {
    localStorage.setItem(GUEST_AUTH_SESSION_KEY, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }));
  } catch (error) {
    console.warn('Could not persist this browser’s guest session:', error);
  }
}

function readGuestAuthSession() {
  try {
    const stored = localStorage.getItem(GUEST_AUTH_SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Could not read this browser’s saved guest session:', error);
    return null;
  }
}

function clearGuestAuthSession() {
  try {
    localStorage.removeItem(GUEST_AUTH_SESSION_KEY);
  } catch (error) {
    console.warn('Could not clear this browser’s saved guest session:', error);
  }
}

/**
 * Auth hook.
 *
 * Returns:
 *  - user: Supabase Auth user object, or null
 *  - isGuest: true when the user chose "Continue as Guest"
 *  - loading: true while Supabase checks the initial auth state
 *  - loginWithGoogle: redirects to Google sign-in through Supabase
 *  - continueAsGuest: restores this browser's saved anonymous Supabase session
 *  - logout: signs out or clears the guest flag
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(
    supabase ? null : 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  );
  const [signingIn, setSigningIn] = useState(false);
  const [isGuest, setIsGuest] = useState(getGuestMode);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError] = useState(null);
  const syncing = useRef(false);
  const syncQueued = useRef(false);
  const resolvingGuest = useRef(false);
  const migratingGuest = useRef(false);

  useEffect(() => {
    if (!supabase) return undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      const guest = Boolean(currentUser?.is_anonymous && getGuestMode());
      if (currentUser?.is_anonymous) saveGuestAuthSession(session);
      if (!currentUser) setSyncStatus('idle');
      setUser(currentUser?.is_anonymous && !guest ? null : currentUser);
      setIsGuest(guest);
      if (currentUser && !currentUser.is_anonymous) setGuestMode(false);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!supabase || !isGuest || user || resolvingGuest.current) return undefined;
    let active = true;
    resolvingGuest.current = true;
    const resolveGuest = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        if (data.session?.user?.is_anonymous) {
          setUser(data.session.user);
          return;
        }
        const savedGuestSession = readGuestAuthSession();
        if (savedGuestSession?.access_token && savedGuestSession?.refresh_token) {
          const { data: savedSession, error: restoreError } =
            await supabase.auth.setSession(savedGuestSession);
          if (!restoreError && savedSession.session?.user?.is_anonymous) {
            saveGuestAuthSession(savedSession.session);
            if (active) setUser(savedSession.session.user);
            return;
          }
          if (restoreError && ![400, 401].includes(restoreError.status)) throw restoreError;
          clearGuestAuthSession();
        }
        if (!online) return;

        const { data: anonymousSession, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) throw signInError;
        if (active) setUser(anonymousSession.user);
      } catch (error) {
        if (active) {
          console.error('Guest cloud account setup failed:', error);
          setSyncStatus('error');
          setSyncError(getErrorMessage(error));
          setAuthError('Guest scans are saved on this device, but cloud sync could not start. Check Supabase anonymous sign-ins and try again.');
        }
      } finally {
        resolvingGuest.current = false;
      }
    };
    void resolveGuest();
    return () => { active = false; };
  }, [isGuest, online, user]);

  const runSync = useCallback(async () => {
    if (!user || (user.is_anonymous && !isGuest)) return;
    if (!user.is_anonymous && getPendingGuestMigration(user.id)) return;
    if (!online) {
      setSyncStatus('offline');
      return;
    }
    if (syncing.current) {
      syncQueued.current = true;
      return;
    }

    syncing.current = true;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      await syncScans(user.id);
      setSyncStatus('synced');
    } catch (error) {
      const staleGuestToken =
        user.is_anonymous &&
        /user from sub claim in jwt does not exist/i.test(getErrorMessage(error));
      if (staleGuestToken) {
        resolvingGuest.current = true;
        try {
          const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
          if (signOutError) throw signOutError;
          const { data: newSession, error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) throw signInError;

          await reassignGuestHistory(user.id, newSession.user.id);
          setUser(newSession.user);
          await syncScans(newSession.user.id);
          setSyncError(null);
          setSyncStatus('synced');
        } catch (recoveryError) {
          console.error('Could not recover deleted guest account:', recoveryError);
          window.dispatchEvent(new Event('fecalvision:history-synced'));
          setSyncError(getErrorMessage(recoveryError));
          setSyncStatus('error');
        } finally {
          resolvingGuest.current = false;
        }
      } else {
        console.error('Scan history sync failed:', error);
        window.dispatchEvent(new Event('fecalvision:history-synced'));
        setSyncError(getErrorMessage(error));
        setSyncStatus('error');
      }
    } finally {
      syncing.current = false;
      if (syncQueued.current) {
        syncQueued.current = false;
        window.setTimeout(
          () => window.dispatchEvent(new Event('fecalvision:history-local-changed')),
          0,
        );
      }
    }
  }, [isGuest, online, user]);

  useEffect(() => {
    if (!user || (user.is_anonymous && !isGuest)) return undefined;
    const sync = () => { void runSync(); };
    const handleVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    window.addEventListener('fecalvision:history-local-changed', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', handleVisible);
    sync();
    return () => {
      window.removeEventListener('fecalvision:history-local-changed', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [isGuest, runSync, user]);

  useEffect(() => {
    if (!user || user.is_anonymous || !supabase) return undefined;
    const guestUserId = getPendingGuestMigration(user.id);
    if (!guestUserId || migratingGuest.current) return undefined;

    migratingGuest.current = true;
    const migrateGuestHistory = async () => {
      setSyncStatus('syncing');
      try {
        if (!navigator.onLine) {
          throw new Error('Connect to the internet to finish copying guest scans to Google.');
        }
        await copyGuestHistoryToAccount(guestUserId, user.id);
        await syncScans(user.id);
        sessionStorage.removeItem(GUEST_MIGRATION_KEY);
        setSyncError(null);
        setSyncStatus('synced');
      } catch (error) {
        console.error('Could not copy guest history to Google account:', error);
        setSyncError(getErrorMessage(error));
        setSyncStatus('error');
      } finally {
        migratingGuest.current = false;
      }
    };
    void migrateGuestHistory();
    return undefined;
  }, [online, user]);

  const loginWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    if (!supabase) {
      setAuthError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      setSigningIn(false);
      return;
    }

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const guestUser = sessionData.session?.user?.is_anonymous
        ? sessionData.session.user
        : user?.is_anonymous ? user : null;
      if (guestUser) {
        if (!navigator.onLine) {
          throw new Error('Connect to the internet before switching to Google so guest cloud scans can be included.');
        }
        await syncScans(guestUser.id);
        sessionStorage.setItem(GUEST_MIGRATION_KEY, guestUser.id);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      console.error('Google sign-in failed:', err);
      const message = err.message || 'Google sign-in failed. Please try again.';
      setAuthError(message);
      setSigningIn(false);
      try {
        sessionStorage.removeItem(GUEST_MIGRATION_KEY);
      } catch {
        /* The sign-in error is still surfaced in the UI. */
      }
    }
  }, [user]);

  const continueAsGuest = useCallback(async () => {
    resolvingGuest.current = true;
    setIsGuest(true);
    setGuestMode(true);
    setAuthError(null);
    if (!supabase) {
      resolvingGuest.current = false;
      return;
    }

    setUser(null);
    try {
      const savedGuestSession = readGuestAuthSession();
      if (savedGuestSession?.access_token && savedGuestSession?.refresh_token) {
        const { data, error } = await supabase.auth.setSession(savedGuestSession);
        if (!error && data.session?.user?.is_anonymous) {
          saveGuestAuthSession(data.session);
          setUser(data.session.user);
          return;
        }

        if (error && ![400, 401].includes(error.status)) throw error;
        clearGuestAuthSession();
      }

      const { data: current, error: currentError } = await supabase.auth.getSession();
      if (currentError) throw currentError;
      if (current.session?.user?.is_anonymous) {
        saveGuestAuthSession(current.session);
        setUser(current.session.user);
        return;
      }

      if (!navigator.onLine) return;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      saveGuestAuthSession(data.session);
      setUser(data.user);
    } catch (error) {
      console.error('Could not restore this browser’s guest account:', error);
      setSyncStatus('error');
      setSyncError(getErrorMessage(error));
      setAuthError('Could not restore the guest account on this device. Guest scans remain available locally; check your connection and try again.');
    } finally {
      resolvingGuest.current = false;
    }
  }, []);

  return {
    user,
    isGuest,
    loading,
    authError,
    signingIn,
    syncStatus,
    syncError,
    loginWithGoogle,
    continueAsGuest,
  };
}
