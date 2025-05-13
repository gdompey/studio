// src/components/auth/AuthContext.tsx
"use client";

import type { User } from '@/types';
import type { UserRole } from '@/lib/constants';
import { USER_ROLES } from '@/lib/constants';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation'; // Corrected import

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (method: 'email' | 'google', credentials?: { email?: string; password?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  signUp?: (credentials: { email?: string; password?: string; name?: string }) => Promise<void>; // Optional for now
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
    localStorage.setItem('iasl-user', JSON.stringify(mockUser));
    return mockUser;
  }
  throw new Error('Invalid credentials');
};

const mockSignOut = async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
  localStorage.removeItem('iasl-user');
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('iasl-user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const signIn = async (method: 'email' | 'google', credentials?: { email?: string; password?: string }) => {
    setLoading(true);
    try {
      const signedInUser = await mockSignIn(method, credentials);
      setUser(signedInUser);
      router.push('/dashboard');
    } catch (error) {
      console.error("Sign in failed", error);
      // Handle error (e.g., show toast)
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    await mockSignOut();
    setUser(null);
    router.push('/auth/signin');
    setLoading(false);
  };

  // Placeholder for sign up
  const signUp = async (credentials: { email?: string; password?: string; name?: string }) => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
    // In a real app, this would call your backend to create a user
    // For this mock, we'll just log and then sign them in
    console.log("Mock sign up with:", credentials);
    const newUser: User = {
      id: Date.now().toString(),
      email: credentials.email || 'new.user@example.com',
      name: credentials.name || 'New User',
      role: USER_ROLES.INSPECTOR, // Default to inspector
      avatarUrl: `https://i.pravatar.cc/150?u=${credentials.email || 'new.user'}`,
    };
    localStorage.setItem('iasl-user', JSON.stringify(newUser));
    setUser(newUser);
    router.push('/dashboard');
    setLoading(false);
  };


  return (
    <AuthContext.Provider value={{ user, role: user?.role || null, loading, signIn, signOut, signUp }}>
      {children}
    </AuthContext.Provider>
  );
};
