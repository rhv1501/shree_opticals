"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, Wifi, WifiOff, RefreshCw, CheckCircle2, LogOut } from "lucide-react";
import { ModeToggle } from "./mode-toggle";
import { Button } from "./ui/button";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import { syncToSheets } from "@/lib/sync";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function Topbar() {
  const { setSidebarOpen, isOnline, setIsOnline } = useStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const wasOffline = useRef(false);
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Auto-sync if we just recovered from offline
      if (wasOffline.current) {
        wasOffline.current = false;
        await runSync({ silent: false, isAutoSync: true });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOffline.current = true;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const online = navigator.onLine;
    setIsOnline(online);
    if (!online) wasOffline.current = true;

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIsOnline]);

  const runSync = async ({
    silent = false,
    isAutoSync = false,
  }: { silent?: boolean; isAutoSync?: boolean } = {}) => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const { synced } = await syncToSheets();
      if (synced === 0) {
        if (!silent) toast.info("Everything is already synced ✓");
      } else {
        setLastSynced(new Date());
        toast.success(
          isAutoSync
            ? `🔄 Back online — auto-synced ${synced} record(s) to Google Sheets!`
            : `✓ Synced ${synced} record(s) to Google Sheets!`
        );
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Sync failed: ${err.message ?? "Check credentials"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSync = () => {
    if (!isOnline) {
      toast.error("You're offline. Records will sync automatically when reconnected.");
      return;
    }
    runSync();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:justify-end md:px-6">
      {/* Mobile hamburger */}
      <div className="flex items-center md:hidden">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {/* Last synced hint */}
        {lastSynced && isOnline && (
          <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Synced {lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}

        {/* Manual Sync button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="h-8 gap-1.5 hidden sm:flex"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
          <span>{isSyncing ? "Syncing…" : "Sync"}</span>
        </Button>

        {/* Online / Offline badge */}
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border",
            isOnline
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              : "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
          )}
        >
          {isOnline ? (
            <>
              <Wifi className="h-3.5 w-3.5" />
              <span className="hidden sm:inline-block">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline-block">Offline</span>
            </>
          )}
        </div>

        <ModeToggle />

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
