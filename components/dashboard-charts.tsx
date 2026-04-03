"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
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
import type { Sale } from "@/types";
import type { TooltipItem } from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
);

export function RevenueChart({ sales }: { sales?: Sale[] }) {
  const chartData = useMemo<ChartData<"line"> | null>(() => {
    if (!sales) return null;

    const today = new Date();
    const past7Days = eachDayOfInterval({
      start: subDays(today, 6),
      end: today,
    });
    const revenueByDay = new Map<string, number>();

    for (const sale of sales) {
      if (!sale.date) continue;
      const dayKey = sale.date.slice(0, 10);
      revenueByDay.set(
        dayKey,
        (revenueByDay.get(dayKey) ?? 0) + sale.totalAmount,
      );
    }

    return {
      labels: past7Days.map((day) => format(day, "MMM dd")),
      datasets: [
        {
          label: "Revenue (₹)",
          data: past7Days.map(
            (day) => revenueByDay.get(format(day, "yyyy-MM-dd")) ?? 0,
          ),
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
  }, [sales]);

  if (!chartData) {
    return (
      <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "rgba(0,0,0,0.05)" },
        ticks: {
          callback: (value: number | string) =>
            `₹${Number(value).toLocaleString("en-IN")}`,
        },
      },
      x: { grid: { display: false } },
    },
  };

  return (
    <div className="h-[250px] w-full">
      <Line options={options} data={chartData} />
    </div>
  );
}

export function StatusChart({ sales }: { sales?: Sale[] }) {
  const chartData = useMemo<ChartData<"doughnut"> | null>(() => {
    if (!sales) return null;

    let paid = 0;
    let partial = 0;
    let pending = 0;

    for (const sale of sales) {
      if (sale.status === "Paid") paid += 1;
      else if (sale.status === "Partial") partial += 1;
      else pending += 1;
    }

    if (paid + partial + pending === 0) return null;

    return {
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
  }, [sales]);

  if (!chartData) {
    return (
      <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
        No sales data yet
      </div>
    );
  }

  const options: ChartOptions<"doughnut"> = {
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
          label: (ctx: TooltipItem<"doughnut">) =>
            ` ${ctx.label}: ${ctx.parsed} sales`,
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
