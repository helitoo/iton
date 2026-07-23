import React from "react";
import { Link } from "react-router-dom";
import { VscMenu } from "react-icons/vsc";
import SearchBar from "./SearchBar";

export default function Navbar({ activeFileName, onToggleSidebar }) {
  return (
    <header className="fixed h-14 top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 flex items-center gap-4 px-4 py-2">
      <Link to="/" className="flex items-start flex-col gap-0 shrink-0">
        <span className="font-bold text-3xl text-blue-600">iton</span>
      </Link>

      <div className="flex-1 flex justify-center">
        <SearchBar />
      </div>

      <div
        className="print-page-title hidden sm:block text-sm text-gray-500 max-w-[220px] truncate"
        title={activeFileName || ""}
      >
        {activeFileName}
      </div>

      <button
        onClick={onToggleSidebar}
        className="md:hidden p-2 rounded-md hover:bg-gray-100 text-gray-700 shrink-0"
        aria-label="Mở/đóng danh mục"
      >
        <VscMenu size={20} />
      </button>
    </header>
  );
}
