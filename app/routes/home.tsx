import type { Route } from "./+types/home";
import { Form, Link, redirect } from "react-router";

import { createUserSession, findUserByCredentials, getSignedInUser } from "../auth.server";

const signInAccounts = [
  {
    key: "hn-laptops",
    label: "HN LAPTOPS (Admin)",
    email: "admin@example.com",
    helper: "Admin access",
    tone: "border-amber-200 bg-amber-50/80 hover:bg-amber-100/70",
  },
  {
    key: "ns-computers",
    label: "NS COMPUTERS",
    email: "user1@example.com",
    helper: "User access",
    tone: "border-sky-200 bg-sky-50/80 hover:bg-sky-100/70",
  },
  {
    key: "it-computers",
    label: "IT COMPUTERS",
    email: "user2@example.com",
    helper: "User access",
    tone: "border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/70",
  },
] as const;

type AccountKey = (typeof signInAccounts)[number]["key"];

type ActionData = {
  error: string;
};

type LoaderData = {
  selectedAccountKey: AccountKey | null;
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign In" },
    { name: "description", content: "Sign in to your account" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSignedInUser(request);

  if (user) {
    const roleHome: Record<string, string> = { admin: "/admin", user: "/user", customer: "/customer" };
    return redirect(roleHome[user.role] ?? "/");
  }

  const url = new URL(request.url);
  const account = url.searchParams.get("account");

  if (account === "customer") {
    const customerUser = findUserByCredentials("customer@example.com", "customer");
    if (customerUser) {
      return createUserSession(customerUser, "/customer");
    }
  }

  const selectedAccount = signInAccounts.find((entry) => entry.key === account);

  return {
    selectedAccountKey: selectedAccount?.key ?? null,
  } satisfies LoaderData;
}

export async function action({ request }: Route.ActionArgs): Promise<Response | ActionData> {
  const formData = await request.formData();

  const accountKey = String(formData.get("accountKey") ?? "") as AccountKey;
  const password = String(formData.get("password") ?? "");

  const selectedAccount = signInAccounts.find((entry) => entry.key === accountKey);

  if (!selectedAccount) {
    return { error: "Please choose an account first." };
  }

  if (!password) {
    return { error: "Password is required." };
  }

  const user = findUserByCredentials(selectedAccount.email, password);

  if (!user) {
    return { error: "Invalid password for selected account." };
  }

  return createUserSession(user, user.role === "admin" ? "/admin" : user.role === "customer" ? "/customer" : "/user");
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const selectedAccount = signInAccounts.find(
    (entry) => entry.key === loaderData.selectedAccountKey,
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#f8fafc_0%,_#eef2ff_55%,_#ecfeff_100%)] px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-30px_rgba(15,23,42,0.35)] md:p-8">
        <section>
          <p className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            HN Retail POS
          </p>
          <h1 className="mt-4 text-center text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
            Sign in to continue
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
          
          </p>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {signInAccounts.map((account) => (
            <Link
              key={account.key}
              to={`/?account=${account.key}`}
              className={`rounded-2xl border p-6 transition ${account.tone}`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                {account.helper}
              </p>
              <h2 className="mt-3 text-2xl font-bold leading-tight text-slate-900">
                {account.label}
              </h2>
            </Link>
          ))}
        </section>

        {selectedAccount ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
            <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_22px_72px_-36px_rgba(15,23,42,0.75)] sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Sign In</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Selected account: <strong>{selectedAccount.label}</strong>
                  </p>
                </div>
                <Link
                  to="/"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </Link>
              </div>

              <Form className="mt-6 space-y-4" method="post">
                <input type="hidden" name="accountKey" value={selectedAccount.key} />

                <label className="block text-sm font-medium text-slate-800" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter password"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                  required
                  autoFocus
                />

                {actionData?.error ? (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {actionData.error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-300"
                >
                  Sign In
                </button>
              </Form>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
