
// src/app/(app)/admin/page.tsx
"use client";

import { useAuth } from '@/hooks/useAuth';
import { USER_ROLES } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, Users, BarChartHorizontalBig, Settings } from 'lucide-react'; // Added Settings
import Link from 'next/link';
import { Button } from '@/components/ui/button';


export default function AdminPage() {
  const { user, role } = useAuth();

  if (role !== USER_ROLES.ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-destructive p-4">
        <ShieldAlert className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
           <div className="flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold text-primary">Administrator Dashboard</CardTitle>
          </div>
          <CardDescription className="text-lg">
            Manage application settings, users, and view overall analytics.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-muted-foreground">Welcome, Admin {user?.name || user?.email}!</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-xl transition-shadow">
            <CardHeader>
              <Users className="h-10 w-10 text-accent mb-2" />
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage user accounts and roles.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href="/admin/users">Manage Users</Link>
              </Button>
            </CardContent>
          </Card>
        <Card className="hover:shadow-xl transition-shadow">
            <CardHeader>
              <BarChartHorizontalBig className="h-10 w-10 text-primary mb-2" />
              <CardTitle>System Analytics</CardTitle>
              <CardDescription>View overall inspection statistics and system health.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin/analytics">View Analytics</Link>
              </Button>
            </CardContent>
          </Card>
         <Card className="hover:shadow-xl transition-shadow">
            <CardHeader>
               <Settings className="h-10 w-10 text-destructive mb-2" />
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Configure application-wide settings and parameters.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin/settings">Configure Settings</Link>
              </Button>
            </CardContent>
          </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Pending Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No pending administrative tasks.</p>
          {/* TODO: List pending tasks or items requiring admin attention */}
        </CardContent>
      </Card>
    </div>
  );
}
