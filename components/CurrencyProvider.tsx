"use client";

import { createContext, useContext } from "react";

// The user's display currency (a label only — amounts are never converted).
// Loaded once by the (app) layout on the server; Settings calls router.refresh()
// after a change, which re-renders the layout and updates this value.
const CurrencyContext = createContext("INR");

export function CurrencyProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): string {
  return useContext(CurrencyContext);
}
