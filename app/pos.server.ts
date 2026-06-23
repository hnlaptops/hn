import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase/firebase";

export type PurchaseRecord = {
  id: string;
  laptopName: string;
  model: string;
  processor: "i3" | "i5" | "i7" | "i9" | "ryzen 3" | "ryzen 5" | "ryzen 7" | "ryzen 9" | "a4" | "a6" | "a8" | "a10" | "a12";
  generation: number;
  year: number | null;
  isMacBook: boolean;
  ram: string;
  rom: string;
  gpu: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdBy: string;
  createdAt: string;
  ledgerSnapshot: {
    laptopName: string;
    model: string;
    processor: "i3" | "i5" | "i7" | "i9" | "ryzen 3" | "ryzen 5" | "ryzen 7" | "ryzen 9" | "a4" | "a6" | "a8" | "a10" | "a12";
    generation: number;
    year: number | null;
    isMacBook: boolean;
    ram: string;
    rom: string;
    gpu: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    createdBy: string;
    createdAt: string;
  };
};

export type SaleRecord = {
  id: string;
  stockRecordId: string;
  laptopName: string;
  model: string;
  processor: "i3" | "i5" | "i7" | "i9" | "ryzen 3" | "ryzen 5" | "ryzen 7" | "ryzen 9" | "a4" | "a6" | "a8" | "a10" | "a12";
  generation: number;
  year: number | null;
  isMacBook: boolean;
  ram: string;
  rom: string;
  gpu: string;
  quantity: number;
  stockUnitPrice: number;
  soldUnitPrice: number;
  totalPrice: number;
  soldBy: string;
  soldAt: string;
};

export type LedgerEntry = {
  id: string;
  type: "buy" | "sell";
  recordId: string;
  dateTime: string;
  laptopName: string;
  model: string;
  processor: "i3" | "i5" | "i7" | "i9" | "ryzen 3" | "ryzen 5" | "ryzen 7" | "ryzen 9" | "a4" | "a6" | "a8" | "a10" | "a12";
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
  total: number;
  actor: string;
};

type PurchaseInput = {
  laptopName: string;
  model: string;
  processor: "i3" | "i5" | "i7" | "i9" | "ryzen 3" | "ryzen 5" | "ryzen 7" | "ryzen 9" | "a4" | "a6" | "a8" | "a10" | "a12";
  generation: number;
  year: number | null;
  isMacBook: boolean;
  ram: string;
  rom: string;
  gpu: string;
  quantity: number;
  unitPrice: number;
  createdBy: string;
};

type SellResult =
  | { success: true }
  | { success: false; error: string };

const purchasesCol = collection(db, "purchases");
const salesCol = collection(db, "sales");
const ledgerCol = collection(db, "ledger");

type LedgerSnapshot = PurchaseRecord["ledgerSnapshot"];

function toPurchaseRecord(id: string, data: Record<string, unknown>): PurchaseRecord {
  const rawSnapshot = data.ledgerSnapshot as Record<string, unknown> | undefined;
  const snapshot: LedgerSnapshot = rawSnapshot
    ? {
        laptopName: String(rawSnapshot.laptopName ?? ""),
        model: String(rawSnapshot.model ?? ""),
        processor: String(rawSnapshot.processor ?? "i5") as PurchaseRecord["processor"],
        generation: Number(rawSnapshot.generation ?? 0),
        year: rawSnapshot.year != null ? Number(rawSnapshot.year) : null,
        isMacBook: Boolean(rawSnapshot.isMacBook ?? false),
        ram: String(rawSnapshot.ram ?? ""),
        rom: String(rawSnapshot.rom ?? ""),
        gpu: String(rawSnapshot.gpu ?? ""),
        quantity: Number(rawSnapshot.quantity ?? 0),
        unitPrice: Number(rawSnapshot.unitPrice ?? 0),
        totalPrice: Number(rawSnapshot.totalPrice ?? 0),
        createdBy: String(rawSnapshot.createdBy ?? ""),
        createdAt: String(rawSnapshot.createdAt ?? ""),
      }
    : {
        laptopName: String(data.laptopName ?? ""),
        model: String(data.model ?? ""),
        processor: String(data.processor ?? "i5") as PurchaseRecord["processor"],
        generation: Number(data.generation ?? 0),
        year: data.year != null ? Number(data.year) : null,
        isMacBook: Boolean(data.isMacBook ?? false),
        ram: String(data.ram ?? ""),
        rom: String(data.rom ?? ""),
        gpu: String(data.gpu ?? ""),
        quantity: Number(data.quantity ?? 0),
        unitPrice: Number(data.unitPrice ?? 0),
        totalPrice: Number(data.totalPrice ?? 0),
        createdBy: String(data.createdBy ?? ""),
        createdAt: String(data.createdAt ?? ""),
      };

  return {
    id,
    laptopName: String(data.laptopName ?? ""),
    model: String(data.model ?? ""),
    processor: String(data.processor ?? "i5") as PurchaseRecord["processor"],
    generation: Number(data.generation ?? 0),
    year: data.year != null ? Number(data.year) : null,
    isMacBook: Boolean(data.isMacBook ?? false),
    ram: String(data.ram ?? ""),
    rom: String(data.rom ?? ""),
    gpu: String(data.gpu ?? ""),
    quantity: Number(data.quantity ?? 0),
    unitPrice: Number(data.unitPrice ?? 0),
    totalPrice: Number(data.totalPrice ?? 0),
    createdBy: String(data.createdBy ?? ""),
    createdAt: String(data.createdAt ?? ""),
    ledgerSnapshot: snapshot,
  };
}

