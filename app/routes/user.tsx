import type { Route } from "./+types/user";
import { Form, Link, redirect } from "react-router";
import { requireRole } from "../auth.server";
import { getPurchaseRecords, getSaleRecords, getLedgerEntries, sellFromStock } from "../pos.server";
import { useStore, pkFormat } from "../store";

type ActionData = {
  error?: string;
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "User Home" },
    { name: "description", content: "User home page" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "user");
  const url = new URL(request.url);
  const sellSearch = url.searchParams.get("sellSearch")?.trim() ?? "";
  const stockSearch = url.searchParams.get("stockSearch")?.trim() ?? "";

  return {
    user,
    purchases: await getPurchaseRecords(),
    sales: await getSaleRecords(),
    ledgerEntries: await getLedgerEntries(),
    modal: url.searchParams.get("modal"),
    sellSearch,
    stockSearch,
    stockView: url.searchParams.get("stockView") ?? "my",
  };
}

export async function action({ request }: Route.ActionArgs): Promise<ActionData> {
  const user = await requireRole(request, "user");
  const formData = await request.formData();

  if (formData.get("intent") !== "sell") {
    return { error: "Invalid action." };
  }

  const recordId = String(formData.get("recordId") ?? "");
  const quantity = Number(formData.get("quantity"));
  const soldUnitPrice = Number(formData.get("soldUnitPrice"));
  const result = await sellFromStock(recordId, quantity, soldUnitPrice, user.name);

  if (!result.success) {
    return { error: result.error };
  }

  return {};
}

