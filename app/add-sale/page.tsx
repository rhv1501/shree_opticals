"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Save, Search, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { syncToSheets } from "@/lib/sync";
import type { Customer, PaymentStatus } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Zod Schema ────────────────────────────────────────────────────────────

const powerSchema = z.object({
  sph: z.string().optional().default(""),
  cyl: z.string().optional().default(""),
  axis: z.string().optional().default(""),
  va: z.string().optional().default(""),
});

const detailedPowerSchema = z.object({
  dv: powerSchema,
  nv: powerSchema,
});

const isFutureSaleDate = (dateValue: string) => {
  if (!dateValue) return false;

  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return true;

  const selectedDate = new Date(year, month - 1, day);
  if (Number.isNaN(selectedDate.getTime())) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return selectedDate > today;
};

const formSchema = z.object({
  // Customer fields (used when creating a new customer)
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerPhone: z.string().optional().default(""),
  customerEmail: z.string().optional().default(""),
  // Sale fields
  date: z
    .string()
    .min(1, "Date is required")
    .refine((value) => !isFutureSaleDate(value), {
      message: "Future date is not allowed",
    }),
  eyePower: z.object({
    right: powerSchema.optional(),
    left: powerSchema.optional(),
    re: detailedPowerSchema.optional(),
    le: detailedPowerSchema.optional(),
    useLens: z.string().optional().default(""),
    bifocals: z.string().optional().default(""),
    usageOption: z.string().optional().default(""),
  }),
  totalAmount: z.coerce.number().min(0),
  advancePaid: z.coerce.number().min(0),
  paymentMethod: z.string().min(1, "Select a payment method"),
  notes: z.string().optional().default(""),
});

type FormValues = z.output<typeof formSchema>;

// ─── Constants ──────────────────────────────────────────────────────────────

const PAYMENT_METHODS = ["Cash", "Card", "UPI", "Bank Transfer"];
const EYE_FIELDS = [
  { key: "sph" as const, label: "SPH" },
  { key: "cyl" as const, label: "CYL" },
  { key: "axis" as const, label: "AXIS" },
  { key: "va" as const, label: "V.A." },
];

const LENS_OPTIONS = ["WT", "SP2", "PHOTOGROMATIC", "CR39", "HMC"];
const BIFOCAL_OPTIONS = ["KRYPTOK", "EXECUTIVE", "PROGRESSIVE", "BIFOCAL"];
const USAGE_OPTIONS = ["CONSTANT USE", "DV ONLY"];

// ─── Component ──────────────────────────────────────────────────────────────

