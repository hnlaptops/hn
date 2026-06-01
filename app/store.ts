import { create } from "zustand";
import type { PurchaseRecord, SaleRecord, LedgerEntry } from "./pos.server";

export function pkFormat(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export type CachedUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user" | "customer";
};

export type CrudAction = {
  operation: "read" | "create" | "update" | "delete";
  collection: "purchases" | "sales";
  status: "pending" | "success" | "error";
  timestamp: number;
};

type StoreState = {
  user: CachedUser | null;
  purchases: PurchaseRecord[];
  sales: SaleRecord[];
  ledgerEntries: LedgerEntry[];
  loaded: boolean;
  actionLog: CrudAction[];
  setUser: (user: CachedUser) => void;
  setPurchases: (records: PurchaseRecord[]) => void;
  setSales: (records: SaleRecord[]) => void;
  populate: (data: {
    user: CachedUser;
    purchases: PurchaseRecord[];
    sales?: SaleRecord[];
    ledgerEntries?: LedgerEntry[];
  }) => void;
  logAction: (action: Omit<CrudAction, "timestamp">) => void;
  clearCache: () => void;
};

export const useStore = create<StoreState>((set) => ({
  user: null,
  purchases: [],
  sales: [],
  ledgerEntries: [],
  loaded: false,
  actionLog: [],
  setUser: (user) => set({ user }),
  setPurchases: (purchases) => set({ purchases, loaded: true }),
  setSales: (sales) => set({ sales }),
  populate: (data) =>
    set({
      user: data.user,
      purchases: data.purchases,
      sales: data.sales ?? [],
      ledgerEntries: data.ledgerEntries ?? [],
      loaded: true,
    }),
  logAction: (action) =>
    set((state) => ({
      actionLog: [
        { ...action, timestamp: Date.now() },
        ...state.actionLog.slice(0, 99),
      ],
    })),
  clearCache: () =>
    set({ user: null, purchases: [], sales: [], ledgerEntries: [], loaded: false }),
}));
