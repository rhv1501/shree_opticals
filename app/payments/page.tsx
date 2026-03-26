"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { syncToSheets } from "@/lib/sync";
import { useState } from "react";
import { format } from "date-fns";
import { Search, Plus, History, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Sale, PaymentStatus } from "@/types";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");

  const sales = useLiveQuery(() =>
    db.sales.where("status").anyOf(["Pending", "Partial"]).toArray()
  , []);

  const filtered = sales?.filter(s =>
    s.customerName.toLowerCase().includes(search.toLowerCase()) ||
    (s.customerPhone && s.customerPhone.includes(search))
  );

  // Group by customer for better UX
  const totalDue = filtered?.reduce((s, r) => s + r.balance, 0) ?? 0;
  const pendingCount = filtered?.filter(s => s.status === "Pending").length ?? 0;
  const partialCount = filtered?.filter(s => s.status === "Partial").length ?? 0;

  const openPayDialog = (sale: Sale) => {
    setSelectedSale(sale);
    setPayAmount(sale.balance.toString());
    setPayMethod("Cash");
    setDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!selectedSale) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Invalid amount"); return; }
    if (amount > selectedSale.balance) { toast.error("Amount exceeds balance"); return; }

    try {
      const newPayment = {
        id: crypto.randomUUID(), amount, date: new Date().toISOString(), method: payMethod,
      };
      const updatedPayments = [...selectedSale.payments, newPayment];
      const newAdvance = selectedSale.advancePaid + amount;
      const newBalance = selectedSale.totalAmount - newAdvance;
      const newStatus: PaymentStatus = newBalance === 0 ? "Paid" : newAdvance > 0 ? "Partial" : "Pending";

      await db.sales.update(selectedSale.id, {
        payments: updatedPayments, advancePaid: newAdvance, balance: newBalance,
        status: newStatus, synced: false, updatedAt: new Date().toISOString(),
      });

      toast.success("Payment recorded!");
      setDialogOpen(false);
      if (navigator.onLine) {
        syncToSheets().catch(() => {
          // Silent catch since it's an auto-sync
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to record payment.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pending Payments</h1>
        <p className="text-muted-foreground">Manage outstanding dues across all customers.</p>
      </div>

      {/* Summary chips */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-red-500">₹{totalDue.toLocaleString("en-IN")}</p>
            <p className="text-sm text-muted-foreground">Total Outstanding</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-amber-500">{partialCount}</p>
            <p className="text-sm text-muted-foreground">Partial Payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Fully Pending</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Outstanding Dues</CardTitle>
              <CardDescription>Partial and pending payments</CardDescription>
            </div>
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
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total Bill</TableHead>
                  <TableHead>Balance Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filtered || filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      🎉 No pending payments. All dues cleared!
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <p className="font-medium">{sale.customerName}</p>
                        <p className="text-xs text-muted-foreground">{sale.customerPhone || "—"}</p>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(sale.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">₹{sale.totalAmount.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="font-bold text-red-500">₹{sale.balance.toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          sale.status === "Partial"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                            : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                        }`}>
                          {sale.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => openPayDialog(sale)}>
                            <Plus className="mr-1 h-3 w-3" /> Pay
                          </Button>
                          <Link href={`/customers/${sale.customerId}`}>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment — {selectedSale?.customerName}</DialogTitle>
            <DialogDescription>
              Sale on {selectedSale && format(new Date(selectedSale.date), "dd MMM yyyy")} · Balance: ₹{selectedSale?.balance.toLocaleString("en-IN")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-muted-foreground text-xs">Total Bill</p>
                <p className="font-bold text-base">₹{selectedSale?.totalAmount.toLocaleString("en-IN")}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-500/10 p-3 rounded-md">
                <p className="text-red-600 dark:text-red-400 text-xs">Balance Due</p>
                <p className="font-bold text-base text-red-600 dark:text-red-400">₹{selectedSale?.balance.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Amount (₹)</label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} max={selectedSale?.balance} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={payMethod} onValueChange={(v) => setPayMethod(v || "Cash")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Cash", "Card", "UPI", "Bank Transfer"].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment history */}
            {selectedSale && selectedSale.payments.length > 0 && (
              <div className="border-t pt-3">
                <p className="flex items-center gap-1.5 text-sm font-medium mb-2">
                  <History className="h-3.5 w-3.5" /> Payment History
                </p>
                <div className="space-y-1.5 max-h-36 overflow-auto">
                  {selectedSale.payments.map(p => (
                    <div key={p.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                      <div>
                        <span className="font-medium mr-2">₹{p.amount.toLocaleString("en-IN")}</span>
                        <span className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.method}</span>
                      </div>
                      <span className="text-muted-foreground">{format(new Date(p.date), "dd MMM, hh:mm a")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePayment}>Record Payment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
