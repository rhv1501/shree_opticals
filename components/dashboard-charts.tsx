"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { format, subDays, eachDayOfInterval } from "date-fns";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, ArcElement, Filler
);

export function RevenueChart() {
  // ← now reads from sales table
  const sales = useLiveQuery(() => db.sales.toArray(), []);

  if (!sales) {
    return (
      <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  const today = new Date();
  const past7Days = eachDayOfInterval({ start: subDays(today, 6), end: today });

  const labels = past7Days.map((day) => format(day, "MMM dd"));
  const data   = past7Days.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return sales
      .filter((r) => r.date.startsWith(dayStr))
      .reduce((sum, r) => sum + r.totalAmount, 0);
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: "Revenue (₹)",
        data,
        borderColor: "hsl(221.2, 83.2%, 53.3%)",
        backgroundColor: "hsla(221.2, 83.2%, 53.3%, 0.15)",
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "hsl(221.2, 83.2%, 53.3%)",
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "rgba(0,0,0,0.05)" },
        ticks: {
          callback: (value: number | string) => `₹${Number(value).toLocaleString("en-IN")}`,
        },
      },
      x: { grid: { display: false } },
    },
  };

  return (
    <div className="h-[250px] w-full">
      <Line options={options as any} data={chartData} />
    </div>
  );
}

export function StatusChart() {
  // ← now reads from sales table
  const sales = useLiveQuery(() => db.sales.toArray(), []);

  if (!sales) {
    return (
      <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  const paid    = sales.filter((r) => r.status === "Paid").length;
  const partial = sales.filter((r) => r.status === "Partial").length;
  const pending = sales.filter((r) => r.status === "Pending").length;

  if (paid + partial + pending === 0) {
    return (
      <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
        No sales data yet
      </div>
    );
  }

  const chartData = {
    labels: ["Paid", "Partial", "Pending"],
    datasets: [
      {
        data: [paid, partial, pending],
        backgroundColor: [
          "rgba(16, 185, 129, 0.85)",
          "rgba(245, 158, 11, 0.85)",
          "rgba(239, 68, 68, 0.85)",
        ],
        borderColor: [
          "rgb(16, 185, 129)",
          "rgb(245, 158, 11)",
          "rgb(239, 68, 68)",
        ],
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { padding: 16, usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed} sales`,
        },
      },
    },
  };

  return (
    <div className="h-[250px] w-full">
      <Doughnut options={options} data={chartData} />
    </div>
  );
}
