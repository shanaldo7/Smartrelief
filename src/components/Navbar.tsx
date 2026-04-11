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
    <nav className="sticky top-0 z-[5000] w-full border-b bg-background/90 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto max-w-[1400px]">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-primary p-1.5 rounded-lg group-hover:scale-105 transition-transform shadow-sm">
              <Zap className="h-5 w-5 text-primary-foreground" fill="currentColor" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter text-foreground font-headline uppercase leading-none">SmartRelief</span>
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-primary">Strategic Grid</span>
            </div>
          </Link>
          
          <div className="hidden lg:flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-lg border border-transparent",
                  pathname === item.href 
                    ? "bg-primary/5 text-primary border-primary/10" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Grid Online</span>
          </div>
          <Link href="/volunteers/new">
            <Badge className="bg-primary text-primary-foreground font-bold uppercase tracking-wider text-[9px] py-1 px-3 rounded-lg cursor-pointer hover:shadow-md transition-all">
              Join Mission
            </Badge>
          </Link>
        </div>
      </div>
    </nav>
  );
}