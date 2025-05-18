// src/components/auth/AuthContext.tsx
"use client";

import type { User as FirebaseUserType } from 'firebase/auth'; // Renamed to avoid conflict
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  GoogleAuthProvider, 
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config'; 
import type { User } from '@/types';
import type { UserRole } from '@/lib/constants';
import { USER_ROLES } from '@/lib/constants';
import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (method: 'email' | 'google', credentials?: { email?: string; password?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  signUp?: (credentials: { email: string; password?: string; name?: string }) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUserType | null) => {
      if (firebaseUser) {
        const isAdmin = firebaseUser.email?.includes('admin'); // Simplified role logic
        const userRole = isAdmin ? USER_ROLES.ADMIN : USER_ROLES.INSPECTOR;
        
        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          avatarUrl: firebaseUser.photoURL,
          role: userRole,
        };
        setUser(appUser);
        // Store user in localStorage for non-Firebase specific quick access if needed elsewhere,
        // but Firebase's onAuthStateChanged is the source of truth.
        localStorage.setItem('iasl-user', JSON.stringify(appUser)); 
      } else {
        setUser(null);
        localStorage.removeItem('iasl-user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (method: 'email' | 'google', credentials?: { email?: string; password?: string }) => {
    setLoading(true);
    try {
      if (method === 'email') {
        if (!credentials?.email || !credentials.password) {
          throw new Error('Email and password are required for email sign-in.');
        }
        await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      } else if (method === 'google') {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
      // onAuthStateChanged will handle setUser and localStorage
      router.push('/dashboard');
    } catch (error) {
      console.error("Sign in failed", error);
      throw error; // Re-throw to be caught by form
    } finally {
      // setLoading(false) will be handled by onAuthStateChanged
    }
  }, [router]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will handle setUser(null) and localStorage
      router.push('/auth/signin');
    } catch (error) {
      console.error("Sign out failed", error);
      // Optionally handle sign-out errors
    } finally {
      // setLoading(false) will be handled by onAuthStateChanged
    }
  }, [router]);

  const signUp = useCallback(async (credentials: { email: string; password?: string; name?: string }) => {
    setLoading(true);
    if (!credentials.email || !credentials.password) {
        throw new Error("Email and password are required for sign up.");
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
      if (credentials.name && userCredential.user) {
        await updateProfile(userCredential.user, { displayName: credentials.name });
      }
      // onAuthStateChanged will handle setUser and localStorage.
      // It will also update with displayName after profile update.
      router.push('/dashboard');
    } catch (error) {
      console.error("Sign up failed", error);
      throw error; // Re-throw to be caught by form
    } finally {
      // setLoading(false) will be handled by onAuthStateChanged
    }
  }, [router]);

  const contextValue = useMemo(() => ({
    user,
    role: user?.role || null,
    loading: loading || !hasMounted,
    signIn,
    signOut,
    signUp
  }), [user, loading, signIn, signOut, signUp, hasMounted]);

  if (!hasMounted) {
    return null; 
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
