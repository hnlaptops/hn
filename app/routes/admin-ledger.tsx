import { Fragment, useState, useEffect } from "react";

import type { Route } from "./+types/admin-ledger";
import { Form, Link, redirect } from "react-router";

import { requireRole } from "../auth.server";
import {
  getPurchaseRecords,
  getSaleRecords,
  getLedgerEntries,
  deletePurchaseRecord,
  deleteSaleRecord,
  getSalesByStockRecordId,
  returnToStock,
} from "../pos.server";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useStore, pkFormat, matchesSearch } from "../store";

function getDisplayName(name: string): string {
  if (name === "Admin User") return "HN";
  if (name === "NS COMPUTERS") return "NS";
  if (name === "IT COMPUTERS") return "IT";
  return name;
}

type LedgerRow = {
  id: string;
  type: "buy" | "sell";
  recordId: string;
  dateTime: string;
  laptopName: string;
  model: string;
  processor: string;
  generation: number;
  year: number | null;
  isMacBook: boolean;
  ram: string;
  rom: string;
  gpu: string;
  quantity: number;
  unitPrice: number;
  boughtPrice: number | null;
  soldPrice: number | null;
  profit: number | null;
  total: number;
  actor: string;
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Admin Ledger" },
    { name: "description", content: "Date-wise buy and sell ledger" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "admin");
  const url = new URL(request.url);
  const edit = url.searchParams.get("edit") ?? "";
  const ledgerSearch = url.searchParams.get("ledgerSearch") ?? "";

  return {
    user,
    purchases: await getPurchaseRecords(),
    sales: await getSaleRecords(),
    ledgerEntries: await getLedgerEntries(),
    edit,
    ledgerSearch,
  };
}

export async function action({ request }: Route.ActionArgs): Promise<{ error?: string } | Response | null> {
  await requireRole(request, "admin");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "edit") {
    const type = String(formData.get("type") ?? "");
    const id = String(formData.get("id") ?? "");

    if (!id) return null;

    const laptopName = String(formData.get("laptopName") ?? "").trim();
    const model = String(formData.get("model") ?? "").trim();
    const processor = String(formData.get("processor") ?? "").trim().toLowerCase() as "i3" | "i5" | "i7" | "i9";
    const isMacBook = formData.get("isMacBook") === "on";
    const year = isMacBook ? Number(formData.get("year")) : null;
    const generation = isMacBook ? 0 : Number(formData.get("generation"));
    const ram = String(formData.get("ram") ?? "").trim();
    const rom = String(formData.get("rom") ?? "").trim();
    const gpu = String(formData.get("gpu") ?? "").trim();
    const quantity = Number(formData.get("quantity"));

    if (type === "buy") {
      const unitPrice = Number(formData.get("unitPrice"));
      const createdBy = String(formData.get("createdBy") ?? "").trim();
      const ledgerId = String(formData.get("ledgerId") ?? "");

      if (ledgerId) {
        const ledgerRef = doc(db, "ledger", ledgerId);
        await updateDoc(ledgerRef, { laptopName, model, processor, generation, year, isMacBook, ram, rom, gpu, quantity, unitPrice, actor: createdBy, total: Number((quantity * unitPrice).toFixed(2)) });
      }
    } else if (type === "sell") {
      const soldUnitPrice = Number(formData.get("unitPrice"));
      const stockUnitPrice = Number(formData.get("stockUnitPrice"));
      const soldBy = String(formData.get("soldBy") ?? "").trim();
      const ledgerId = String(formData.get("ledgerId") ?? "");

      if (ledgerId) {
        const ledgerRef = doc(db, "ledger", ledgerId);
        await updateDoc(ledgerRef, { laptopName, model, processor, generation, year, isMacBook, ram, rom, gpu, quantity, unitPrice: soldUnitPrice, boughtPrice: stockUnitPrice, soldPrice: soldUnitPrice, actor: soldBy, total: Number((quantity * soldUnitPrice).toFixed(2)) });
      }
    }

    return {};
  }

  if (intent === "return") {
    const id = String(formData.get("id") ?? "");

    if (!id) return null;

    const result = await returnToStock(id);
    if (!result.success) {
      return { error: result.error } as const;
    }

    return {};
  }

  if (intent === "delete") {
    const type = String(formData.get("type") ?? "");
    const id = String(formData.get("id") ?? "");
    const ledgerId = String(formData.get("ledgerId") ?? "");

    if (!id) return null;

    if (type === "buy") {
      const sales = await getSalesByStockRecordId(id);
      if (sales.length > 0) {
        return { error: "Cannot delete. This stock has been sold." } as const;
      }
      await deletePurchaseRecord(id);
    } else if (type === "sell") {
      await deleteSaleRecord(id);
    }

    if (ledgerId) {
      await deleteDoc(doc(db, "ledger", ledgerId));
    }

    return {};
  }

  return null;
}