export async function clientLoader({ serverLoader, request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const sellSearch = url.searchParams.get("sellSearch")?.trim() ?? "";
  const stockSearch = url.searchParams.get("stockSearch")?.trim() ?? "";
  const modal = url.searchParams.get("modal");
  const cached = useStore.getState();

  const stockView = url.searchParams.get("stockView") ?? "my";

  if (cached.loaded) {
    cached.logAction({ operation: "read", collection: "purchases", status: "success" });
    cached.logAction({ operation: "read", collection: "sales", status: "success" });
    return { user: cached.user!, purchases: cached.purchases, sales: cached.sales, ledgerEntries: cached.ledgerEntries, modal, sellSearch, stockSearch, stockView };
  }

  const data = await serverLoader();
  useStore.getState().populate(data);
  return { ...data, modal, sellSearch, stockSearch, stockView };
}

export async function clientAction({ serverAction, request }: Route.ClientActionArgs) {
  useStore.getState().logAction({ operation: "update", collection: "sales", status: "pending" });
  const result = await serverAction() as { error?: string } | Response;
  useStore.getState().clearCache();
  useStore.getState().logAction({ operation: "update", collection: "sales", status: "success" });

  if (result && typeof result === "object" && "error" in result) {
    return result;
  }

  const url = new URL(request.url);
  url.searchParams.delete("modal");
  return redirect(url.pathname + url.search);
}

function getDisplayName(name: string): string {
  if (name === "Admin User") return "HN";
  if (name === "NS COMPUTERS") return "NS";
  if (name === "IT COMPUTERS") return "IT";
  return name;
}

export default function UserHome({ loaderData, actionData }: Route.ComponentProps) {
  const userName = loaderData.user.name;

  function matchesSearch(record: typeof loaderData.purchases[number], query: string): boolean {
    if (!query) return true;
    const text = `${record.laptopName} ${record.model} ${record.processor} gen ${record.generation}th ${record.year ?? ""} ${record.ram} ${record.rom}`.toLowerCase();
    return text.includes(query);
  }

  const stockQuery = loaderData.stockSearch.toLowerCase();
  const myStock = loaderData.purchases.filter((r) => r.createdBy === userName && r.quantity > 0 && matchesSearch(r, stockQuery));
  const allStock = loaderData.purchases.filter((r) => r.quantity > 0 && matchesSearch(r, stockQuery));

  const stockView = loaderData.stockView;

  const sellQuery = loaderData.sellSearch.toLowerCase();
  const sellableRecords = loaderData.purchases.filter((r) => r.createdBy === userName && r.quantity > 0 && matchesSearch(r, sellQuery));

  return (
    <main className="min-h-screen bg-slate-50 px-4 pt-52">
<section className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{loaderData.user.name}</p>
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
              to="/user/ledger"
              className="w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2.5 text-center text-sm font-bold text-slate-800 transition hover:bg-slate-100 sm:w-auto"
            >
              Ledger
            </Link>
            <Link
              to="/user"
              className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
            >
              Stock
            </Link>
          </div>
          <Link
            to={`/user?modal=sell${loaderData.sellSearch ? `&sellSearch=${encodeURIComponent(loaderData.sellSearch)}` : ""}`}
            className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 sm:w-auto"
          >
            Sell
          </Link>
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            to={`/user${stockView === "all" ? `?stockView=my${stockQuery ? `&stockSearch=${encodeURIComponent(loaderData.stockSearch)}` : ""}` : ""}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              stockView === "all"
                ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                : "border border-slate-900 bg-slate-900 text-white"
            }`}
          >
            My Stock
          </Link>
          <Link
            to={`/user?stockView=all${stockQuery ? `&stockSearch=${encodeURIComponent(loaderData.stockSearch)}` : ""}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              stockView === "all"
                ? "border border-slate-900 bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            All Stock
          </Link>
        </div>

        <Form method="get" action="/user" className="mt-4 flex gap-2">
          <input type="hidden" name="stockView" value={stockView} />
          <input
            type="text"
            name="stockSearch"
            defaultValue={loaderData.stockSearch}
            placeholder="Search stock"
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

{stockView === "all" ? (
  <section className="mt-4 w-full rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 className="text-lg font-bold text-slate-900">All Stock</h2>

    {allStock.length === 0 ? (
      <p className="mt-3 text-sm text-slate-600">No stock available.</p>
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
              <th className="px-2.5 py-1.5 border-r border-slate-200">Stock</th>
              <th className="px-2.5 py-1.5">Assigned To</th>
            </tr>
          </thead>

          <tbody>
            {allStock.map((purchase) => (
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
                <td className={`px-2.5 py-1.5 border-r border-slate-200 font-bold ${purchase.quantity > 1 ? "text-emerald-600" : "text-slate-900"}`}>{purchase.quantity}</td>
                <td className="px-2.5 py-1.5 text-slate-700">{getDisplayName(purchase.createdBy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
) : (
  <section className="mt-4 w-full rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 className="text-lg font-bold text-slate-900">My Stock</h2>

    {myStock.length === 0 ? (
      <p className="mt-3 text-sm text-slate-600">
        {loaderData.purchases.length === 0 ? "No buying data added yet." : "No stock assigned to you."}
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
              <th className="px-2.5 py-1.5">Stock</th>
            </tr>
          </thead>

          <tbody>
            {myStock.map((purchase) => (
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
                <td className={`px-2.5 py-1.5 font-bold ${purchase.quantity > 1 ? "text-emerald-600" : "text-slate-900"}`}>{purchase.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
)}

      {loaderData.modal === "sell" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <section className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_22px_72px_-36px_rgba(15,23,42,0.75)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Sell from Stock</h2>
                <p className="mt-1 text-sm text-slate-600">Search stock, set quantity and sold price, then sell.</p>
              </div>
              <Link
                to="/user"
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
                placeholder="Search laptop/model/processor/gen/ram/rom"
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
                    <th className="px-4 py-3 border-r border-slate-200">Stock</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sellableRecords.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-sm text-slate-600" colSpan={8}>
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
                        <td className="px-4 py-3 border-r border-slate-100 text-slate-700 font-semibold">{record.quantity}</td>
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
