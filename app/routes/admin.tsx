import { useState, useEffect } from "react";

import type { Route } from "./+types/admin";
import { Form, Link, redirect } from "react-router";

import { requireRole } from "../auth.server";
import usersData from "../users.json";
import {
  addPurchaseRecord,
  getPurchaseRecords,
  sellFromStock,
  updatePurchaseRecord,
  deletePurchaseRecord,
  getSalesByStockRecordId,
} from "../pos.server";
import { useStore, pkFormat, matchesSearch } from "../store";

const ALLOWED_PROCESSORS = ["i3", "i5", "i7", "i9", "ryzen 3", "ryzen 5", "ryzen 7", "ryzen 9", "a4", "a6", "a8", "a10", "a12"] as const;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Admin Stock" },
    { name: "description", content: "Admin stock page" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "admin");
  const url = new URL(request.url);
  const sellSearch = url.searchParams.get("sellSearch")?.trim() ?? "";
  const stockSearch = url.searchParams.get("stockSearch")?.trim() ?? "";
  const edit = url.searchParams.get("edit") ?? "";

  const assignableUsers = [usersData.admin.name, ...usersData.users.filter((u) => u.role === "user").map((u) => u.name)];

  return {
    user,
    purchases: await getPurchaseRecords(),
    modal: url.searchParams.get("modal"),
    sellSearch,
    stockSearch,
    edit,
    assignableUsers,
  };
}

export async function action({ request }: Route.ActionArgs): Promise<ActionData> {
  const user = await requireRole(request, "admin");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "buy") {
    const laptopName = String(formData.get("laptopName") ?? "").trim();
    const model = String(formData.get("model") ?? "").trim();
    const processor = String(formData.get("processor") ?? "").trim().toLowerCase();
    const isMacBook = formData.get("isMacBook") === "on";
    const year = isMacBook ? Number(formData.get("year")) : null;
    const generation = isMacBook ? 0 : Number(formData.get("generation"));
    const ram = String(formData.get("ram") ?? "").trim();
    const rom = String(formData.get("rom") ?? "").trim();
    const gpu = String(formData.get("gpu") ?? "").trim();
    const quantity = Number(formData.get("quantity"));
    const unitPrice = Number(formData.get("unitPrice"));

    if (!laptopName || !model || !ram || !rom) {
      return { error: "Laptop, model, RAM, and ROM are required." };
    }

    if (!ALLOWED_PROCESSORS.includes(processor as (typeof ALLOWED_PROCESSORS)[number])) {
      return { error: "Invalid processor selected." };
    }

    if (!isMacBook && (!Number.isInteger(generation) || generation < 1 || generation > 15)) {
      return { error: "Generation must be from 1st to 15th." };
    }

    if (isMacBook && (year == null || !Number.isInteger(year) || year < 1900 || year > 2100)) {
      return { error: "Enter a valid year." };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: "Quantity must be greater than zero." };
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { error: "Unit price must be greater than zero." };
    }

    const assignedTo = String(formData.get("assignedTo") ?? "").trim();
    if (!assignedTo) {
      return { error: "Please assign this laptop to a user." };
    }

    addPurchaseRecord({
      laptopName,
      model,
      processor: processor as (typeof ALLOWED_PROCESSORS)[number],
      generation,
      year,
      isMacBook,
      ram,
      rom,
      gpu,
      quantity,
      unitPrice,
      createdBy: assignedTo,
    });

    return {};
  }

  if (intent === "sell") {
    const recordId = String(formData.get("recordId") ?? "");
    const quantity = Number(formData.get("quantity"));
    const soldUnitPrice = Number(formData.get("soldUnitPrice"));
    const result = await sellFromStock(recordId, quantity, soldUnitPrice, user.name);

    if (!result.success) {
      return { error: result.error };
    }

    return {};
  }

  if (intent === "edit") {
    const id = String(formData.get("id") ?? "");
    const sales = await getSalesByStockRecordId(id);
    const soldQty = sales.reduce((sum, s) => sum + s.quantity, 0);

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
    if (quantity < soldQty) {
      return { error: `Cannot reduce stock below ${soldQty} — ${soldQty} unit(s) already sold.` };
    }
    const unitPrice = Number(formData.get("unitPrice"));
    const assignedTo = String(formData.get("assignedTo") ?? "").trim();
    if (!assignedTo) {
      return { error: "Please assign this laptop to a user." };
    }

    await updatePurchaseRecord(id, { laptopName, model, processor, generation, year, isMacBook, ram, rom, gpu, quantity, unitPrice, createdBy: assignedTo });
    return {};
  }

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "");
    const sales = await getSalesByStockRecordId(id);
    if (sales.length > 0) {
      return { error: "Cannot delete stock that has already been sold. Sales exist in the ledger." };
    }

    await deletePurchaseRecord(id);
    return {};
  }

  return { error: "Invalid action." };
}