clientLoader.hydrate = true as const;

export async function clientLoader({ serverLoader, request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const edit = url.searchParams.get("edit") ?? "";
  const ledgerSearch = url.searchParams.get("ledgerSearch") ?? "";
  const cached = useStore.getState();

  if (cached.loaded) {
    cached.logAction({ operation: "read", collection: "purchases", status: "success" });
    cached.logAction({ operation: "read", collection: "sales", status: "success" });
    return { user: cached.user!, purchases: cached.purchases, sales: cached.sales, ledgerEntries: cached.ledgerEntries, edit, ledgerSearch };
  }

  const data = await serverLoader();
  useStore.getState().populate(data);
  return { ...data, edit, ledgerSearch };
}

export async function clientAction({ serverAction, request }: Route.ClientActionArgs) {
  useStore.getState().logAction({ operation: "update", collection: "purchases", status: "pending" });
  useStore.getState().logAction({ operation: "update", collection: "sales", status: "pending" });

  try {
    await serverAction();
  } catch {
    useStore.getState().logAction({ operation: "update", collection: "purchases", status: "error" });
    useStore.getState().logAction({ operation: "update", collection: "sales", status: "error" });
    throw new Error("Could not save changes. The record may no longer exist.");
  }

  useStore.getState().clearCache();
  useStore.getState().logAction({ operation: "update", collection: "purchases", status: "success" });
  useStore.getState().logAction({ operation: "update", collection: "sales", status: "success" });

  return redirect("/admin/ledger");
}

export default function AdminLedger({ loaderData, actionData }: Route.ComponentProps) {
  const rows: LedgerRow[] = (
    loaderData.ledgerEntries.length > 0
      ? loaderData.ledgerEntries.filter((entry) => (entry as { type: string }).type !== "return").map((entry) => ({
          id: `${entry.type}-${entry.id}`,
          type: entry.type,
          recordId: entry.recordId,
          dateTime: entry.dateTime,
          laptopName: entry.laptopName,
          model: entry.model,
          processor: entry.processor,
          generation: entry.generation,
          year: entry.year,
          isMacBook: entry.isMacBook,
          ram: entry.ram,
          rom: entry.rom,
          gpu: entry.gpu,
          quantity: entry.quantity,
          unitPrice: entry.unitPrice,
          boughtPrice: entry.boughtPrice,
          soldPrice: entry.soldPrice,
          profit:
            entry.type === "sell" && entry.boughtPrice != null
              ? Number(((entry.soldPrice! - entry.boughtPrice) * entry.quantity).toFixed(2))
              : null,
          total: entry.total,
          actor: entry.actor,
        }))
      : [
          ...loaderData.purchases.map((purchase) => {
            const s = purchase.ledgerSnapshot ?? purchase;
            return {
              id: `buy-${purchase.id}`,
              type: "buy" as const,
              recordId: purchase.id,
              dateTime: s.createdAt,
              laptopName: s.laptopName,
              model: s.model,
              processor: s.processor,
              generation: s.generation,
              year: s.year,
              isMacBook: s.isMacBook,
              ram: s.ram,
              rom: s.rom,
              gpu: s.gpu,
              quantity: s.quantity,
              unitPrice: s.unitPrice,
              boughtPrice: null,
              soldPrice: null,
              profit: null,
              total: s.totalPrice,
              actor: s.createdBy,
            };
          }),
          ...loaderData.sales.map((sale) => ({
            id: `sell-${sale.id}`,
            type: "sell" as const,
            recordId: sale.id,
            dateTime: sale.soldAt,
            laptopName: sale.laptopName,
            model: sale.model,
            processor: sale.processor,
            generation: sale.generation,
            year: sale.year,
            isMacBook: sale.isMacBook,
            ram: sale.ram,
            rom: sale.rom,
            gpu: sale.gpu,
            quantity: sale.quantity,
            unitPrice: sale.soldUnitPrice,
            boughtPrice: sale.stockUnitPrice,
            soldPrice: sale.soldUnitPrice,
            profit: Number(((sale.soldUnitPrice - sale.stockUnitPrice) * sale.quantity).toFixed(2)),
            total: sale.totalPrice,
            actor: sale.soldBy,
          })),
        ]
  ).sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

  const editRow = rows.find((r) => r.id === loaderData.edit);
  const [ledgerIsMacBook, setLedgerIsMacBook] = useState(editRow?.isMacBook ?? false);

  const ledgerQuery = loaderData.ledgerSearch ?? "";
  const filteredRows = ledgerQuery ? rows.filter((r) => matchesSearch(r, ledgerQuery)) : rows;

  let lastDateLabel = "";

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
              className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
            >
              Ledger
            </Link>
            <Link
              to="/admin"
              className="w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2.5 text-center text-sm font-bold text-slate-800 transition hover:bg-slate-100 sm:w-auto"
            >
              Stock
            </Link>
            <Link
              to="/admin/profit"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
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

        <Form method="get" action="/admin/ledger" className="mt-4 flex gap-2">
          <input
            type="text"
            name="ledgerSearch"
            defaultValue={loaderData.ledgerSearch}
            placeholder="Search keywords (e.g. dell 6th, i5, 8gb, gpu)"
            autoFocus
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Search
          </button>
        </Form>

      </section>

      <section className="mt-32 w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_48px_-30px_rgba(15,23,42,0.35)] sm:p-8">
        {filteredRows.length === 0 ? (
          <p className="text-sm text-slate-600">{rows.length === 0 ? "No ledger records yet." : "No records matched your search."}</p>
        ) : (
          <div className="max-h-[72vh] overflow-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">Date & Time</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">Type</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">Laptop</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">Model</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">Processor</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">Gen</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">RAM</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">ROM</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">GPU</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">Qty</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">Price</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">Sold Price</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">Profit</th>
                  <th className="border-r border-slate-200 px-2.5 py-1.5">By</th>
                  <th className="px-2.5 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const dateLabel = new Date(row.dateTime).toLocaleDateString();
                  const shouldRenderDateHeader = dateLabel !== lastDateLabel;
                  const rowTone =
                    row.type === "sell"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-rose-200 bg-rose-50 text-rose-900";
                  const cellBorderTone =
                    row.type === "sell" ? "border-emerald-200" : "border-rose-200";

                  if (shouldRenderDateHeader) {
                    lastDateLabel = dateLabel;
                  }

                  return (
                    <Fragment key={row.id}>
                      {shouldRenderDateHeader ? (
                        <tr key={`date-${dateLabel}`} className="border-t border-slate-200 bg-slate-50">
                          <td colSpan={15} className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                            Date: {dateLabel}
                          </td>
                        </tr>
                      ) : null}
                      <tr className={`border-t ${rowTone}`}>
                        <td className={`border-r px-2.5 py-1.5 ${cellBorderTone}`}>
                          {new Date(row.dateTime).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                        </td>
                        <td className={`border-r px-2.5 py-1.5 font-semibold uppercase ${cellBorderTone}`}>
                          {row.type}
                        </td>
                        <td className={`border-r px-2.5 py-1.5 ${cellBorderTone}`}>{row.laptopName}</td>
                        <td className={`border-r px-2.5 py-1.5 ${cellBorderTone}`}>{row.model}</td>
                        <td className={`border-r px-2.5 py-1.5 ${cellBorderTone}`}>{row.processor.toUpperCase()}</td>
                        <td className={`border-r px-2.5 py-1.5 ${cellBorderTone}`}>{row.year ?? `${row.generation}th`}</td>
                        <td className={`border-r px-2.5 py-1.5 ${cellBorderTone}`}>{row.ram}</td>
                        <td className={`border-r px-2.5 py-1.5 ${cellBorderTone}`}>{row.rom}</td>
                        <td className={`border-r px-2.5 py-1.5 ${cellBorderTone}`}>{row.gpu || "-"}</td>
                        <td className={`border-r px-2.5 py-1.5 ${cellBorderTone}`}>{row.quantity}</td>
                        <td className={`border-r px-2.5 py-1.5 ${cellBorderTone}`}>
                          {row.type === "sell" && row.boughtPrice != null
                            ? `${pkFormat(row.boughtPrice)} → ${pkFormat(row.unitPrice)}`
                            : pkFormat(row.unitPrice)}
                        </td>
                        <td className={`border-r px-2.5 py-1.5 ${cellBorderTone}`}>
                          {row.soldPrice != null ? pkFormat(row.soldPrice) : "-"}
                        </td>
                        <td className={`border-r px-2.5 py-1.5 font-semibold ${cellBorderTone}`}>
                          {row.profit != null ? pkFormat(row.profit) : "-"}
                        </td>
                        <td className={`border-r px-2.5 py-1.5 ${cellBorderTone}`}>{row.type === "sell" ? getDisplayName(row.actor) : ""}</td>
                        <td className="px-2.5 py-1.5">
                          <Link
                            to={`/admin/ledger?edit=${row.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            Edit
                          </Link>
                          {row.type === "sell" ? (
                            <Form method="post" style={{ display: "inline" }} onSubmit={(e) => { if (!window.confirm("Return this item to stock?")) e.preventDefault(); }}>
                              <input type="hidden" name="intent" value="return" />
                              <input type="hidden" name="id" value={row.recordId} />
                              <button
                                type="submit"
                                className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                              >
                                Return
                              </button>
                            </Form>
                          ) : null}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_22px_72px_-36px_rgba(15,23,42,0.75)] sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Edit {editRow.type === "buy" ? "Purchase" : "Sale"}</h2>
                <p className="mt-1 text-sm text-slate-600">Update record details.</p>
              </div>
              <Link
                to="/admin/ledger"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </Link>
            </div>

            {actionData && typeof actionData === "object" && "error" in actionData ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {actionData.error}
              </p>
            ) : null}

            <Form method="post" className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="type" value={editRow.type} />
              <input type="hidden" name="id" value={editRow.recordId || editRow.id.replace(/^(buy|sell)-/, "")} />
              <input type="hidden" name="ledgerId" value={loaderData.ledgerEntries.length > 0 ? editRow.id.replace(/^(buy|sell)-/, "") : ""} />

              <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 cursor-pointer transition hover:bg-slate-50 sm:col-span-2">
                <input
                  type="checkbox"
                  name="isMacBook"
                  checked={ledgerIsMacBook}
                  onChange={(e) => setLedgerIsMacBook(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                This is a MacBook
              </label>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Laptop Name</label>
                <input
                  type="text"
                  name="laptopName"
                  defaultValue={editRow.laptopName}
                  placeholder="Laptop name"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Model</label>
                <input
                  type="text"
                  name="model"
                  defaultValue={editRow.model}
                  placeholder="Model"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Processor</label>
                <select
                  name="processor"
                  defaultValue={editRow.processor.toLowerCase()}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                >
                  <optgroup label="Intel">
                    <option value="i3">i3</option>
                    <option value="i5">i5</option>
                    <option value="i7">i7</option>
                    <option value="i9">i9</option>
                  </optgroup>
                  <optgroup label="AMD Ryzen">
                    <option value="ryzen 3">Ryzen 3</option>
                    <option value="ryzen 5">Ryzen 5</option>
                    <option value="ryzen 7">Ryzen 7</option>
                    <option value="ryzen 9">Ryzen 9</option>
                  </optgroup>
                  <optgroup label="AMD A-Series">
                    <option value="a4">A4</option>
                    <option value="a6">A6</option>
                    <option value="a8">A8</option>
                    <option value="a10">A10</option>
                    <option value="a12">A12</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{ledgerIsMacBook ? "Year" : "Generation"}</label>
                {ledgerIsMacBook ? (
                  <input
                    type="number"
                    name="year"
                    min={1900}
                    max={2100}
                    defaultValue={editRow.year ?? undefined}
                    placeholder="Year (e.g. 2015)"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                    required
                  />
                ) : (
                  <select
                    name="generation"
                    defaultValue={editRow.generation}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                    required
                  >
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((gen) => (
                      <option key={gen} value={gen}>{gen}th Generation</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">RAM</label>
                <input
                  type="text"
                  name="ram"
                  defaultValue={editRow.ram}
                  placeholder="RAM"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">ROM</label>
                <input
                  type="text"
                  name="rom"
                  defaultValue={editRow.rom}
                  placeholder="ROM"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">GPU</label>
                <select
                  name="gpu"
                  defaultValue={editRow.gpu || ""}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                >
                  <option value="">No GPU</option>
                  <option value="1GB">1GB</option>
                  <option value="2GB">2GB</option>
                  <option value="4GB">4GB</option>
                  <option value="6GB">6GB</option>
                  <option value="8GB">8GB</option>
                  <option value="12GB">12GB</option>
                  <option value="24GB">24GB</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  min={1}
                  defaultValue={editRow.quantity}
                  placeholder="Quantity"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Unit Price</label>
                <input
                  type="number"
                  name="unitPrice"
                  min={1}
                  step="0.01"
                  defaultValue={editRow.unitPrice}
                  placeholder="Unit price"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                />
              </div>

              {editRow.type === "sell" ? (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Bought Price</label>
                  <input
                    type="number"
                    name="stockUnitPrice"
                    min={1}
                    step="0.01"
                    defaultValue={editRow.boughtPrice ?? editRow.unitPrice}
                    placeholder="Bought price"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                    required
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{editRow.type === "sell" ? "Sold By" : "Created By"}</label>
                <input
                  type="text"
                  name={editRow.type === "sell" ? "soldBy" : "createdBy"}
                  defaultValue={editRow.actor}
                  placeholder={editRow.type === "sell" ? "Sold by" : "Created by"}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                />
              </div>

              <div className="flex gap-3 sm:col-span-2">
                <button
                  type="submit"
                  name="intent"
                  value="edit"
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Save
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="delete"
                  className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Delete
                </button>
              </div>
            </Form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
