import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="mx-auto max-w-7xl h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
