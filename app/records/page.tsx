"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useState } from "react";
import { format } from "date-fns";
import { Search, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { PaymentStatus } from "@/types";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  Partial: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  Pending: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
};

export default function RecordsPage() {
  const [search, setSearch] = useState("");

  const sales = useLiveQuery(() =>
    db.sales.orderBy("date").reverse().toArray()
  , []);

  const filtered = sales?.filter(s =>
    s.customerName.toLowerCase().includes(search.toLowerCase()) ||
    (s.customerPhone && s.customerPhone.includes(search))
  );

  const handleExportCSV = () => {
    if (!filtered || filtered.length === 0) return;
    const headers = ["Date", "Customer", "Phone", "Purchase", "Total", "Paid", "Balance", "Status"];
    const rows = filtered.map(s => [
      format(new Date(s.date), "dd/MM/yyyy"),
      `"${s.customerName}"`,
      `"${s.customerPhone || ""}"`,
      `"${s.purchaseType.join(", ")}"`,
      s.totalAmount,
      s.advancePaid,
      s.balance,
      s.status,
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Records</h1>
          <p className="text-muted-foreground">All sales transactions across all customers.</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="shrink-0 gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>All Sales ({filtered?.length ?? 0})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search customer..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filtered || filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No sales records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(sale.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{sale.customerName}</p>
                        <p className="text-xs text-muted-foreground">{sale.customerPhone || "—"}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sale.purchaseType.join(", ")}
                      </TableCell>
                      <TableCell className="font-medium">₹{sale.totalAmount.toLocaleString("en-IN")}</TableCell>
                      <TableCell className={sale.balance > 0 ? "font-bold text-red-500" : "text-muted-foreground"}>
                        ₹{sale.balance.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[sale.status]}`}>
                          {sale.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/customers/${sale.customerId}`}>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
