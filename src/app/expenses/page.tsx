"use client";

import { useMemo, useState } from "react";
import { useFinance } from "@/lib/use-finance";
import { formatMoney } from "@/lib/calc-engine";
import { useTranslation } from "@/lib/i18n";
import { categoryOptions, categoryLabel } from "@/lib/categories";

const CATEGORIES = [
  "Comida", "Supermercado", "Restaurantes", "Transporte", "Compras",
  "Ocio", "Salud", "Deporte", "Facturas", "Suscripciones", "Viajes",
  "Mascotas", "Educación", "Otro",
];

function currentMonthValue(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function ExpensesPage() {
  const { state, calc, addExpense, deleteExpense, hydrated } = useFinance();
  const { t, tVars, lang, locale } = useTranslation();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(currentMonthValue());

  const monthExpenses = useMemo(
    () => state.expenses.filter((e) => e.date.slice(0, 7) === month).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [state.expenses, month]
  );
  const monthTotal = useMemo(
    () => monthExpenses.reduce((s, e) => s + e.amountMinor, 0),
    [monthExpenses]
  );

  if (!hydrated) return null;
  const currency = state.profile.currency || "EUR";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return;
    addExpense({
      amountMinor: Math.round(parseFloat(amount) * 100),
      currency,
      category,
      description,
      date,
      paymentMethod: "card",
    });
    setAmount("");
    setDescription("");
  }

  function exportMonthCsv() {
    const header = ["Fecha", "Categoría", "Descripción", "Monto", "Moneda"];
    const rows = monthExpenses.map((e) => [
      e.date,
      categoryLabel(e.category, lang),
      e.description || "",
      (e.amountMinor / 100).toFixed(2),
      e.currency,
    ]);

    // Category subtotals at the end, so it reads like a real monthly summary
    const byCategory = new Map<string, number>();
    for (const e of monthExpenses) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountMinor);
    }

    const lines = [
      header.join(","),
      ...rows.map((r) => r.map(csvEscape).join(",")),
      "",
      ["", t("month_total"), "", (monthTotal / 100).toFixed(2), currency].map(csvEscape).join(","),
      "",
      ["Categoría", "Total"].join(","),
      ...[...byCategory.entries()].map(([cat, total]) =>
        [categoryLabel(cat, lang), (total / 100).toFixed(2)].map(csvEscape).join(",")
      ),
    ];

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nuvio-gastos-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <p className="text-ink/50 text-xs uppercase tracking-wide mb-1">{t("safe_to_spend_short")}</p>
        <p className="font-display text-3xl">
          {formatMoney(Math.max(0, calc.recommendedDailySpendingMinor), currency, locale)}
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-3">
        <h2 className="font-display text-lg">{t("add_expense_heading")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder={tVars("amount_with_currency", { c: currency })}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categoryOptions(CATEGORIES, lang).map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            className="input"
            placeholder={t("description_placeholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button type="submit" className="w-full bg-moss text-paper py-2.5 rounded-full text-sm font-medium">
          {t("save_expense")}
        </button>
      </form>

      <div className="card">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h2 className="font-display text-lg">{t("history_title")}</h2>
          <div className="flex items-center gap-2">
            <input
              className="input !w-auto text-sm py-1.5"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <button
              onClick={exportMonthCsv}
              disabled={monthExpenses.length === 0}
              className="bg-ink text-paper px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-30 whitespace-nowrap"
            >
              {t("export_month_csv")}
            </button>
          </div>
        </div>

        <div className="flex justify-between items-baseline mb-3 pb-3 border-b border-mist">
          <span className="text-sm text-ink/50">{t("month_total")}</span>
          <span className="font-mono text-lg">{formatMoney(monthTotal, currency, locale)}</span>
        </div>

        {monthExpenses.length === 0 ? (
          <p className="text-ink/50 text-sm">{t("no_expenses_this_month")}</p>
        ) : (
          <ul className="divide-y divide-mist">
            {monthExpenses.map((e) => (
              <li key={e.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <p className="text-ink font-medium">{e.description || categoryLabel(e.category, lang)}</p>
                  <p className="text-ink/40 text-xs">
                    {categoryLabel(e.category, lang)} · {new Date(e.date).toLocaleDateString(locale)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono">{formatMoney(e.amountMinor, e.currency, locale)}</span>
                  <button
                    onClick={() => deleteExpense(e.id)}
                    className="text-ink/30 hover:text-alert text-xs"
                    aria-label={t("delete_word")}
                  >
                    {t("delete_word")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
