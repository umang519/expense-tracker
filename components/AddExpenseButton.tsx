"use client";

import { useState } from "react";
import AddExpenseSheet from "./AddExpenseSheet";

export default function AddExpenseButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Add expense"
        className="fixed bottom-20 right-4 z-30 w-14 h-14 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-full shadow-lg flex items-center justify-center text-3xl leading-none transition-transform"
      >
        +
      </button>
      <AddExpenseSheet isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
