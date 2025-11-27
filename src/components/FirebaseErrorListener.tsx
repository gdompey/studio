// src/components/FirebaseErrorListener.tsx
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import type { FirestorePermissionError } from '@/firebase/errors';
import { useAuth } from '@/hooks/useAuth';

export function FirebaseErrorListener() {
  const { user } = useAuth();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // Log the current user's auth state for debugging context.
      // This is crucial for debugging security rules.
      console.error("Firebase Auth context for the failed request:", user);

      // Re-throw the rich error so Next.js's development overlay can display it.
      // This provides immediate, actionable feedback in the browser during development.
      throw error;
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      // It's good practice to remove listeners, though for a root component this is less critical.
      // Emitter 'off' method would be needed in EventEmitter implementation.
    };
  }, [user]);

  // This component does not render anything.
  return null;
}
