import { Fragment } from "react";
import type { Route } from "./+types/customer";
import { Form } from "react-router";
import { requireRole } from "../auth.server";
import { getPurchaseRecords } from "../pos.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Available Stock" },
    { name: "description", content: "View available stock" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "customer");
  const purchases = await getPurchaseRecords();
  return { user, purchases };
}

export default function CustomerView({ loaderData }: Route.ComponentProps) {
  const stock = loaderData.purchases.filter((p) => p.quantity > 0);

  let lastDateLabel = "";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Available Stock</p>
          <span className="text-sm font-medium text-slate-600">
            {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          <Form method="post" action="/logout">
            <button
              type="submit"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Logout
            </button>
          </Form>
        </div>
      </section>

      <section className="mt-32 w-full rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">Current Stock</h2>
        {stock.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No stock available.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Added At</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Laptop</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Model</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Processor</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">Gen / Year</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">RAM</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">ROM</th>
                  <th className="px-2.5 py-1.5 border-r border-slate-200">GPU</th>
                  <th className="px-2.5 py-1.5">Stock</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((purchase) => {
                  const dateLabel = new Date(purchase.createdAt).toLocaleDateString();
                  const shouldRenderDateHeader = dateLabel !== lastDateLabel;

                  if (shouldRenderDateHeader) {
                    lastDateLabel = dateLabel;
                  }

                  return (
                    <Fragment key={purchase.id}>
                      {shouldRenderDateHeader ? (
                        <tr className="border-t border-slate-300 bg-slate-50">
                          <td colSpan={9} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                            Date: {dateLabel}
                          </td>
                        </tr>
                      ) : null}
                      <tr className="border-t border-slate-200 bg-white">
                        <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">
                          {new Date(purchase.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-900">{purchase.laptopName}</td>
                        <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{purchase.model}</td>
                        <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{purchase.processor.toUpperCase()}</td>
                        <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{purchase.year ?? `${purchase.generation}th`}</td>
                        <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{purchase.ram}</td>
                        <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{purchase.rom}</td>
                        <td className="px-2.5 py-1.5 border-r border-slate-200 text-slate-700">{purchase.gpu || "-"}</td>
                        <td className={`px-2.5 py-1.5 font-bold ${purchase.quantity > 1 ? "text-emerald-600" : "text-slate-900"}`}>{purchase.quantity}</td>
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
