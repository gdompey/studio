
// src/components/layout/UserNav.tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, User as UserIcon, Settings, ShieldCheck, UserCog } from "lucide-react";
import Link from "next/link";
import { USER_ROLES } from "@/lib/constants";

export function UserNav() {
  const { user, signOut, role } = useAuth();

  if (!user) {
    return null; // Or a sign-in button if appropriate for the context
  }

  const getInitials = (name?: string | null) => {
    if (!name) return user?.email?.[0]?.toUpperCase() || "U";
    const names = name.split(' ');
    if (names.length > 1) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-primary">
            <AvatarImage src={user.avatarUrl || undefined} alt={user.name || user.email || "User"} />
            <AvatarFallback className="bg-muted text-muted-foreground font-semibold">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
             {role && <p className="text-xs leading-none text-accent capitalize mt-1">{role}</p>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/profile" className="cursor-pointer"> 
              <UserCog className="mr-2 h-4 w-4" />
              <span>My Profile</span>
            </Link>
          </DropdownMenuItem>
          {role === USER_ROLES.ADMIN && (
            <DropdownMenuItem asChild>
              <Link href="/admin" className="cursor-pointer">
                <ShieldCheck className="mr-2 h-4 w-4" />
                <span>Admin Panel</span>
              </Link>
            </DropdownMenuItem>
          )}
           {role === USER_ROLES.ADMIN && (
            <DropdownMenuItem asChild>
             <Link href="/admin/settings" className="cursor-pointer"> 
              <Settings className="mr-2 h-4 w-4" />
              <span>App Settings</span>
            </Link>
          </DropdownMenuItem>
           )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive-foreground focus:bg-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
