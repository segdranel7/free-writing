import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, requireAuth } from '../firebase';
import type { AppUser } from '../types';

export function toAppUser(user: User): AppUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName
  };
}

export function listenForUser(onChange: (user: AppUser | null) => void) {
  if (!auth) {
    onChange(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, (user) => onChange(user ? toAppUser(user) : null));
}

export function signInWithGoogle() {
  const { auth, googleProvider } = requireAuth();
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  const { auth } = requireAuth();
  return signOut(auth);
}
