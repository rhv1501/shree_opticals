"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { syncToSheets } from "@/lib/sync";
import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft, Plus, History, Phone, Mail, Eye,
  Pencil, Trash2, MoreVertical,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Sale, PaymentStatus } from "@/types";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  Partial: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  Pending: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
};

const PURCHASE_TYPES = ["Frames", "Lenses", "Solutions", "Contact Lenses", "Others"];
const PAYMENT_METHODS = ["Cash", "Card", "UPI", "Bank Transfer"];
const EYE_KEYS = ["sph", "cyl", "axis", "add", "va"] as const;

// ─── Interfaces for edit state ────────────────────────────────────────────────

interface EditCustomerState {
  name: string; phone: string; email: string;
  rightSph: string; rightCyl: string; rightAxis: string; rightAdd: string; rightVa: string;
  leftSph:  string; leftCyl:  string; leftAxis:  string; leftAdd:  string; leftVa:  string;
}

interface EditSaleState {
  date: string; purchaseType: string[];
  totalAmount: string; advancePaid: string; notes: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // ── Payment dialog ─────────────────────────────────────────────────────────
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");

  // ── Edit Customer dialog ───────────────────────────────────────────────────
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<EditCustomerState>({
    name: "", phone: "", email: "",
    rightSph: "", rightCyl: "", rightAxis: "", rightAdd: "", rightVa: "",
    leftSph: "",  leftCyl: "",  leftAxis: "",  leftAdd: "",  leftVa: "",
  });

  // ── Delete Customer dialog ─────────────────────────────────────────────────
  const [deleteCustomerOpen, setDeleteCustomerOpen] = useState(false);

  // ── Edit Sale dialog ───────────────────────────────────────────────────────
  const [editSaleOpen, setEditSaleOpen] = useState(false);
  const [editSale, setEditSale] = useState<EditSaleState>({
    date: "", purchaseType: [], totalAmount: "", advancePaid: "", notes: "",
  });
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

  // ── Delete Sale dialog ─────────────────────────────────────────────────────
  const [deleteSaleId, setDeleteSaleId] = useState<string | null>(null);

  // ── Data ───────────────────────────────────────────────────────────────────
  const customer = useLiveQuery(() => db.customers.get(id), [id]);
  const sales = useLiveQuery(() =>
    db.sales.where("customerId").equals(id).reverse().sortBy("date")
  , [id]);

  const totalSpent = sales?.reduce((s, r) => s + r.totalAmount, 0) ?? 0;
  const totalPaid  = sales?.reduce((s, r) => s + r.advancePaid, 0) ?? 0;
  const totalDue   = sales?.reduce((s, r) => s + r.balance, 0) ?? 0;

