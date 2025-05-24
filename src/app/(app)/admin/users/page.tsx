
// src/app/(app)/admin/users/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { USER_ROLES, SPECIAL_ADMIN_EMAIL } from '@/lib/constants'; // Import SPECIAL_ADMIN_EMAIL
import type { User } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, ShieldAlert, UsersIcon, KeyRound, UserCheck, UserX } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ManageUsersPage() {
  const { user: currentUser, role: currentUserRole, sendPasswordResetEmail } = useAuth();
  const { toast } = useToast();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (currentUserRole !== USER_ROLES.ADMIN) return;
    setLoading(true);
    try {
      const usersCollectionRef = collection(firestore, 'users');
      const querySnapshot = await getDocs(usersCollectionRef);
      const fetchedUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsersList(fetchedUsers.sort((a,b) => (a.name || a.email || '').localeCompare(b.name || b.email || '')));
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch users list." });
    } finally {
      setLoading(false);
    }
  }, [currentUserRole, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleAdminRole = async (targetUser: User) => {
    if (!currentUser || currentUser.id === targetUser.id && targetUser.email !== SPECIAL_ADMIN_EMAIL) {
      toast({ variant: "destructive", title: "Action Denied", description: "You cannot change your own role unless you are the super admin." });
      return;
    }
     if (targetUser.email === SPECIAL_ADMIN_EMAIL) {
      toast({ variant: "destructive", title: "Action Denied", description: "The role of the super admin cannot be changed." });
      return;
    }

    setUpdatingUserId(targetUser.id);
    const newRole = targetUser.role === USER_ROLES.ADMIN ? USER_ROLES.INSPECTOR : USER_ROLES.ADMIN;
    try {
      const userDocRef = doc(firestore, 'users', targetUser.id);
      await updateDoc(userDocRef, { role: newRole });
      toast({ title: "Success", description: `${targetUser.name || targetUser.email}'s role updated to ${newRole}.` });
      fetchUsers(); // Refresh list
    } catch (error) {
      console.error("Error updating role:", error);
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update user role." });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleToggleUserStatus = async (targetUser: User) => {
    if (!currentUser || currentUser.id === targetUser.id) {
      toast({ variant: "destructive", title: "Action Denied", description: "You cannot disable your own account." });
      return;
    }
    if (targetUser.email === SPECIAL_ADMIN_EMAIL) {
      toast({ variant: "destructive", title: "Action Denied", description: "The super admin account cannot be disabled." });
      return;
    }

    setUpdatingUserId(targetUser.id);
    const newDisabledStatus = !targetUser.isDisabled;
    try {
      const userDocRef = doc(firestore, 'users', targetUser.id);
      await updateDoc(userDocRef, { isDisabled: newDisabledStatus });
      // Note: This only updates the Firestore flag. Actual Firebase Auth disable requires Admin SDK (backend).
      toast({ title: "Success", description: `${targetUser.name || targetUser.email} has been ${newDisabledStatus ? 'disabled' : 'enabled'}. Full disable/enable takes effect via Firebase Auth backend.` });
      fetchUsers(); // Refresh list
    } catch (error) {
      console.error("Error updating user status:", error);
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update user status." });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handlePasswordReset = async (email: string | null) => {
    if (!email) {
      toast({ variant: "destructive", title: "Error", description: "User email is not available." });
      return;
    }
    setUpdatingUserId(email); // Use email as temp ID for loading state on button
    try {
      await sendPasswordResetEmail(email);
      // Toast is handled by AuthContext
    } catch (error) {
       // Toast is handled by AuthContext
    } finally {
      setUpdatingUserId(null);
    }
  };


  if (currentUserRole !== USER_ROLES.ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-destructive p-4">
        <ShieldAlert className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
            <UsersIcon className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold text-primary">User Management</CardTitle>
        </div>
        <CardDescription className="text-lg">
          View, assign roles, manage status, and initiate password resets for users.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-center">Admin</TableHead>
              <TableHead className="text-center">Enabled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersList.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === USER_ROLES.ADMIN ? "destructive" : "secondary"}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isDisabled ? "outline" : "default"} className={user.isDisabled ? "border-red-500 text-red-600" : "bg-green-500 hover:bg-green-600"}>
                    {user.isDisabled ? 'Disabled' : 'Enabled'}
                  </Badge>
                </TableCell>
                 <TableCell>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                <TableCell>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'N/A'}</TableCell>
                <TableCell className="text-center">
                  {updatingUserId === user.id ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
                    <Switch
                      id={`admin-switch-${user.id}`}
                      checked={user.role === USER_ROLES.ADMIN}
                      onCheckedChange={() => handleToggleAdminRole(user)}
                      disabled={user.email === SPECIAL_ADMIN_EMAIL || (currentUser?.id === user.id && user.email !== SPECIAL_ADMIN_EMAIL)}
                      aria-label={`Toggle admin role for ${user.name || user.email}`}
                    />
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {updatingUserId === user.id ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
                    <Switch
                      id={`status-switch-${user.id}`}
                      checked={!user.isDisabled}
                      onCheckedChange={() => handleToggleUserStatus(user)}
                      disabled={user.email === SPECIAL_ADMIN_EMAIL || currentUser?.id === user.id}
                      aria-label={`Toggle status for ${user.name || user.email}`}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                    />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={updatingUserId === user.email || !user.email?.includes('@')} // Basic check if it's an email user
                      >
                        {updatingUserId === user.email ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset Password for {user.name || user.email}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will send a password reset link to {user.email}. This action only applies to users who signed up with email and password. Are you sure?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handlePasswordReset(user.email)} className="bg-destructive hover:bg-destructive/90">
                          Send Reset Link
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {usersList.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No users found.</p>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          Note: Disabling a user here sets a flag in the database. Full account disable/enable in Firebase Authentication requires backend (Admin SDK) integration.
        </p>
      </CardContent>
    </Card>
  );
}
