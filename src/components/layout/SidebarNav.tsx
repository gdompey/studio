
// src/components/layout/SidebarNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { USER_ROLES } from "@/lib/constants";
import { LayoutDashboard, FileText, PlusCircle, Settings, ShieldAlert, Users, UserCog } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: (typeof USER_ROLES)[keyof typeof USER_ROLES][];
  exact?: boolean; // Optional: for exact path matching
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: [USER_ROLES.ADMIN, USER_ROLES.INSPECTOR] },
  { href: "/inspections/new", label: "New Inspection", icon: PlusCircle, roles: [USER_ROLES.INSPECTOR] },
  { href: "/inspections", label: "View Inspections", icon: FileText, roles: [USER_ROLES.ADMIN, USER_ROLES.INSPECTOR] },
  { href: "/admin", label: "Admin Panel", icon: ShieldAlert, roles: [USER_ROLES.ADMIN], exact: true },
  { href: "/admin/users", label: "Manage Users", icon: Users, roles: [USER_ROLES.ADMIN] },
  { href: "/admin/settings", label: "App Settings", icon: Settings, roles: [USER_ROLES.ADMIN] }, // Admin specific app settings
  { href: "/profile", label: "My Profile", icon: UserCog, roles: [USER_ROLES.ADMIN, USER_ROLES.INSPECTOR] }, // General user profile/settings
];

export function SidebarNav() {
  const pathname = usePathname();
  const { role } = useAuth();

  const filteredNavItems = navItems.filter(item => {
    if (!role) return false;
    return !item.roles || item.roles.includes(role);
  });

  return (
    <nav className="flex flex-col space-y-1">
      {filteredNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        
        // Special handling for dashboard to not be active if on /dashboard/*
        const isDashboardActive = item.href === "/dashboard" && pathname === "/dashboard";
        const finalIsActive = item.href === "/dashboard" ? isDashboardActive : isActive;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              finalIsActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground"
            )}
            aria-current={finalIsActive ? "page" : undefined}
          >
            <Icon className="mr-3 h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
