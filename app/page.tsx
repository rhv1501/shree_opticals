"use client";

import dynamic from "next/dynamic";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import Link from "next/link";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ClipboardList,
  Wallet,
  IndianRupee,
  TrendingUp,
  Users,
  ArrowRight,
  CalendarRange,
  CalendarDays,
  Calendar,
} from "lucide-react";
import type { Sale } from "@/types";

const RevenueChart = dynamic(
  () => import("@/components/dashboard-charts").then((mod) => mod.RevenueChart),
  {
    loading: () => (
      <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
        Loading chart...
      </div>
    ),
  },
);

const StatusChart = dynamic(
  () => import("@/components/dashboard-charts").then((mod) => mod.StatusChart),
  {
    loading: () => (
      <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
        Loading chart...
      </div>
    ),
  },
);

const safeFormatDate = (
  dateStr?: string,
  fmt = "dd MMM yyyy",
  fallback = "N/A",
) => {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? fallback : format(d, fmt);
};

export default function DashboardPage() {
  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);

  const dashboardStats = useMemo(() => {
    const totals = {
      totalRevenue: 0,
      todayRevenue: 0,
      pendingBalance: 0,
      weeklyRevenue: 0,
      monthlyRevenue: 0,
      yearlyRevenue: 0,
      weeklySalesCount: 0,
      monthlySalesCount: 0,
      yearlySalesCount: 0,
      recentSales: [] as Sale[],
    };

    if (!sales || sales.length === 0) {
      return totals;
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    totals.recentSales = sales
      .slice()
      .sort((a, b) => {
        const timeA = a.date ? parseISO(a.date).getTime() : 0;
        const timeB = b.date ? parseISO(b.date).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 5);

    for (const sale of sales) {
      totals.totalRevenue += sale.totalAmount;
      if (sale.date?.startsWith(today)) {
        totals.todayRevenue += sale.totalAmount;
      }
      if (sale.status !== "Paid") {
        totals.pendingBalance += sale.balance;
      }

      const saleDate = parseISO(sale.date);
      if (Number.isNaN(saleDate.getTime())) continue;

      if (saleDate >= weekStart && saleDate <= now) {
        totals.weeklyRevenue += sale.totalAmount;
        totals.weeklySalesCount += 1;
      }

      if (
        saleDate.getFullYear() === currentYear &&
        saleDate.getMonth() === currentMonth
      ) {
        totals.monthlyRevenue += sale.totalAmount;
        totals.monthlySalesCount += 1;
      }

      if (saleDate.getFullYear() === currentYear) {
        totals.yearlyRevenue += sale.totalAmount;
        totals.yearlySalesCount += 1;
      }
    }

    return totals;
  }, [sales]);

  const totalCustomers = customers?.length ?? 0;

  const {
    totalRevenue,
    todayRevenue,
    pendingBalance,
    weeklyRevenue,
    monthlyRevenue,
    yearlyRevenue,
    weeklySalesCount,
    monthlySalesCount,
    yearlySalesCount,
    recentSales,
  } = dashboardStats;

  const now = new Date();
  const weekStartLabel = startOfWeek(now, { weekStartsOn: 1 });
  const weekEndLabel = addDays(weekStartLabel, 6);
  const monthlyPeriodLabel = format(now, "MMM yyyy");
  const yearlyPeriodLabel = format(now, "yyyy");
  const weeklyPeriodLabel = `${format(weekStartLabel, "dd MMM")} - ${format(weekEndLabel, "dd MMM yyyy")}`;

  const STATUS_STYLES = {
    Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    Partial:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
    Pending: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  } as const;

  const statCards = [
    {
      label: "Total Revenue",
      value: `₹${totalRevenue.toLocaleString("en-IN")}`,
      sub: "Lifetime earnings",
      icon: IndianRupee,
      color: "text-primary",
    },
    {
      label: "Today's Sales",
      value: `₹${todayRevenue.toLocaleString("en-IN")}`,
      sub: "Generated today",
      icon: TrendingUp,
      color: "text-emerald-500",
    },
    {
      label: "Total Customers",
      value: totalCustomers,
      sub: "Registered profiles",
      icon: Users,
      color: "",
    },
    {
      label: "Pending Payments",
      value: `₹${pendingBalance.toLocaleString("en-IN")}`,
      sub: "Outstanding balance",
      icon: Wallet,
      color: pendingBalance > 0 ? "text-red-500" : "text-emerald-500",
    },
  ];

  const periodStats = [
    {
      label: "Weekly Sales",
      period: weeklyPeriodLabel,
      value: `₹${weeklyRevenue.toLocaleString("en-IN")}`,
      count: `${weeklySalesCount} sale${weeklySalesCount === 1 ? "" : "s"}`,
      icon: CalendarRange,
    },
    {
      label: "Monthly Sales",
      period: monthlyPeriodLabel,
      value: `₹${monthlyRevenue.toLocaleString("en-IN")}`,
      count: `${monthlySalesCount} sale${monthlySalesCount === 1 ? "" : "s"}`,
      icon: CalendarDays,
    },
    {
      label: "Yearly Sales",
      period: yearlyPeriodLabel,
      value: `₹${yearlyRevenue.toLocaleString("en-IN")}`,
      count: `${yearlySalesCount} sale${yearlySalesCount === 1 ? "" : "s"}`,
      icon: Calendar,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your shop&apos;s performance.
        </p>
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

      <Card>
        <CardHeader>
          <CardTitle>Sales Analytics</CardTitle>
          <CardDescription>
            Current week, month, and year performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {periodStats.map(({ label, period, value, count, icon: Icon }) => (
              <div key={label} className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    {label}
                  </p>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">{period}</p>
                <p className="text-xl font-bold">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Charts ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Last 7 days revenue trend</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <RevenueChart sales={sales} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Payment Status</CardTitle>
            <CardDescription>Distribution across all sales</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusChart sales={sales} />
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
          <Link
            href="/records"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {!recentSales || recentSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mb-3 opacity-20" />
              <p className="font-medium">No sales yet</p>
              <p className="text-sm">
                <Link href="/add-sale" className="text-primary hover:underline">
                  Add your first sale
                </Link>
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
                        <p className="font-medium text-sm">
                          {sale.customerName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sale.purchaseType.join(", ")} ·{" "}
                          {safeFormatDate(sale.date, "dd MMM yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[sale.status]}`}
                      >
                        {sale.status}
                      </span>
                      <p className="font-semibold text-sm">
                        ₹{sale.totalAmount.toLocaleString("en-IN")}
                      </p>
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
