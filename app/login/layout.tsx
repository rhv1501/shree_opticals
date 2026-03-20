import { Suspense } from "react";
import type { ReactNode } from "react";

// Login page gets a bare layout — no sidebar, no topbar
export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Suspense>{children}</Suspense>
    </div>
  );
}
