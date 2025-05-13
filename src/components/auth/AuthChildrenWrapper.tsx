// src/components/auth/AuthChildrenWrapper.tsx
"use client";

import type { ReactNode } from 'react';

export default function AuthChildrenWrapper({ children }: { children: ReactNode }) {
  // This component doesn't need to do much.
  // Its main purpose is to ensure that {children} are rendered
  // explicitly within a client component that is itself a direct child
  // of AuthContext.Provider. This can help with context propagation
  // in mixed Server/Client Component trees.
  return <>{children}</>;
}