function toSaleRecord(id: string, data: Record<string, unknown>): SaleRecord {
  return {
    id,
    stockRecordId: String(data.stockRecordId ?? ""),
    laptopName: String(data.laptopName ?? ""),
    model: String(data.model ?? ""),
    processor: String(data.processor ?? "i5") as SaleRecord["processor"],
    generation: Number(data.generation ?? 0),
    year: data.year != null ? Number(data.year) : null,
    isMacBook: Boolean(data.isMacBook ?? false),
    ram: String(data.ram ?? ""),
    rom: String(data.rom ?? ""),
    gpu: String(data.gpu ?? ""),
    quantity: Number(data.quantity ?? 0),
    stockUnitPrice: Number(data.stockUnitPrice ?? 0),
    soldUnitPrice: Number(data.soldUnitPrice ?? 0),
    totalPrice: Number(data.totalPrice ?? 0),
    soldBy: String(data.soldBy ?? ""),
    soldAt: String(data.soldAt ?? ""),
  };
}

function toLedgerEntry(id: string, data: Record<string, unknown>): LedgerEntry {
  return {
    id,
    type: String(data.type ?? "buy") as LedgerEntry["type"],
    recordId: String(data.recordId ?? ""),
    dateTime: String(data.dateTime ?? ""),
    laptopName: String(data.laptopName ?? ""),
    model: String(data.model ?? ""),
    processor: String(data.processor ?? "i5") as LedgerEntry["processor"],
    generation: Number(data.generation ?? 0),
    year: data.year != null ? Number(data.year) : null,
    isMacBook: Boolean(data.isMacBook ?? false),
    ram: String(data.ram ?? ""),
    rom: String(data.rom ?? ""),
    gpu: String(data.gpu ?? ""),
    quantity: Number(data.quantity ?? 0),
    unitPrice: Number(data.unitPrice ?? 0),
    boughtPrice: data.boughtPrice != null ? Number(data.boughtPrice) : null,
    soldPrice: data.soldPrice != null ? Number(data.soldPrice) : null,
    total: Number(data.total ?? 0),
    actor: String(data.actor ?? ""),
  };
}

export async function getPurchaseRecords(): Promise<PurchaseRecord[]> {
  const q = query(purchasesCol, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toPurchaseRecord(d.id, d.data() as Record<string, unknown>));
}

