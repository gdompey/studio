// src/components/auth/AuthContext.tsx
"use client";

import type { User } from '@/types';
import type { UserRole } from '@/lib/constants';
import { USER_ROLES } from '@/lib/constants';
import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
// import AuthChildrenWrapper from './AuthChildrenWrapper'; // Removed import

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (method: 'email' | 'google', credentials?: { email?: string; password?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  signUp?: (credentials: { email?: string; password?: string; name?: string }) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock authentication functions
const mockSignIn = async (method: 'email' | 'google', credentials?: { email?: string; password?: string }): Promise<User> => {
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
  if (method === 'google' || (credentials?.email && credentials.password)) {
    const isAdmin = credentials?.email?.includes('admin');
    const userRole = isAdmin ? USER_ROLES.ADMIN : USER_ROLES.INSPECTOR;
    const mockUser: User = {
      id: Date.now().toString(),
      email: credentials?.email || 'test.user@example.com',
      name: isAdmin ? 'Admin User' : 'Inspector Gadget',
      role: userRole,
      avatarUrl: `https://i.pravatar.cc/150?u=${credentials?.email || 'test.user'}`,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('iasl-user', JSON.stringify(mockUser));
    }
    return mockUser;
  }
  throw new Error('Invalid credentials');
};

const mockSignOut = async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
  if (typeof window !== 'undefined') {
    localStorage.removeItem('iasl-user');
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMounted, setHasMounted] = useState(false); // Added for hydration safety
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true); // Component has mounted
    const storedUser = localStorage.getItem('iasl-user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
        localStorage.removeItem('iasl-user');
      }
    }
    setLoading(false);
  }, []);

  const signIn = useCallback(async (method: 'email' | 'google', credentials?: { email?: string; password?: string }) => {
    setLoading(true);
    try {
      const signedInUser = await mockSignIn(method, credentials);
      setUser(signedInUser);
      router.push('/dashboard');
    } catch (error) {
      console.error("Sign in failed", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const signOut = useCallback(async () => {
    setLoading(true);
    await mockSignOut();
    setUser(null);
    router.push('/auth/signin');
    setLoading(false);
  }, [router]);

  const signUp = useCallback(async (credentials: { email?: string; password?: string; name?: string }) => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500)); 
    const newUser: User = {
      id: Date.now().toString(),
      email: credentials.email || 'new.user@example.com',
      name: credentials.name || 'New User',
      role: USER_ROLES.INSPECTOR, 
      avatarUrl: `https://i.pravatar.cc/150?u=${credentials.email || 'new.user'}`,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('iasl-user', JSON.stringify(newUser));
    }
    setUser(newUser);
    router.push('/dashboard');
    setLoading(false);
  }, [router]);

  const contextValue = useMemo(() => ({
    user,
    role: user?.role || null,
    loading: loading || !hasMounted, // Loading is true until mounted and actual loading is false
    signIn,
    signOut,
    signUp
  }), [user, loading, signIn, signOut, signUp, hasMounted]);

  // Render children only after mount to ensure localStorage access is client-side only
  // This prevents hydration mismatches related to auth state.
  if (!hasMounted) {
    return null; 
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
