// src/components/layout/AppShell.tsx
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SidebarNav } from './SidebarNav';
import { UserNav } from './UserNav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle }  from '@/components/ui/sheet';
import { Menu, Shield, Wifi, WifiOff } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Badge } from '@/components/ui/badge';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const isOnline = useOnlineStatus();

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Shield className="h-16 w-16 animate-pulse text-primary" /></div>;
  }

  if (!user) {
    return null;
  }

  const OnlineStatusIndicator = () => (
    <Badge variant={isOnline ? "default" : "destructive"} className={`ml-auto mr-2 hidden md:flex items-center gap-1 ${isOnline ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white`}>
      {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      {isOnline ? "Online" : "Offline"}
    </Badge>
  );

  const MobileOnlineStatusIndicator = () => (
     <Badge variant={isOnline ? "default" : "destructive"} className={`mr-2 items-center gap-1 ${isOnline ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white px-2 py-1 text-xs`}>
      {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      <span className="sr-only">{isOnline ? "Online" : "Offline"}</span>
    </Badge>
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-primary-foreground">
          <Image src="/company-logo.png" alt="App Logo" width={32} height={32} className="rounded-md" data-ai-hint="company logo"/>
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
                <SheetTitle>
                  <span className="sr-only">Main Navigation Menu</span>
                </SheetTitle>
                {sidebarContent}
              </SheetContent>
            </Sheet>
             <Link href="/dashboard" className="flex items-center gap-2">
                <Image src="/company-logo.png" alt="App Logo" width={28} height={28} className="rounded-md" data-ai-hint="company logo"/>
                <span className="font-semibold text-md text-primary">{APP_NAME}</span>
            </Link>
            <div className="flex items-center gap-2">
              <MobileOnlineStatusIndicator />
              <UserNav />
            </div>
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
              <OnlineStatusIndicator />
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
