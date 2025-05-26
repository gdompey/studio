
// src/app/(app)/profile/page.tsx
"use client";

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserCog, Shield, Mail, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export default function ProfilePage() {
  const { user, role, sendPasswordResetEmail } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <p>Loading user profile...</p>
      </div>
    );
  }

  const getInitials = (name?: string | null) => {
    if (!name) return user?.email?.[0]?.toUpperCase() || "U";
    const names = name.split(' ');
    if (names.length > 1) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  const handlePasswordReset = async () => {
    if (user.email) {
      try {
        await sendPasswordResetEmail(user.email);
        // Toast is handled by AuthContext
      } catch (error) {
        // Toast is handled by AuthContext
      }
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserCog className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold text-primary">My Profile</CardTitle>
          </div>
          <CardDescription className="text-lg">
            View and manage your personal information and account settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
            <Avatar className="h-24 w-24 border-4 border-primary shadow-md">
              <AvatarImage src={user.avatarUrl || undefined} alt={user.name || user.email || "User"} />
              <AvatarFallback className="bg-muted text-muted-foreground text-3xl font-semibold">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-semibold text-foreground">{user.name || "User"}</h2>
              <p className="text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                <Mail className="h-4 w-4"/> {user.email}
              </p>
              <p className="text-accent capitalize flex items-center justify-center sm:justify-start gap-1 mt-1">
                <Shield className="h-4 w-4"/> Role: {role}
              </p>
            </div>
          </div>
          
          <Separator />

          <div>
            <h3 className="text-xl font-semibold text-foreground mb-3">Account Details</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <Label htmlFor="fullName" className="text-muted-foreground">Full Name</Label>
                <Input id="fullName" defaultValue={user.name || ""} disabled className="col-span-2 bg-secondary/50" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
                <Label htmlFor="email" className="text-muted-foreground">Email</Label>
                <Input id="email" type="email" defaultValue={user.email || ""} disabled className="col-span-2 bg-secondary/50" />
              </div>
            </div>
          </div>

          <Separator />
          
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-3">Security</h3>
             {/* Basic check if it's an email user - Google users don't manage passwords this way */}
            {user.email && !user.avatarUrl?.includes('googleusercontent.com') && (
                <Button onClick={handlePasswordReset} variant="outline">
                    Reset Password
                </Button>
            )}
             {user.avatarUrl?.includes('googleusercontent.com') && (
                <p className="text-sm text-muted-foreground">Password management is handled through your Google account.</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground pt-4">
            More profile management features like changing name, avatar, etc., will be available here in the future.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
