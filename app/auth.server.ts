import { createCookieSessionStorage, redirect } from "react-router";

import usersData from "./users.json";

export type Role = "admin" | "user" | "customer";

type StoredUser = {
  id: number;
  name: string;
  email: string;
  password: string;
  role: Role;
};

export type SignedInUser = Omit<StoredUser, "password">;

const SESSION_KEY = "signedInUser";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__hn_web_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    secrets: [process.env.SESSION_SECRET ?? "demo-session-secret-change-me"],
    maxAge: 60 * 60 * 24,
  },
});

function getAllUsers(): StoredUser[] {
  return [usersData.admin as StoredUser, ...(usersData.users as StoredUser[])];
}

function sanitizeUser(user: StoredUser): SignedInUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export function findUserByCredentials(
  email: string,
  password: string,
): SignedInUser | null {
  const normalizedEmail = email.trim().toLowerCase();

  const matchedUser = getAllUsers().find(
    (user) =>
      user.email.toLowerCase() === normalizedEmail && user.password === password,
  );

  if (!matchedUser) {
    return null;
  }

  return sanitizeUser(matchedUser);
}

export async function getSignedInUser(
  request: Request,
): Promise<SignedInUser | null> {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const user = session.get(SESSION_KEY) as SignedInUser | undefined;
  return user ?? null;
}

export async function createUserSession(
  user: SignedInUser,
  redirectTo: string,
): Promise<Response> {
  const session = await sessionStorage.getSession();
  session.set(SESSION_KEY, user);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function clearUserSession(
  request: Request,
  redirectTo: string = "/",
): Promise<Response> {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export async function requireRole(
  request: Request,
  role: Role,
): Promise<SignedInUser> {
  const user = await getSignedInUser(request);

  if (!user) {
    throw redirect("/");
  }

  if (user.role !== role) {
    const roleRedirect: Record<string, string> = { admin: "/admin", user: "/user", customer: "/customer" };
    throw redirect(roleRedirect[user.role] ?? "/");
  }

  return user;
}
