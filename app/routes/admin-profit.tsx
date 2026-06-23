import { useState } from "react";
import type { Route } from "./+types/admin-profit";
import { Form, Link } from "react-router";
import { requireRole } from "../auth.server";
import { getLedgerEntries } from "../pos.server";
import { pkFormat } from "../store";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Admin Profit" },
    { name: "description", content: "Profit on sold laptops" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "admin");
  const url = new URL(request.url);
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultFrom = firstDay.toISOString().split("T")[0];
  const defaultTo = now.toISOString().split("T")[0];
  const from = url.searchParams.get("from") ?? defaultFrom;
  const to = url.searchParams.get("to") ?? defaultTo;
  const ledgerEntries = await getLedgerEntries();
  const sales = ledgerEntries.filter((e) => e.type === "sell");
  return { user, sales, from, to };
}

export default function AdminProfit({ loaderData }: Route.ComponentProps) {
  const { sales, from, to } = loaderData;
  const filteredSales = sales.filter((sale) => {
    const d = new Date(sale.dateTime).getTime();
    if (from && d < new Date(from).getTime()) return false;
    if (to && d > new Date(to + "T23:59:59").getTime()) return false;
    return true;
  });
  const totalRevenue = filteredSales.reduce((s, e) => s + e.total, 0);
  const totalProfit = filteredSales.reduce((s, e) => s + (e.unitPrice - (e.boughtPrice ?? 0)) * e.quantity, 0);

  const dailyMap = new Map<string, typeof filteredSales>();
  for (const sale of filteredSales) {
    const date = new Date(sale.dateTime).toLocaleDateString();
    const group = dailyMap.get(date) ?? [];
    group.push(sale);
    dailyMap.set(date, group);
  }
  const dailyGroups = Array.from(dailyMap.entries()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const toggleDay = (date: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const daySummary = (entries: typeof sales) => ({
    count: entries.length,
    qty: entries.reduce((s, e) => s + e.quantity, 0),
    revenue: entries.reduce((s, e) => s + e.total, 0),
    profit: entries.reduce((s, e) => s + (e.unitPrice - (e.boughtPrice ?? 0)) * e.quantity, 0),
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Panel</p>
          <span className="text-sm font-medium text-slate-600">
            {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          <Form method="post" action="/logout" onSubmit={(e) => { if (!window.confirm("Are you sure you want to logout?")) e.preventDefault(); }}>
            <button
              type="submit"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Logout
            </button>
          </Form>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin/ledger"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              Ledger
            </Link>
            <Link
              to="/admin"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              Stock
            </Link>
            <Link
              to="/admin/profit"
              className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
            >
              Profit
            </Link>
          </div>
          <div className="flex flex-wrap gap-3 sm:justify-end">
            <Link
              to="/admin?modal=buy"
              className="w-full rounded-xl border border-sky-300 bg-sky-50 px-4 py-2.5 text-center text-sm font-semibold text-sky-800 transition hover:bg-sky-100 sm:w-auto"
            >
              Buy
            </Link>
            <Link
              to="/admin?modal=sell"
              className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 sm:w-auto"
            >
              Sell
            </Link>
          </div>
        </div>
        <Form method="get" action="/admin/profit" className="mt-4 flex flex-wrap gap-2">
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
          />
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Filter
          </button>
          {(from || to) && (
            <Link
              to="/admin/profit"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </Link>
          )}
        </Form>
      </section>

      <section className="mt-36 w-full">
        {filteredSales.length === 0 ? (
          <p className="text-sm text-slate-600 text-center">No sales yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4 max-w-3xl">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Period</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {new Date(filteredSales[filteredSales.length - 1].dateTime).toLocaleDateString()} — {new Date(filteredSales[0].dateTime).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Sold Price</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{pkFormat(totalRevenue)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Profit</p>
                <p className={`mt-1 text-lg font-bold ${totalProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {pkFormat(totalProfit)}
                </p>
              </div>
            </div>
            {dailyGroups.map(([date, entries]) => {
              const summary = daySummary(entries);
              const open = openDays.has(date);
              return (
                <div key={date} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleDay(date)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-bold ${open ? "text-slate-900" : "text-slate-500"}`}>
                        {open ? "▼" : "▶"}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{date}</span>
                    </div>
                    <div className="flex items-center gap-5 text-xs">
                      <span className="text-slate-500">{summary.count} sale{summary.count !== 1 ? "s" : ""}</span>
                      <span className="text-slate-900 font-semibold">{pkFormat(summary.revenue)}</span>
                      <span className={`font-semibold ${summary.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {pkFormat(summary.profit)}
                      </span>
                    </div>
                  </button>
                  {open && (
                    <div className="border-t border-slate-100">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-4 py-2 border-r border-slate-100">Laptop</th>
                            <th className="px-4 py-2 border-r border-slate-100">Model</th>
                            <th className="px-4 py-2 border-r border-slate-100">Processor</th>
                            <th className="px-4 py-2 border-r border-slate-100">Gen</th>
                            <th className="px-4 py-2 border-r border-slate-100">Qty</th>
                            <th className="px-4 py-2 border-r border-slate-100">Sold Price</th>
                            <th className="px-4 py-2">Profit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((sale) => {
                            const profit = (sale.unitPrice - (sale.boughtPrice ?? 0)) * sale.quantity;
                            return (
                              <tr key={sale.id} className="border-t border-slate-100 bg-white">
                                <td className="px-4 py-2 border-r border-slate-100 font-medium text-slate-900">{sale.laptopName}</td>
                                <td className="px-4 py-2 border-r border-slate-100 text-slate-700">{sale.model}</td>
                                <td className="px-4 py-2 border-r border-slate-100 text-slate-700">{sale.processor.toUpperCase()}</td>
                                <td className="px-4 py-2 border-r border-slate-100 text-slate-700">{sale.year ?? `${sale.generation}th`}</td>
                                <td className="px-4 py-2 border-r border-slate-100 text-slate-700">{sale.quantity}</td>
                                <td className="px-4 py-2 border-r border-slate-100 font-medium text-slate-900">{pkFormat(sale.unitPrice)}</td>
                                <td className={`px-4 py-2 font-semibold ${profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                  {pkFormat(profit)}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-xs">
                            <td colSpan={4} className="px-4 py-2 text-slate-900">Daily Total</td>
                            <td className="px-4 py-2 border-r border-slate-100 text-slate-900">{summary.qty}</td>
                            <td className="px-4 py-2 border-r border-slate-100 text-slate-900">{pkFormat(summary.revenue)}</td>
                            <td className={`px-4 py-2 ${summary.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{pkFormat(summary.profit)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">Grand Total</span>
                <div className="flex items-center gap-5 text-xs">
                  <span className="text-slate-500">{filteredSales.length} sale{filteredSales.length !== 1 ? "s" : ""}</span>
                  <span className="text-slate-900 font-bold">{pkFormat(totalRevenue)}</span>
                  <span className={`font-bold ${totalProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {pkFormat(totalProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
