// src/app/(app)/dashboard/page.tsx
"use client";

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FilePlus2, Eye, BarChart3 } from 'lucide-react';
import { USER_ROLES } from '@/lib/constants';

export default function DashboardPage() {
  const { user, role } = useAuth();

  if (!user) return null; // Should be handled by layout

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary">Welcome, {user.name || user.email}!</CardTitle>
          <CardDescription className="text-lg">
            You are logged in as an <span className="font-semibold text-accent">{role === USER_ROLES.ADMIN ? 'Administrator' : 'Inspector'}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Manage vehicle inspections efficiently and generate comprehensive reports.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {role === USER_ROLES.INSPECTOR && (
          <Card className="hover:shadow-xl transition-shadow">
            <CardHeader>
              <FilePlus2 className="h-10 w-10 text-accent mb-2" />
              <CardTitle>New Inspection</CardTitle>
              <CardDescription>Start a new vehicle inspection checklist.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href="/inspections/new">Start Inspection</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="hover:shadow-xl transition-shadow">
          <CardHeader>
            <Eye className="h-10 w-10 text-primary mb-2" />
            <CardTitle>View Inspections</CardTitle>
            <CardDescription>Review past and ongoing inspections.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/inspections">Browse Inspections</Link>
            </Button>
          </CardContent>
        </Card>
        
        {role === USER_ROLES.ADMIN && (
           <Card className="hover:shadow-xl transition-shadow">
            <CardHeader>
              <BarChart3 className="h-10 w-10 text-destructive mb-2" />
              <CardTitle>Admin Analytics</CardTitle>
              <CardDescription>Access overall data and analytics.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin">Go to Admin Panel</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Placeholder for recent activity or important notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No recent activity to display.</p>
          {/* TODO: List recent inspections or system notifications */}
        </CardContent>
      </Card>
    </div>
  );
}
