"use client";

import { useState } from "react";
import SignOutModal from "./SignOutModal";

export default function LogoutButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-red-300 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        Sign out
      </button>

      <SignOutModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