export async function getSaleRecords(): Promise<SaleRecord[]> {
  const q = query(salesCol, orderBy("soldAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toSaleRecord(d.id, d.data() as Record<string, unknown>));
}

export async function getLedgerEntries(): Promise<LedgerEntry[]> {
  const q = query(ledgerCol, orderBy("dateTime", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toLedgerEntry(d.id, d.data() as Record<string, unknown>));
}

export async function addPurchaseRecord(input: PurchaseInput): Promise<PurchaseRecord> {
  const totalPrice = Number((input.quantity * input.unitPrice).toFixed(2));
  const createdAt = new Date().toISOString();
  const snapshot: LedgerSnapshot = {
    laptopName: input.laptopName,
    model: input.model,
    processor: input.processor,
    generation: input.generation,
    year: input.year,
    isMacBook: input.isMacBook,
    ram: input.ram,
    rom: input.rom,
    gpu: input.gpu,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    totalPrice,
    createdBy: input.createdBy,
    createdAt,
  };
  const docData = {
    laptopName: input.laptopName,
    model: input.model,
    processor: input.processor,
    generation: input.generation,
    year: input.year,
    isMacBook: input.isMacBook,
    ram: input.ram,
    rom: input.rom,
    gpu: input.gpu,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    totalPrice,
    createdBy: input.createdBy,
    createdAt,
    ledgerSnapshot: snapshot,
  };

  const docRef = await addDoc(purchasesCol, docData);
  await addDoc(ledgerCol, {
    type: "buy",
    recordId: docRef.id,
    dateTime: createdAt,
    laptopName: input.laptopName,
    model: input.model,
    processor: input.processor,
    generation: input.generation,
    year: input.year,
    isMacBook: input.isMacBook,
    ram: input.ram,
    rom: input.rom,
    gpu: input.gpu,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    boughtPrice: null,
    soldPrice: null,
    total: totalPrice,
    actor: input.createdBy,
  });
  return { id: docRef.id, ...docData, ledgerSnapshot: snapshot };
}

export async function sellFromStock(
  recordId: string,
  sellQuantity: number,
  soldUnitPrice: number,
  soldBy: string,
): Promise<SellResult> {
  if (!recordId) {
    return { success: false, error: "Invalid stock record." };
  }

  if (!Number.isInteger(sellQuantity) || sellQuantity <= 0) {
    return { success: false, error: "Sell quantity must be greater than zero." };
  }

  if (!Number.isFinite(soldUnitPrice) || soldUnitPrice <= 0) {
    return { success: false, error: "Sold price must be greater than zero." };
  }

  const normalizedSoldBy = soldBy.trim();

  if (!normalizedSoldBy) {
    return { success: false, error: "Seller name is required." };
  }

  const purchaseRef = doc(db, "purchases", recordId);
  const purchaseSnap = await getDoc(purchaseRef);

  if (!purchaseSnap.exists()) {
    return { success: false, error: "Stock record not found." };
  }

  const purchaseData = toPurchaseRecord(purchaseSnap.id, purchaseSnap.data() as Record<string, unknown>);

  if (!purchaseSnap.data()?.ledgerSnapshot) {
    await updateDoc(purchaseRef, {
      ledgerSnapshot: {
        laptopName: purchaseData.laptopName,
        model: purchaseData.model,
        processor: purchaseData.processor,
        generation: purchaseData.generation,
        year: purchaseData.year,
        isMacBook: purchaseData.isMacBook,
        ram: purchaseData.ram,
        rom: purchaseData.rom,
        quantity: purchaseData.quantity,
        unitPrice: purchaseData.unitPrice,
        totalPrice: purchaseData.totalPrice,
        createdBy: purchaseData.createdBy,
        createdAt: purchaseData.createdAt,
      },
    });
  }

  if (sellQuantity > purchaseData.quantity) {
    return { success: false, error: "Sell quantity is more than available stock." };
  }

  const saleDocData = {
    stockRecordId: recordId,
    laptopName: purchaseData.laptopName,
    model: purchaseData.model,
    processor: purchaseData.processor,
    generation: purchaseData.generation,
    year: purchaseData.year,
    isMacBook: purchaseData.isMacBook,
    ram: purchaseData.ram,
    rom: purchaseData.rom,
    gpu: purchaseData.gpu,
    quantity: sellQuantity,
    stockUnitPrice: purchaseData.unitPrice,
    soldUnitPrice,
    totalPrice: Number((sellQuantity * soldUnitPrice).toFixed(2)),
    soldBy: normalizedSoldBy,
    soldAt: new Date().toISOString(),
  };

  const saleRef = await addDoc(salesCol, saleDocData);

  const soldAt = saleDocData.soldAt;
  await addDoc(ledgerCol, {
    type: "sell",
    recordId: saleRef.id,
    dateTime: soldAt,
    laptopName: saleDocData.laptopName,
    model: saleDocData.model,
    processor: saleDocData.processor,
    generation: saleDocData.generation,
    year: saleDocData.year,
    isMacBook: saleDocData.isMacBook,
    ram: saleDocData.ram,
    rom: saleDocData.rom,
    gpu: saleDocData.gpu,
    quantity: saleDocData.quantity,
    unitPrice: saleDocData.soldUnitPrice,
    boughtPrice: saleDocData.stockUnitPrice,
    soldPrice: saleDocData.soldUnitPrice,
    total: saleDocData.totalPrice,
    actor: saleDocData.soldBy,
  });

  const remaining = purchaseData.quantity - sellQuantity;

  await updateDoc(purchaseRef, {
    quantity: Math.max(remaining, 0),
    totalPrice: Number((Math.max(remaining, 0) * purchaseData.unitPrice).toFixed(2)),
  });

  return { success: true };
}

export async function updatePurchaseRecord(
  id: string,
  updates: {
    laptopName?: string;
    model?: string;
    processor?: "i3" | "i5" | "i7" | "i9" | "ryzen 3" | "ryzen 5" | "ryzen 7" | "ryzen 9" | "a4" | "a6" | "a8" | "a10" | "a12";
    generation?: number;
    year?: number | null;
    isMacBook?: boolean;
    ram?: string;
    rom?: string;
    gpu?: string;
    quantity?: number;
    unitPrice?: number;
    createdBy?: string;
  },
): Promise<void> {
  const ref = doc(db, "purchases", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Purchase record not found");

  const current = snap.data();

  if (!current.ledgerSnapshot) {
    await updateDoc(ref, {
      ledgerSnapshot: {
        laptopName: String(current.laptopName ?? ""),
        model: String(current.model ?? ""),
        processor: String(current.processor ?? "i5"),
        generation: Number(current.generation ?? 0),
        year: current.year != null ? Number(current.year) : null,
        isMacBook: Boolean(current.isMacBook ?? false),
        ram: String(current.ram ?? ""),
        rom: String(current.rom ?? ""),
        gpu: String(current.gpu ?? ""),
        quantity: Number(current.quantity ?? 0),
        unitPrice: Number(current.unitPrice ?? 0),
        totalPrice: Number(current.totalPrice ?? 0),
        createdBy: String(current.createdBy ?? ""),
        createdAt: String(current.createdAt ?? ""),
      },
    });
  }

  const quantity = updates.quantity ?? Number(current.quantity);
  const unitPrice = updates.unitPrice ?? Number(current.unitPrice);

  await updateDoc(ref, {
    ...updates,
    totalPrice: Number((quantity * unitPrice).toFixed(2)),
  });
}

export async function updateSaleRecord(
  id: string,
  updates: {
    laptopName?: string;
    model?: string;
    processor?: "i3" | "i5" | "i7" | "i9" | "ryzen 3" | "ryzen 5" | "ryzen 7" | "ryzen 9" | "a4" | "a6" | "a8" | "a10" | "a12";
    generation?: number;
    year?: number | null;
    isMacBook?: boolean;
    ram?: string;
    rom?: string;
    gpu?: string;
    quantity?: number;
    soldUnitPrice?: number;
    stockUnitPrice?: number;
    soldBy?: string;
  },
): Promise<void> {
  const ref = doc(db, "sales", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Sale record not found");

  const current = snap.data();
  const quantity = updates.quantity ?? Number(current.quantity);
  const soldUnitPrice = updates.soldUnitPrice ?? Number(current.soldUnitPrice);

  await updateDoc(ref, {
    ...updates,
    totalPrice: Number((quantity * soldUnitPrice).toFixed(2)),
  });
}

export async function returnToStock(
  saleId: string,
): Promise<SellResult> {
  if (!saleId) {
    return { success: false, error: "Invalid sale record." };
  }

  const saleRef = doc(db, "sales", saleId);
  const saleSnap = await getDoc(saleRef);

  if (!saleSnap.exists()) {
    return { success: false, error: "Sale record not found." };
  }

  const saleData = toSaleRecord(saleSnap.id, saleSnap.data() as Record<string, unknown>);

  const purchaseRef = doc(db, "purchases", saleData.stockRecordId);
  const purchaseSnap = await getDoc(purchaseRef);

  if (!purchaseSnap.exists()) {
    return { success: false, error: "Associated stock record not found." };
  }

  const purchaseData = toPurchaseRecord(purchaseSnap.id, purchaseSnap.data() as Record<string, unknown>);

  const newQuantity = purchaseData.quantity + saleData.quantity;

  await updateDoc(purchaseRef, {
    quantity: newQuantity,
    totalPrice: Number((newQuantity * purchaseData.unitPrice).toFixed(2)),
  });

  const ledgerQ = query(ledgerCol, where("type", "==", "sell"), where("recordId", "==", saleId));
  const ledgerSnap = await getDocs(ledgerQ);
  for (const ledgerDoc of ledgerSnap.docs) {
    await deleteDoc(doc(db, "ledger", ledgerDoc.id));
  }

  await deleteDoc(saleRef);

  return { success: true };
}

export async function deletePurchaseRecord(id: string): Promise<void> {
  const ref = doc(db, "purchases", id);
  await deleteDoc(ref);
}

export async function deleteSaleRecord(id: string): Promise<void> {
  const ref = doc(db, "sales", id);
  await deleteDoc(ref);
}

export async function getSalesByStockRecordId(purchaseId: string): Promise<SaleRecord[]> {
  const q = query(salesCol, where("stockRecordId", "==", purchaseId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toSaleRecord(d.id, d.data() as Record<string, unknown>));
}
