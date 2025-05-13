// src/components/layout/SidebarNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { USER_ROLES } from "@/lib/constants";
import { LayoutDashboard, FileText, PlusCircle, Settings, ShieldAlert, Users } from "lucide-react"; // Users for Admin specific view

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: (typeof USER_ROLES)[keyof typeof USER_ROLES][];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: [USER_ROLES.ADMIN, USER_ROLES.INSPECTOR] },
  { href: "/inspections/new", label: "New Inspection", icon: PlusCircle, roles: [USER_ROLES.INSPECTOR] },
  { href: "/inspections", label: "View Inspections", icon: FileText, roles: [USER_ROLES.ADMIN, USER_ROLES.INSPECTOR] }, // Placeholder for listing
  { href: "/admin", label: "Admin Dashboard", icon: ShieldAlert, roles: [USER_ROLES.ADMIN] },
  { href: "/admin/users", label: "Manage Users", icon: Users, roles: [USER_ROLES.ADMIN] }, // Placeholder
  { href: "/settings", label: "Settings", icon: Settings, roles: [USER_ROLES.ADMIN, USER_ROLES.INSPECTOR] }, // Placeholder
];

export function SidebarNav() {
  const pathname = usePathname();
  const { role } = useAuth();

  const filteredNavItems = navItems.filter(item => {
    if (!role) return false; // Should not happen if sidebar is shown for logged-in users
    return !item.roles || item.roles.includes(role);
  });

  return (
    <nav className="flex flex-col space-y-1">
      {filteredNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="mr-3 h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
