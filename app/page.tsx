"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Wallet, IndianRupee, TrendingUp, Users, ArrowRight } from "lucide-react";
import { RevenueChart, StatusChart } from "@/components/dashboard-charts";

export default function DashboardPage() {
  const sales     = useLiveQuery(() => db.sales.toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);

  const today = format(new Date(), "yyyy-MM-dd");

  const totalRevenue   = sales?.reduce((s, r) => s + r.totalAmount, 0) ?? 0;
  const todayRevenue   = sales?.filter(r => r.date.startsWith(today)).reduce((s, r) => s + r.totalAmount, 0) ?? 0;
  const pendingBalance = sales?.filter(r => r.status !== "Paid").reduce((s, r) => s + r.balance, 0) ?? 0;
  const totalCustomers = customers?.length ?? 0;

  // 5 most recent sales for the activity feed
  const recentSales = sales
    ?.slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const STATUS_STYLES = {
    Paid:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    Partial: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
    Pending: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  } as const;

  const statCards = [
    { label: "Total Revenue",    value: `₹${totalRevenue.toLocaleString("en-IN")}`,   sub: "Lifetime earnings",    icon: IndianRupee,   color: "text-primary" },
    { label: "Today's Sales",    value: `₹${todayRevenue.toLocaleString("en-IN")}`,   sub: "Generated today",      icon: TrendingUp,    color: "text-emerald-500" },
    { label: "Total Customers",  value: totalCustomers,                                sub: "Registered profiles",  icon: Users,         color: "" },
    { label: "Pending Payments", value: `₹${pendingBalance.toLocaleString("en-IN")}`, sub: "Outstanding balance",  icon: Wallet,        color: pendingBalance > 0 ? "text-red-500" : "text-emerald-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your shop's performance.</p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Last 7 days revenue trend</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <RevenueChart />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Payment Status</CardTitle>
            <CardDescription>Distribution across all sales</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusChart />
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Sales ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>Last 5 transactions</CardDescription>
          </div>
          <Link href="/records" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {!recentSales || recentSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mb-3 opacity-20" />
              <p className="font-medium">No sales yet</p>
              <p className="text-sm">
                <Link href="/add-sale" className="text-primary hover:underline">Add your first sale</Link>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <Link key={sale.id} href={`/customers/${sale.customerId}`}>
                  <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                        {sale.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{sale.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {sale.purchaseType.join(", ")} · {format(new Date(sale.date), "dd MMM yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[sale.status]}`}>
                        {sale.status}
                      </span>
                      <p className="font-semibold text-sm">₹{sale.totalAmount.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
