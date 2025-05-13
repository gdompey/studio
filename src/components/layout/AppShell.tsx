// src/components/layout/AppShell.tsx
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SidebarNav } from './SidebarNav';
import { UserNav } from './UserNav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger }  from '@/components/ui/sheet';
import { Menu, Shield } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  if (loading) {
    // You can return a full-page loader here if desired
    return <div className="flex h-screen items-center justify-center"><Shield className="h-16 w-16 animate-pulse text-primary" /></div>;
  }

  if (!user) {
    // This should ideally be handled by middleware or page-level checks redirecting to /auth/signin
    // For robustness, you might redirect here or show an access denied message.
    // For now, returning null as redirects should handle this.
    return null; 
  }
  
  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-primary-foreground">
          <Image src="https://picsum.photos/seed/appicon/40/40" alt="App Logo" width={32} height={32} className="rounded-md" data-ai-hint="shield gear"/>
          <span className="font-semibold text-lg">{APP_NAME}</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <SidebarNav />
      </div>
      <div className="p-4 border-t border-sidebar-border mt-auto">
        <p className="text-xs text-sidebar-foreground/60">&copy; {new Date().getFullYear()} {APP_NAME}</p>
      </div>
    </div>
  );


  return (
    <div className="min-h-screen flex flex-col bg-secondary/50">
      {isMobile ? (
        // Mobile Layout
        <>
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col p-0 w-[280px] bg-sidebar text-sidebar-foreground">
                {sidebarContent}
              </SheetContent>
            </Sheet>
             <Link href="/dashboard" className="flex items-center gap-2">
                <Image src="https://picsum.photos/seed/appicon/40/40" alt="App Logo" width={28} height={28} className="rounded-md" data-ai-hint="shield gear"/>
                <span className="font-semibold text-md text-primary">{APP_NAME}</span>
            </Link>
            <UserNav />
          </header>
          <main className="flex-1 p-4 sm:p-6 md:p-8">{children}</main>
        </>
      ) : (
        // Desktop Layout
        <div className="flex min-h-screen">
          <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-sidebar text-sidebar-foreground shadow-lg md:flex">
            {sidebarContent}
          </aside>
          <div className="flex flex-col flex-1 md:pl-64">
            <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-4 border-b bg-background px-4 md:px-8 shadow-sm">
              {/* You can add breadcrumbs or other header content here */}
              <UserNav />
            </header>
            <main className="flex-1 p-4 sm:p-6 md:p-8">
              <div className="bg-card p-6 rounded-lg shadow-md min-h-[calc(100vh-10rem)]">
                {children}
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
