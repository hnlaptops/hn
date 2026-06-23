import { useState, useEffect } from "react";

const PRICE_ITEMS = [
  { key: "ram_8gb", label: "RAM 8GB" },
  { key: "ram_16gb", label: "RAM 16GB" },
  { key: "ssd_128", label: "SSD 128GB" },
  { key: "ssd_256", label: "SSD 256GB" },
  { key: "ssd_512", label: "SSD 512GB" },
  { key: "ssd_1tb", label: "SSD 1TB" },
  { key: "hdd_500", label: "HDD 500GB" },
  { key: "hdd_1tb", label: "HDD 1TB" },
];

const STORAGE_KEY = "hn_pricelist";

export default function PriceList() {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPrices(JSON.parse(stored));
    } catch {}
  }, []);

  const handleChange = (key: string, value: string) => {
    setPrices((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">Price List</h3>
        <button
          onClick={handleSave}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
        >
          {saved ? "Saved!" : "Save"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {PRICE_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <label className="text-xs text-slate-600 whitespace-nowrap">{item.label}:</label>
            <input
              type="number"
              value={prices[item.key] ?? ""}
              onChange={(e) => handleChange(item.key, e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
