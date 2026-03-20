"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useState } from "react";
import { format } from "date-fns";
import { Search, UserPlus, Users } from "lucide-react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CustomersPage() {
  const [search, setSearch] = useState("");

  const customers = useLiveQuery(() =>
    db.customers.orderBy("name").toArray()
  , []);

  const allSales = useLiveQuery(() => db.sales.toArray(), []);

  const filtered = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search))
  );

  const getSaleStats = (customerId: string) => {
    const customerSales = allSales?.filter(s => s.customerId === customerId) || [];
    const totalSpent = customerSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const pendingBalance = customerSales.reduce((sum, s) => sum + s.balance, 0);
    return { salesCount: customerSales.length, totalSpent, pendingBalance };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">All registered customers and their history.</p>
        </div>
        <Link href="/add-sale">
          <Button className="gap-2 shrink-0">
            <UserPlus className="h-4 w-4" />
            Add Sale
          </Button>
        </Link>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customers?.length ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">₹</span>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ₹{(allSales?.reduce((s, r) => s + r.totalAmount, 0) ?? 0).toLocaleString("en-IN")}
                </p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
                <span className="text-red-600 dark:text-red-400 font-bold text-sm">!</span>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ₹{(allSales?.reduce((s, r) => s + r.balance, 0) ?? 0).toLocaleString("en-IN")}
                </p>
                <p className="text-sm text-muted-foreground">Total Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>Customer Directory</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search name or phone..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No customers found</p>
              <p className="text-sm">Add a sale to register your first customer.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered?.map((customer) => {
                const stats = getSaleStats(customer.id);
                return (
                  <Link key={customer.id} href={`/customers/${customer.id}`}>
                    <div className="group rounded-lg border p-4 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shrink-0">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate group-hover:text-primary">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">{customer.phone || "No phone"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs border-t pt-3">
                        <div>
                          <p className="font-bold text-base">{stats.salesCount}</p>
                          <p className="text-muted-foreground">Visits</p>
                        </div>
                        <div>
                          <p className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                            ₹{stats.totalSpent.toLocaleString("en-IN")}
                          </p>
                          <p className="text-muted-foreground">Spent</p>
                        </div>
                        <div>
                          <p className={`font-bold text-base ${stats.pendingBalance > 0 ? "text-red-500" : "text-emerald-500"}`}>
                            ₹{stats.pendingBalance.toLocaleString("en-IN")}
                          </p>
                          <p className="text-muted-foreground">Due</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Since {format(new Date(customer.createdAt), "dd MMM yyyy")}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
