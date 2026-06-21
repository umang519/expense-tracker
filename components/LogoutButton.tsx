"use client";

import { useState } from "react";
import SignOutModal from "./SignOutModal";

export default function LogoutButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        Sign out
      </button>

      <SignOutModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