export async function clientLoader({ serverLoader, request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const sellSearch = url.searchParams.get("sellSearch")?.trim() ?? "";
  const stockSearch = url.searchParams.get("stockSearch")?.trim() ?? "";
  const modal = url.searchParams.get("modal");
  const edit = url.searchParams.get("edit") ?? "";
  const cached = useStore.getState();

  const assignableUsers = [usersData.admin.name, ...usersData.users.filter((u) => u.role === "user").map((u) => u.name)];

  if (cached.loaded && !modal && !edit) {
    cached.logAction({ operation: "read", collection: "purchases", status: "success" });
    return { user: cached.user!, purchases: cached.purchases, modal, sellSearch, stockSearch, edit, assignableUsers };
  }

  const data = await serverLoader();
  return data;
}

export async function clientAction({ serverAction, request }: Route.ClientActionArgs) {
  useStore.getState().logAction({ operation: "update", collection: "purchases", status: "pending" });
  const result = await serverAction() as { error?: string } | Response;
  useStore.getState().clearCache();
  useStore.getState().logAction({ operation: "update", collection: "purchases", status: "success" });

  if (result && typeof result === "object" && "error" in result) {
    return result;
  }

  const url = new URL(request.url);
  url.searchParams.delete("modal");
  url.searchParams.delete("edit");
  return redirect(url.pathname + url.search);
}

function getDisplayName(name: string): string {
  if (name === "Admin User") return "HN";
  if (name === "NS COMPUTERS") return "NS";
  if (name === "IT COMPUTERS") return "IT";
  return name;
}

export default function AdminHome({ loaderData, actionData }: Route.ComponentProps) {
  const [isMacBook, setIsMacBook] = useState(false);
  const [editIsMacBook, setEditIsMacBook] = useState(false);

  const editRecord = loaderData.edit ? loaderData.purchases.find((r) => r.id === loaderData.edit) : null;
  useEffect(() => {
    if (editRecord) setEditIsMacBook(editRecord.isMacBook);
  }, [editRecord]);
  const stockQuery = loaderData.stockSearch;
  const filteredPurchases = loaderData.purchases.filter((record) => {
    if (record.quantity <= 0) return false;
    if (!stockQuery) return true;
    return matchesSearch(record, stockQuery);
  });

  const sellQuery = loaderData.sellSearch;
  const sellableRecords = loaderData.purchases.filter((record) => {
    if (record.quantity <= 0) return false;
    if (!sellQuery) return true;
    return matchesSearch(record, sellQuery);
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
              className="w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2.5 text-center text-sm font-bold text-slate-800 transition hover:bg-slate-100 sm:w-auto"
            >
              Ledger
            </Link>
            <Link
              to="/admin"
              className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
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
              to={`/admin?modal=sell${loaderData.sellSearch ? `&sellSearch=${encodeURIComponent(loaderData.sellSearch)}` : ""}`}
              className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 sm:w-auto"
            >
              Sell
            </Link>
          </div>
        </div>

        <Form method="get" action="/admin" className="mt-4 flex gap-2">
          <input
            type="text"
            name="stockSearch"
            defaultValue={loaderData.stockSearch}
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

      <section className="mt-32 w-full rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">Current Stock</h2>
        {filteredPurchases.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            {loaderData.purchases.length === 0 ? "No buying data added yet." : "No stock matched your search."}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Date</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Laptop</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Model</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Processor</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Gen</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">RAM</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">ROM</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">GPU</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Stock</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Unit Price</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Assigned To</th>
                  <th className="px-2.5 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="border-t border-slate-200 bg-white">
                    <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">
                      {new Date(purchase.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      <br />
                      <span className="text-slate-400">{new Date(purchase.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</span>
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-900">{purchase.laptopName}</td>
                    <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{purchase.model}</td>
                    <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{purchase.processor.toUpperCase()}</td>
                    <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{purchase.year ?? `${purchase.generation}th`}</td>
                    <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{purchase.ram}</td>
                    <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{purchase.rom}</td>
                    <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{purchase.gpu || "-"}</td>
                    <td className={`px-2.5 py-1.5 border-r border-slate-200 font-bold ${purchase.quantity > 1 ? "text-emerald-600" : "text-slate-900"}`}>{purchase.quantity}</td>
                    <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{pkFormat(purchase.unitPrice)}</td>
                    <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{getDisplayName(purchase.createdBy)}</td>
                    <td className="px-2.5 py-1.5">
                      <Link
                        to={`/admin?edit=${purchase.id}${loaderData.stockSearch ? `&stockSearch=${encodeURIComponent(loaderData.stockSearch)}` : ""}`}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {loaderData.edit ? (() => {
        const record = loaderData.purchases.find((r) => r.id === loaderData.edit);
        if (!record) return null;
        const backUrl = `/admin${loaderData.stockSearch ? `?stockSearch=${encodeURIComponent(loaderData.stockSearch)}` : ""}`;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
            <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_22px_72px_-36px_rgba(15,23,42,0.75)] sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Edit Stock</h2>
                  <p className="mt-1 text-sm text-slate-600">Update or delete this stock entry.</p>
                </div>
                <Link
                  to={backUrl}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </Link>
              </div>

              {actionData?.error ? (
                <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {actionData.error}
                </p>
              ) : null}

              <Form method="post" className="mt-4 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={record.id} />

                <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 cursor-pointer transition hover:bg-slate-50 sm:col-span-2">
                  <input
                    type="checkbox"
                    name="isMacBook"
                    checked={editIsMacBook}
                    onChange={(e) => setEditIsMacBook(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  This is a MacBook (year instead of generation)
                </label>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Laptop Name</label>
                  <input
                    type="text"
                    name="laptopName"
                    defaultValue={record.laptopName}
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
                    defaultValue={record.model}
                    placeholder="Model"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Processor</label>
                  <select
                    name="processor"
                    defaultValue={record.processor.toLowerCase()}
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
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{editIsMacBook ? "Year" : "Generation"}</label>
                  {editIsMacBook ? (
                    <input
                      type="number"
                      name="year"
                      min={1900}
                      max={2100}
                      defaultValue={record.year ?? undefined}
                      placeholder="Year (e.g. 2015)"
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                      required
                    />
                  ) : (
                    <select
                      name="generation"
                      defaultValue={record.generation}
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
                    defaultValue={record.ram}
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
                    defaultValue={record.rom}
                    placeholder="ROM"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">GPU</label>
                  <select
                    name="gpu"
                    defaultValue={record.gpu || ""}
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
                    defaultValue={record.quantity}
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
                    defaultValue={record.unitPrice}
                    placeholder="Unit price"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Assign To</label>
                  <select
                    name="assignedTo"
                    defaultValue={record.createdBy}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                    required
                  >
                    {loaderData.assignableUsers.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
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
        );
      })() : null}

      {loaderData.modal === "buy" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_22px_72px_-36px_rgba(15,23,42,0.75)] sm:p-8">
            <div className="mt-3 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Buy Stock</h2>
                <p className="mt-1 text-sm text-slate-600">Add new stock to inventory.</p>
              </div>
              <Link
                to="/admin"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </Link>
            </div>

            {actionData?.error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {actionData.error}
              </p>
            ) : null}

            <Form method="post" className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="intent" value="buy" />
              <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 cursor-pointer transition hover:bg-slate-50 sm:col-span-2">
                <input
                  type="checkbox"
                  name="isMacBook"
                  checked={isMacBook}
                  onChange={(e) => setIsMacBook(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                This is a MacBook
              </label>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Laptop Name</label>
                <input
                  type="text"
                  name="laptopName"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Model</label>
                <input
                  type="text"
                  name="model"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Processor</label>
                <select
                  name="processor"
                  defaultValue="i5"
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
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{isMacBook ? "Year" : "Generation"}</label>
                {isMacBook ? (
                  <input
                    type="number"
                    name="year"
                    min={1900}
                    max={2100}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                    required
                  />
                ) : (
                  <select
                    name="generation"
                    defaultValue="10"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                    required
                  >
                    <option value="1">1st Generation</option>
                    <option value="2">2nd Generation</option>
                    <option value="3">3rd Generation</option>
                    <option value="4">4th Generation</option>
                    <option value="5">5th Generation</option>
                    <option value="6">6th Generation</option>
                    <option value="7">7th Generation</option>
                    <option value="8">8th Generation</option>
                    <option value="9">9th Generation</option>
                    <option value="10">10th Generation</option>
                    <option value="11">11th Generation</option>
                    <option value="12">12th Generation</option>
                    <option value="13">13th Generation</option>
                    <option value="14">14th Generation</option>
                    <option value="15">15th Generation</option>
                  </select>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">RAM</label>
                <input
                  type="text"
                  name="ram"
                  defaultValue="8"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">ROM</label>
                <input
                  type="text"
                  name="rom"
                  defaultValue="256"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">GPU</label>
                <select
                  name="gpu"
                  defaultValue=""
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
                  defaultValue={1}
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
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Assign To</label>
                <select
                  name="assignedTo"
                  defaultValue="Admin User"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                >
                  {loaderData.assignableUsers.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="sm:col-span-2 rounded-xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-600"
              >
                Save Buy
              </button>
            </Form>
          </section>
        </div>
      ) : null}

      {loaderData.modal === "sell" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <section className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_22px_72px_-36px_rgba(15,23,42,0.75)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Sell from Stock</h2>
                <p className="mt-1 text-sm text-slate-600">Search stock, set quantity and sold price, then sell.</p>
              </div>
              <Link
                to="/admin"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </Link>
            </div>

            <Form method="get" className="mt-4 flex gap-2">
              <input type="hidden" name="modal" value="sell" />
              <input
                type="text"
                name="sellSearch"
                defaultValue={loaderData.sellSearch}
                placeholder="Search keywords (e.g. dell 6th, i5, 8gb, gpu)"
                autoFocus
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
              />
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Search
              </button>
            </Form>

            {actionData?.error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {actionData.error}
              </p>
            ) : null}

            <div className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 border-r border-slate-200">Laptop</th>
                    <th className="px-4 py-3 border-r border-slate-200">Model</th>
                    <th className="px-4 py-3 border-r border-slate-200">Processor</th>
                    <th className="px-4 py-3 border-r border-slate-200">Gen</th>
                    <th className="px-4 py-3 border-r border-slate-200">RAM</th>
                    <th className="px-4 py-3 border-r border-slate-200">ROM</th>
                    <th className="px-4 py-3 border-r border-slate-200">GPU</th>
                    <th className="px-4 py-3 border-r border-slate-200">Buy Price</th>
                    <th className="px-4 py-3 border-r border-slate-200">Stock</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sellableRecords.length === 0 ? (
                    <tr>
                        <td className="px-4 py-4 text-sm text-slate-600" colSpan={10}>
                          No stock found.
                        </td>
                    </tr>
                  ) : (
                    sellableRecords.map((record) => (
                      <tr key={record.id} className="border-t border-slate-100 bg-white">
                        <td className="px-4 py-3 border-r border-slate-100 text-slate-900 font-medium">{record.laptopName}</td>
                        <td className="px-4 py-3 border-r border-slate-100 text-slate-700">{record.model}</td>
                        <td className="px-4 py-3 border-r border-slate-100 text-slate-700">{record.processor.toUpperCase()}</td>
                        <td className="px-4 py-3 border-r border-slate-100 text-slate-700">{record.year ?? `${record.generation}th`}</td>
                        <td className="px-4 py-3 border-r border-slate-100 text-slate-700">{record.ram}</td>
                        <td className="px-4 py-3 border-r border-slate-100 text-slate-700">{record.rom}</td>
                        <td className="px-4 py-3 border-r border-slate-100 text-slate-700">{record.gpu || "-"}</td>
                        <td className="px-4 py-3 border-r border-slate-100 text-slate-700">{pkFormat(record.unitPrice)}</td>
                        <td className={`px-4 py-3 border-r border-slate-100 font-bold ${record.quantity > 1 ? "text-emerald-600" : "text-slate-900"}`}>{record.quantity}</td>
                        <td className="px-4 py-3">
                          <Form method="post" className="flex flex-col gap-2 min-w-[140px]">
                            <input type="hidden" name="intent" value="sell" />
                            <input type="hidden" name="recordId" value={record.id} />
                            <input type="hidden" name="quantity" value="1" />
                            <input
                              type="number"
                              name="soldUnitPrice"
                              min={1}
                              step="0.01"
                              placeholder="Sold price"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                              required
                            />
                            <button
                              type="submit"
                              className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                            >
                              Sell
                            </button>
                          </Form>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
