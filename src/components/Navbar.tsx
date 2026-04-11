"use client"

import Link from "next/link";
import { Zap, LayoutDashboard, UserPlus, ClipboardList, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { Badge } from "./ui/badge";

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Operational Hub", icon: LayoutDashboard },
    { href: "/tasks/new", label: "Request Support", icon: ClipboardList },
    { href: "/volunteers/new", label: "Join Responders", icon: UserPlus },
  ];

  return (
    <nav className="sticky top-0 z-[5000] w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-20 items-center justify-between px-4 mx-auto max-w-[1600px]">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-all active:scale-95 group">
            <div className="bg-primary p-2 rounded-xl group-hover:rotate-12 transition-transform">
              <Zap className="h-6 w-6 text-primary-foreground" fill="currentColor" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter text-foreground font-headline uppercase leading-none">SmartRelief</span>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">Strategic Grid</span>
            </div>
          </Link>
          
          <div className="hidden lg:flex gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-5 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-xl border-2 border-transparent",
                  pathname === item.href 
                    ? "bg-primary/5 text-primary border-primary/20 shadow-sm" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border-2 border-emerald-500/20 px-4 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Tactical Online</span>
          </div>
          <Link href="/volunteers/new">
            <Badge className="bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] py-1.5 px-4 rounded-xl cursor-pointer hover:scale-105 transition-transform">
              Secure Enrollment
            </Badge>
          </Link>
        </div>
      </div>
    </nav>
  );
}