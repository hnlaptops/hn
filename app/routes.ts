import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("admin", "routes/admin-ledger.tsx"),
  route("admin/stock", "routes/admin.tsx"),
  route("admin/profit", "routes/admin-profit.tsx"),
  route("user", "routes/user.tsx"),
  route("user/ledger", "routes/user-ledger.tsx"),
  route("customer", "routes/customer.tsx"),
  route("logout", "routes/logout.tsx"),
] satisfies RouteConfig;
