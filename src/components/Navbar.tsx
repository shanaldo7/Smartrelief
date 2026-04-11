"use client"

import Link from "next/link";
import { Heart, LayoutDashboard, UserPlus, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tasks/new", label: "Post Task", icon: ClipboardList },
    { href: "/volunteers/new", label: "Join as Volunteer", icon: UserPlus },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Heart className="h-6 w-6 text-primary" fill="currentColor" />
          <span className="text-xl font-bold tracking-tight text-primary font-headline">Kindred Connect</span>
        </Link>
        <div className="hidden md:flex gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                pathname === item.href ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center md:hidden">
          {/* Mobile simple nav could go here, for now just links are fine */}
        </div>
      </div>
    </nav>
  );
}
