import { Fragment } from "react";
import type { Route } from "./+types/user-ledger";
import { Form, Link } from "react-router";
import { requireRole } from "../auth.server";
import { getPurchaseRecords, getSaleRecords, getLedgerEntries } from "../pos.server";
import { useStore, pkFormat } from "../store";

function getDisplayName(name: string): string {
  if (name === "Admin User") return "HN";
  if (name === "NS COMPUTERS") return "NS";
  if (name === "IT COMPUTERS") return "IT";
  return name;
}

type LedgerRow = {
  id: string;
  type: "buy" | "sell";
  dateTime: string;
  laptopName: string;
  model: string;
  processor: string;
  generation: number;
  year: number | null;
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
    { title: "My Ledger" },
    { name: "description", content: "Your buy and sell ledger" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "user");
  const url = new URL(request.url);
  const ledgerSearch = url.searchParams.get("ledgerSearch") ?? "";

  return {
    user,
    purchases: await getPurchaseRecords(),
    sales: await getSaleRecords(),
    ledgerEntries: await getLedgerEntries(),
    ledgerSearch,
  };
}

clientLoader.hydrate = true as const;

export async function clientLoader({ serverLoader, request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const ledgerSearch = url.searchParams.get("ledgerSearch") ?? "";
  const cached = useStore.getState();

  if (cached.loaded) {
    cached.logAction({ operation: "read", collection: "purchases", status: "success" });
    cached.logAction({ operation: "read", collection: "sales", status: "success" });
    return { user: cached.user!, purchases: cached.purchases, sales: cached.sales, ledgerEntries: cached.ledgerEntries, ledgerSearch };
  }

  const data = await serverLoader();
  useStore.getState().populate(data);
  return { ...data, ledgerSearch };
}

export default function UserLedger({ loaderData }: Route.ComponentProps) {
  const userName = loaderData.user.name;

  const allRows: LedgerRow[] = (
    loaderData.ledgerEntries.length > 0
      ? loaderData.ledgerEntries
          .filter((e) => e.actor === userName)
          .map((entry) => ({
            id: `${entry.type}-${entry.id}`,
            type: entry.type,
            dateTime: entry.dateTime,
            laptopName: entry.laptopName,
            model: entry.model,
            processor: entry.processor,
            generation: entry.generation,
            year: entry.year,
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
          ...loaderData.purchases
            .filter((p) => p.createdBy === userName)
            .map((purchase) => {
              const s = (purchase as any).ledgerSnapshot ?? purchase;
              return {
                id: `buy-${purchase.id}`,
                type: "buy" as const,
                dateTime: s.createdAt,
                laptopName: s.laptopName,
                model: s.model,
                processor: s.processor,
                generation: s.generation,
                year: s.year,
                ram: s.ram,
                rom: s.rom,
                gpu: s.gpu,
                quantity: s.quantity,
                unitPrice: s.unitPrice,
                boughtPrice: null,
                soldPrice: null,
                profit: null,
                total: s.totalPrice,
                actor: s.createdBy || userName,
              };
            }),
          ...loaderData.sales
            .filter((s) => s.soldBy === userName)
            .map((sale) => ({
              id: `sell-${sale.id}`,
              type: "sell" as const,
              dateTime: sale.soldAt,
              laptopName: sale.laptopName,
              model: sale.model,
              processor: sale.processor,
              generation: sale.generation,
              year: sale.year,
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
  ).sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
  .filter((r) => r.type === "sell");

  const ledgerQuery = loaderData.ledgerSearch?.toLowerCase() ?? "";
  const filteredRows = ledgerQuery
    ? allRows.filter((r) =>
        `${r.laptopName} ${r.processor} ${r.generation}th ${r.year ?? ""} ${r.model} ${r.ram} ${r.rom} ${r.gpu}`.toLowerCase().includes(ledgerQuery)
      )
    : allRows;

  let lastDateLabel = "";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
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
              className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
            >
              Ledger
            </Link>
            <Link
              to="/user"
              className="w-full rounded-xl border-2 border-slate-400 bg-slate-50 px-4 py-2.5 text-center text-sm font-bold text-slate-800 transition hover:bg-slate-100 sm:w-auto"
            >
              Stock
            </Link>
          </div>
        </div>

        <Form method="get" action="/user/ledger" className="mt-4 flex gap-2">
          <input
            type="text"
            name="ledgerSearch"
            defaultValue={loaderData.ledgerSearch}
            placeholder="Search by name, processor, generation, model"
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
          <p className="text-sm text-slate-600">{allRows.length === 0 ? "No ledger records yet." : "No records matched your search."}</p>
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
                  <th className="border-r border-slate-200 px-2.5 py-1.5">Sold Price</th>
                  <th className="px-2.5 py-1.5">By</th>
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
                          <td colSpan={12} className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">
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
                          {row.soldPrice != null ? pkFormat(row.soldPrice) : pkFormat(row.unitPrice)}
                        </td>
                        <td className={`px-2.5 py-1.5 ${cellBorderTone}`}>{getDisplayName(row.actor)}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