  // ── Payment handlers ───────────────────────────────────────────────────────
  const openPayDialog = (sale: Sale) => {
    setSelectedSale(sale); setPayAmount(sale.balance.toString()); setPayMethod("Cash");
    setPayDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!selectedSale) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Invalid amount"); return; }
    if (amount > selectedSale.balance) { toast.error("Amount exceeds balance"); return; }
    try {
      const newPayment = { id: crypto.randomUUID(), amount, date: new Date().toISOString(), method: payMethod };
      const updatedPayments = [...selectedSale.payments, newPayment];
      const newAdvance = selectedSale.advancePaid + amount;
      const newBalance = selectedSale.totalAmount - newAdvance;
      const newStatus: PaymentStatus = newBalance === 0 ? "Paid" : newAdvance > 0 ? "Partial" : "Pending";
      await db.sales.update(selectedSale.id, {
        payments: updatedPayments, advancePaid: newAdvance, balance: newBalance,
        status: newStatus, synced: false, updatedAt: new Date().toISOString(),
      });
      toast.success("Payment recorded!"); setPayDialogOpen(false);
      if (navigator.onLine) syncToSheets().catch(() => {});
    } catch { toast.error("Failed to record payment."); }
  };

  // ── Customer CRUD ──────────────────────────────────────────────────────────
  const openEditCustomer = () => {
    if (!customer) return;
    const ep = customer.eyePower;
    setEditCustomer({
      name: customer.name, phone: customer.phone || "", email: customer.email || "",
      rightSph: ep?.right?.sph || "", rightCyl: ep?.right?.cyl || "", rightAxis: ep?.right?.axis || "",
      rightAdd: ep?.right?.add || "", rightVa:  ep?.right?.va  || "",
      leftSph:  ep?.left?.sph  || "", leftCyl:  ep?.left?.cyl  || "", leftAxis:  ep?.left?.axis  || "",
      leftAdd:  ep?.left?.add  || "", leftVa:   ep?.left?.va   || "",
    });
    setEditCustomerOpen(true);
  };

  const handleUpdateCustomer = async () => {
    if (!editCustomer.name.trim()) { toast.error("Name is required"); return; }
    try {
      await db.customers.update(id, {
        name: editCustomer.name.trim(),
        phone: editCustomer.phone || undefined,
        email: editCustomer.email || undefined,
        eyePower: {
          right: { sph: editCustomer.rightSph, cyl: editCustomer.rightCyl, axis: editCustomer.rightAxis, add: editCustomer.rightAdd, va: editCustomer.rightVa },
          left:  { sph: editCustomer.leftSph,  cyl: editCustomer.leftCyl,  axis: editCustomer.leftAxis,  add: editCustomer.leftAdd,  va: editCustomer.leftVa  },
        },
        updatedAt: new Date().toISOString(),
      });
      toast.success("Customer updated!"); setEditCustomerOpen(false);
      if (navigator.onLine) syncToSheets().catch(() => {});
    } catch { toast.error("Failed to update customer."); }
  };

  const handleDeleteCustomer = async () => {
    try {
      // Delete all linked sales first
      const linkedSales = await db.sales.where("customerId").equals(id).toArray();
      const now = new Date().toISOString();
      await Promise.all(linkedSales.map(async s => {
        await db.deletedRecords.put({ id: s.id, type: "sale", timestamp: now });
        await db.sales.delete(s.id);
      }));
      await db.deletedRecords.put({ id, type: "customer", timestamp: now });
      await db.customers.delete(id);
      toast.success("Customer and all their sales deleted.");
      if (navigator.onLine) syncToSheets().catch(() => {});
      router.push("/customers");
    } catch { toast.error("Failed to delete customer."); }
  };

  // ── Sale CRUD ──────────────────────────────────────────────────────────────
  const openEditSale = (sale: Sale) => {
    setEditingSaleId(sale.id);
    setEditSale({
      date: format(new Date(sale.date), "yyyy-MM-dd"),
      purchaseType: [...sale.purchaseType],
      totalAmount: sale.totalAmount.toString(),
      advancePaid: sale.advancePaid.toString(),
      notes: sale.notes || "",
    });
    setEditSaleOpen(true);
  };

  const handleUpdateSale = async () => {
    if (!editingSaleId) return;
    const total = parseFloat(editSale.totalAmount);
    const advance = parseFloat(editSale.advancePaid);
    if (isNaN(total) || total < 0) { toast.error("Invalid total amount"); return; }
    if (isNaN(advance) || advance < 0) { toast.error("Invalid advance amount"); return; }
    const balance = Math.max(0, total - advance);
    const status: PaymentStatus = balance === 0 && total > 0 ? "Paid" : advance > 0 && balance > 0 ? "Partial" : "Pending";
    try {
      await db.sales.update(editingSaleId, {
        date: new Date(editSale.date).toISOString(),
        purchaseType: editSale.purchaseType,
        totalAmount: total, advancePaid: advance, balance, status,
        notes: editSale.notes || undefined,
        synced: false, updatedAt: new Date().toISOString(),
      });
      toast.success("Sale updated!"); setEditSaleOpen(false);
      if (navigator.onLine) syncToSheets().catch(() => {});
    } catch { toast.error("Failed to update sale."); }
  };

  const handleDeleteSale = async () => {
    if (!deleteSaleId) return;
    try {
      await db.deletedRecords.put({ id: deleteSaleId, type: "sale", timestamp: new Date().toISOString() });
      await db.sales.delete(deleteSaleId);
      toast.success("Sale deleted."); setDeleteSaleId(null);
      if (navigator.onLine) syncToSheets().catch(() => {});
    } catch { toast.error("Failed to delete sale."); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">Customer not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/customers")}>Back to Customers</Button>
      </div>
    );
  }

  const eyePower = customer.eyePower;

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ── */}
      <div className="flex items-start gap-4 flex-wrap">
        <Link href="/customers">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold shrink-0">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">{customer.name}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone}</span>}
              {customer.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email}</span>}
              <span>Since {format(new Date(customer.createdAt), "dd MMM yyyy")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openEditCustomer}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Link href={`/add-sale?customerId=${customer.id}`}>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Sale
            </Button>
          </Link>
          <Button
            variant="ghost" size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteCustomerOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Visits", value: sales?.length ?? 0 },
          { label: "Total Billed", value: `₹${totalSpent.toLocaleString("en-IN")}` },
          { label: "Total Paid",   value: `₹${totalPaid.toLocaleString("en-IN")}`,  color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Balance Due",  value: `₹${totalDue.toLocaleString("en-IN")}`,   color: totalDue > 0 ? "text-red-500" : "text-emerald-500" },
        ].map(({ label, value, color = "" }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Eye Power ── */}
        {eyePower && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" /> Latest Prescription
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(["right", "left"] as const).map((eye) => (
                <div key={eye} className="mb-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase">
                    {eye === "right" ? "Right (OD)" : "Left (OS)"}
                  </p>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {EYE_KEYS.map((f) => (
                      <div key={f} className="bg-muted rounded p-1">
                        <p className="text-xs text-muted-foreground">{f.toUpperCase()}</p>
                        <p className="text-xs font-semibold">{(eyePower[eye] as Record<string, string | undefined>)[f] || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Sales History ── */}
        <div className={eyePower ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" /> Sales History ({sales?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!sales || sales.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No sales yet.</p>
              ) : (
                <div className="space-y-3">
                  {sales.map((sale) => (
                    <div key={sale.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{format(new Date(sale.date), "dd MMM yyyy")}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[sale.status]}`}>{sale.status}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{sale.purchaseType.join(", ")}</p>
                          {sale.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{sale.notes}</p>}
                        </div>
                        <div className="flex items-start gap-2 shrink-0">
                          <div className="text-right">
                            <p className="font-bold">₹{sale.totalAmount.toLocaleString("en-IN")}</p>
                            {sale.balance > 0 && <p className="text-xs text-red-500">Due: ₹{sale.balance.toLocaleString("en-IN")}</p>}
                          </div>
                          {/* Sale action menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" />}>
                              <MoreVertical className="h-3.5 w-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditSale(sale)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Sale
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteSaleId(sale.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Sale
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Payment history */}
                      {sale.payments.length > 0 && (
                        <div className="space-y-1 border-t pt-2">
                          {sale.payments.map((p) => (
                            <div key={p.id} className="flex justify-between text-xs text-muted-foreground">
                              <span>₹{p.amount.toLocaleString("en-IN")} · {p.method}</span>
                              <span>{format(new Date(p.date), "dd MMM, hh:mm a")}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {sale.balance > 0 && (
                        <Button size="sm" className="w-full" onClick={() => openPayDialog(sale)}>
                          <Plus className="mr-1 h-3 w-3" /> Record Payment
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ════════════════════════════════════════
          DIALOGS
      ════════════════════════════════════════ */}

      {/* ── Record Payment Dialog ── */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {selectedSale && format(new Date(selectedSale.date), "dd MMM yyyy")} · Balance: ₹{selectedSale?.balance.toLocaleString("en-IN")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (₹)</label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} max={selectedSale?.balance} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Method</label>
              <Select value={payMethod} onValueChange={(v) => setPayMethod(v || "Cash")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePayment}>Record</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Customer Dialog ── */}
      <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update customer profile and latest eye prescription.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Name *</label>
                <Input value={editCustomer.name} onChange={e => setEditCustomer(s => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone</label>
                <Input value={editCustomer.phone} onChange={e => setEditCustomer(s => ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-sm font-medium">Email</label>
                <Input value={editCustomer.email} onChange={e => setEditCustomer(s => ({ ...s, email: e.target.value }))} />
              </div>
            </div>
            {/* Eye power grid */}
            {(["right", "left"] as const).map((eye) => (
              <div key={eye}>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 border-b pb-1">
                  {eye === "right" ? "Right Eye (OD)" : "Left Eye (OS)"}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {EYE_KEYS.map((key) => {
                    const stateKey = `${eye}${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof EditCustomerState;
                    return (
                      <div key={key} className="space-y-1">
                        <label className="text-xs text-muted-foreground">{key.toUpperCase()}</label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="—"
                          value={editCustomer[stateKey]}
                          onChange={e => setEditCustomer(s => ({ ...s, [stateKey]: e.target.value }))}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditCustomerOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateCustomer}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Customer Confirm ── */}
      <Dialog open={deleteCustomerOpen} onOpenChange={setDeleteCustomerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{customer.name}</strong> and all
              their <strong>{sales?.length ?? 0} sale(s)</strong>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteCustomerOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCustomer}>Delete Permanently</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Sale Dialog ── */}
      <Dialog open={editSaleOpen} onOpenChange={setEditSaleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
            <DialogDescription>Update sale details and amounts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date</label>
              <Input type="date" value={editSale.date} onChange={e => setEditSale(s => ({ ...s, date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Purchase Categories</label>
              <div className="grid grid-cols-2 gap-2">
                {PURCHASE_TYPES.map(type => (
                  <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={editSale.purchaseType.includes(type)}
                      onCheckedChange={(checked) => {
                        setEditSale(s => ({
                          ...s,
                          purchaseType: checked
                            ? [...s.purchaseType, type]
                            : s.purchaseType.filter(t => t !== type),
                        }));
                      }}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Total Amount (₹)</label>
                <Input type="number" value={editSale.totalAmount}
                  onChange={e => setEditSale(s => ({ ...s, totalAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Amount Paid (₹)</label>
                <Input type="number" value={editSale.advancePaid}
                  onChange={e => setEditSale(s => ({ ...s, advancePaid: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Input value={editSale.notes} onChange={e => setEditSale(s => ({ ...s, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditSaleOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateSale}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Sale Confirm ── */}
      <Dialog open={!!deleteSaleId} onOpenChange={() => setDeleteSaleId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Sale</DialogTitle>
            <DialogDescription>
              This will permanently delete this sale record and its payment history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setDeleteSaleId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSale}>Delete Sale</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
