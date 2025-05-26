
// src/app/(app)/admin/settings/page.tsx
"use client";

import { useAuth } from '@/hooks/useAuth';
import { USER_ROLES } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, Settings, Construction } from 'lucide-react';

export default function AdminSettingsPage() {
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
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold text-primary">Application Settings</CardTitle>
          </div>
          <CardDescription className="text-lg">
            Configure global settings and parameters for the application. (Admin only)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center text-center min-h-[200px]">
            <Construction className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              This section is under construction.
            </p>
            <p className="text-sm text-muted-foreground">
              Application-wide settings will be configurable here in a future update.
            </p>
        </CardContent>
      </Card>
      
      {/* Example placeholder for future settings sections */}
      <Card>
        <CardHeader>
            <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">Placeholder for general app settings...</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
            <CardTitle>Integration Settings</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">Placeholder for API keys or third-party integrations...</p>
        </CardContent>
      </Card>
    </div>
  );
}
