"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, ClipboardList, Wallet, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import { Button } from "./ui/button";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/add-sale", label: "Add Sale", icon: PlusCircle },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/records", label: "Sales Records", icon: ClipboardList },
  { href: "/payments", label: "Pending Payments", icon: Wallet },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useStore();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity md:hidden",
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r shadow-sm transition-transform md:translate-x-0 md:static md:flex md:flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <Image src="/logo.svg" alt="Shree Opticals Logo" width={36} height={36} className="shrink-0" />
            <span className="text-primary text-lg font-bold tracking-tight leading-tight">Shree<br/>Opticals</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>

        <nav className="flex-1 overflow-auto py-4">
          <ul className="grid gap-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                      isActive
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