export default function AddSalePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const customerSearchRef = useRef<HTMLDivElement | null>(null);
  const customers = useLiveQuery(
    () => db.customers.orderBy("name").toArray(),
    [],
  );

  // Customer search state
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const deferredCustomerQuery = useDeferredValue(customerQuery);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof formSchema>, undefined, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      date: todayDate,
      eyePower: {
        re: {
          dv: { sph: "", cyl: "", axis: "", va: "" },
          nv: { sph: "", cyl: "", axis: "", va: "" },
        },
        le: {
          dv: { sph: "", cyl: "", axis: "", va: "" },
          nv: { sph: "", cyl: "", axis: "", va: "" },
        },
        useLens: "",
        bifocals: "",
        usageOption: "",
      },
      totalAmount: 0,
      advancePaid: 0,
      paymentMethod: "Cash",
      notes: "",
    },
  });

  const totalAmount = watch("totalAmount") ?? 0;
  const advancePaid = watch("advancePaid") ?? 0;
  const balance = Math.max(0, Number(totalAmount) - Number(advancePaid));

  const paymentStatus: PaymentStatus =
    balance === 0 && Number(totalAmount) > 0
      ? "Paid"
      : Number(advancePaid) > 0 && balance > 0
        ? "Partial"
        : "Pending";

  const statusColor = {
    Paid: "text-emerald-500",
    Partial: "text-amber-500",
    Pending: "text-red-500",
  }[paymentStatus];

  // ── Customer Search ──────────────────────────────────────────────────────
  const customerResults = useMemo(() => {
    if (!deferredCustomerQuery.trim() || !customers) return [];

    const q = deferredCustomerQuery.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)),
      )
      .slice(0, 10);
  }, [customers, deferredCustomerQuery]);

  const hasSuggestions = customerResults.length > 0;

  const highlightMatch = (value: string, query: string) => {
    if (!query.trim()) return value;
    const idx = value.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return value;
    const before = value.slice(0, idx);
    const match = value.slice(idx, idx + query.length);
    const after = value.slice(idx + query.length);
    return (
      <>
        {before}
        <mark className="bg-primary/15 text-foreground rounded px-0.5">
          {match}
        </mark>
        {after}
      </>
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (customerSearchRef.current?.contains(target)) return;
      setShowDropdown(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, {
      passive: true,
    });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!showDropdown) {
      setActiveSuggestionIndex(-1);
      return;
    }

    setActiveSuggestionIndex(hasSuggestions ? 0 : -1);
  }, [showDropdown, hasSuggestions, deferredCustomerQuery]);

  useEffect(() => {
    if (!showDropdown || activeSuggestionIndex < 0) return;

    const activeEl = document.getElementById(
      `customer-suggestion-${activeSuggestionIndex}`,
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeSuggestionIndex, showDropdown]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsNewCustomer(false);
    setShowDropdown(false);
    setCustomerQuery(customer.name);
    // Pre-fill form fields
    setValue("customerName", customer.name);
    setValue("customerPhone", customer.phone || "");
    // Pre-fill latest eye power if available
    if (customer.eyePower) {
      const ep = customer.eyePower;
      setValue("eyePower", {
        right: ep.right
          ? {
              sph: ep.right.sph || "",
              cyl: ep.right.cyl || "",
              axis: ep.right.axis || "",
              va: ep.right.va || "",
            }
          : undefined,
        left: ep.left
          ? {
              sph: ep.left.sph || "",
              cyl: ep.left.cyl || "",
              axis: ep.left.axis || "",
              va: ep.left.va || "",
            }
          : undefined,
        re: ep.re
          ? {
              dv: {
                sph: ep.re.dv.sph || "",
                cyl: ep.re.dv.cyl || "",
                axis: ep.re.dv.axis || "",
                va: ep.re.dv.va || "",
              },
              nv: {
                sph: ep.re.nv.sph || "",
                cyl: ep.re.nv.cyl || "",
                axis: ep.re.nv.axis || "",
                va: ep.re.nv.va || "",
              },
            }
          : ep.right
            ? {
                dv: {
                  sph: ep.right.sph || "",
                  cyl: ep.right.cyl || "",
                  axis: ep.right.axis || "",
                  va: ep.right.va || "",
                },
                nv: {
                  sph: ep.right.add ? `+${ep.right.add}` : "",
                  cyl: "",
                  axis: "",
                  va: "",
                },
              }
            : {
                dv: { sph: "", cyl: "", axis: "", va: "" },
                nv: { sph: "", cyl: "", axis: "", va: "" },
              },
        le: ep.le
          ? {
              dv: {
                sph: ep.le.dv.sph || "",
                cyl: ep.le.dv.cyl || "",
                axis: ep.le.dv.axis || "",
                va: ep.le.dv.va || "",
              },
              nv: {
                sph: ep.le.nv.sph || "",
                cyl: ep.le.nv.cyl || "",
                axis: ep.le.nv.axis || "",
                va: ep.le.nv.va || "",
              },
            }
          : ep.left
            ? {
                dv: {
                  sph: ep.left.sph || "",
                  cyl: ep.left.cyl || "",
                  axis: ep.left.axis || "",
                  va: ep.left.va || "",
                },
                nv: {
                  sph: ep.left.add ? `+${ep.left.add}` : "",
                  cyl: "",
                  axis: "",
                  va: "",
                },
              }
            : {
                dv: { sph: "", cyl: "", axis: "", va: "" },
                nv: { sph: "", cyl: "", axis: "", va: "" },
              },
        useLens: ep.useLens || "",
        bifocals: ep.bifocals || "",
        usageOption: ep.usageOption || "",
      });
    }
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setIsNewCustomer(false);
    setCustomerQuery("");
    setValue("customerName", "");
    setValue("customerPhone", "");
  };

  const handleNewCustomer = () => {
    setSelectedCustomer(null);
    setIsNewCustomer(true);
    setShowDropdown(false);
    setValue("customerName", customerQuery);
  };

  const handleSuggestionKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (!showDropdown && event.key === "ArrowDown" && customerQuery.trim()) {
      setShowDropdown(true);
      return;
    }

    if (!showDropdown) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!hasSuggestions) return;
      setActiveSuggestionIndex((prev) => (prev + 1) % customerResults.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!hasSuggestions) return;
      setActiveSuggestionIndex((prev) =>
        prev <= 0 ? customerResults.length - 1 : prev - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      if (
        activeSuggestionIndex >= 0 &&
        customerResults[activeSuggestionIndex]
      ) {
        event.preventDefault();
        handleSelectCustomer(customerResults[activeSuggestionIndex]);
        return;
      }

      if (customerQuery.trim()) {
        event.preventDefault();
        handleNewCustomer();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setShowDropdown(false);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      if (isFutureSaleDate(values.date)) {
        toast.error("Future date is not allowed");
        return;
      }

      let customerId: string;

      if (selectedCustomer) {
        // Existing customer – update their eye power to latest
        customerId = selectedCustomer.id;
        await db.customers.update(customerId, {
          eyePower: values.eyePower,
          synced: false,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // New customer – create profile first
        customerId = crypto.randomUUID();
        await db.customers.add({
          id: customerId,
          name: values.customerName,
          phone: values.customerPhone || undefined,
          email: values.customerEmail || undefined,
          eyePower: values.eyePower,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          synced: false,
        });
      }

      // Create the sale record
      const payments =
        values.advancePaid > 0
          ? [
              {
                id: crypto.randomUUID(),
                amount: values.advancePaid,
                date: new Date().toISOString(),
                method: values.paymentMethod,
              },
            ]
          : [];

      await db.sales.add({
        id: crypto.randomUUID(),
        customerId,
        customerName: values.customerName,
        customerPhone: values.customerPhone || undefined,
        date: new Date(values.date).toISOString(),
        eyePower: values.eyePower,
        totalAmount: values.totalAmount,
        advancePaid: values.advancePaid,
        payments,
        balance,
        status: paymentStatus,
        notes: values.notes || undefined,
        synced: false,
        updatedAt: new Date().toISOString(),
      });

      toast.success(`Sale saved for ${values.customerName}!`);

      // Auto-sync immediately if online; silently queue if offline
      if (navigator.onLine) {
        syncToSheets().catch(() => {
          // Sync fail is non-fatal — will retry when back online
        });
      }

      router.push(selectedCustomer ? `/customers/${customerId}` : "/records");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save record. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add New Sale</h1>
        <p className="text-muted-foreground">
          Search for an existing customer or add a new one.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Customer Selection ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Input */}
            {!selectedCustomer && !isNewCustomer && (
              <div ref={customerSearchRef} className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or phone..."
                  value={customerQuery}
                  role="combobox"
                  aria-expanded={showDropdown}
                  aria-controls="customer-suggestions-list"
                  onChange={(e) => {
                    setCustomerQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onKeyDown={handleSuggestionKeyDown}
                />
                {/* Dropdown results */}
                {showDropdown &&
                  (customerResults.length > 0 || customerQuery.trim()) && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-border/80 bg-popover/95 shadow-2xl backdrop-blur-sm pointer-events-auto">
                      <div className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                        {hasSuggestions
                          ? `${customerResults.length} customer${customerResults.length > 1 ? "s" : ""} found`
                          : "No exact customer match"}
                      </div>

                      <div
                        id="customer-suggestions-list"
                        role="listbox"
                        className="max-h-[42vh] md:max-h-56 overflow-y-auto overscroll-contain touch-pan-y [scrollbar-gutter:stable]"
                      >
                        {customerResults.map((c, index) => {
                          const isActive = index === activeSuggestionIndex;
                          return (
                            <button
                              id={`customer-suggestion-${index}`}
                              key={c.id}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 md:py-2 text-left transition-colors",
                                isActive
                                  ? "bg-accent text-accent-foreground"
                                  : "hover:bg-accent/70",
                              )}
                              onMouseEnter={() =>
                                setActiveSuggestionIndex(index)
                              }
                              onClick={() => handleSelectCustomer(c)}
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {highlightMatch(c.name, customerQuery)}
                                </p>
                                <p className="text-muted-foreground text-xs truncate">
                                  {c.phone
                                    ? highlightMatch(c.phone, customerQuery)
                                    : "No phone"}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {customerQuery.trim() && (
                        <button
                          type="button"
                          className="sticky bottom-0 w-full flex items-center gap-2.5 px-3 py-2.5 bg-background/95 hover:bg-accent text-primary text-sm font-medium border-t border-border/70 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
                          onClick={handleNewCustomer}
                        >
                          <UserPlus className="h-4 w-4" />
                          Add &quot;{customerQuery}&quot; as new customer
                        </button>
                      )}
                    </div>
                  )}
              </div>
            )}

            {/* Selected existing customer badge */}
            {selectedCustomer && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{selectedCustomer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCustomer.phone || "No phone"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* New customer form fields */}
            {(isNewCustomer || (!selectedCustomer && !customerQuery)) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Customer Name *</label>
                  <Input placeholder="John Doe" {...register("customerName")} />
                  {errors.customerName && (
                    <p className="text-xs text-destructive">
                      {errors.customerName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input
                    placeholder="+91 9876543210"
                    {...register("customerPhone")}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">
                    Email (optional)
                  </label>
                  <Input
                    placeholder="john@example.com"
                    {...register("customerEmail")}
                  />
                </div>
              </div>
            )}

            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Purchase Date *</label>
              <Input
                type="date"
                max={todayDate}
                {...register("date")}
                className="max-w-xs"
              />
              {errors.date && (
                <p className="text-xs text-destructive">
                  {errors.date.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Eye Power ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Eye Power (Prescription)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {(["re", "le"] as const).map((eye) => (
                <div key={eye} className="space-y-3">
                  <h4 className="font-semibold text-center border-b pb-2 text-primary uppercase">
                    {eye === "re" ? "Right Eye (RE)" : "Left Eye (LE)"}
                  </h4>
                  <div className="grid grid-cols-5 gap-2 text-center items-end mb-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase"></div>
                    {EYE_FIELDS.map(({ label }) => (
                      <div
                        key={label}
                        className="text-xs font-semibold text-muted-foreground uppercase"
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  {(["dv", "nv"] as const).map((dist) => (
                    <div
                      key={dist}
                      className="grid grid-cols-5 gap-2 items-center"
                    >
                      <div className="text-xs font-semibold text-muted-foreground uppercase">
                        {dist === "dv" ? "D.V." : "N.V."}
                      </div>
                      {EYE_FIELDS.map(({ key }) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const reg = register(
                          `eyePower.${eye}.${dist}.${key}` as any,
                        );
                        return (
                          <Input
                            key={key}
                            className="h-9 text-sm text-center"
                            placeholder="—"
                            {...reg}
                            onChange={(e) => {
                              reg.onChange(e); // Trigger standard react-hook-form change
                              if (
                                dist === "dv" &&
                                (key === "cyl" || key === "axis")
                              ) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                setValue(
                                  `eyePower.${eye}.nv.${key}` as any,
                                  e.target.value,
                                );
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="grid gap-6 md:grid-cols-3 pt-4 border-t">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  USE LENS
                </label>
                <Controller
                  control={control}
                  name="eyePower.useLens"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select lens type" />
                      </SelectTrigger>
                      <SelectContent>
                        {LENS_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  BIFOCALS
                </label>
                <Controller
                  control={control}
                  name="eyePower.bifocals"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bifocal" />
                      </SelectTrigger>
                      <SelectContent>
                        {BIFOCAL_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  USAGE
                </label>
                <Controller
                  control={control}
                  name="eyePower.usageOption"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select usage..." />
                      </SelectTrigger>
                      <SelectContent>
                        {USAGE_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Payment ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Total Bill Amount (₹) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  {...register("totalAmount")}
                />
                {errors.totalAmount && (
                  <p className="text-xs text-destructive">
                    {errors.totalAmount.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Advance Paid (₹)</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  {...register("advancePaid")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Method</label>
                <Controller
                  control={control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                placeholder="Any extra notes about this sale..."
                className="resize-none min-h-[100px]"
                {...register("notes")}
              />
            </div>

            {/* Balance Summary */}
            <div className="mt-6 flex items-center justify-between p-4 bg-muted/40 rounded-lg border">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Balance Amount
                </p>
                <p className="text-3xl font-bold text-primary">
                  ₹{balance.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <p className={`text-xl font-bold uppercase ${statusColor}`}>
                  {paymentStatus}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Sale"}
          </Button>
        </div>
      </form>
    </div>
  );
}
