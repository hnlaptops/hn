import type { Route } from "./+types/logout";
import { redirect } from "react-router";

import { clearUserSession } from "../auth.server";
import { useStore } from "../store";

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  useStore.getState().clearCache();
  await serverAction();
}

export async function action({ request }: Route.ActionArgs) {
  return clearUserSession(request, "/");
}

export async function loader() {
  return redirect("/");
}

export default function LogoutRoute() {
  return null;
}
