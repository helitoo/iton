import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VscSearch, VscClose } from "react-icons/vsc";
import { useContentData } from "../../utils/context/ContentContext";
import { searchFiles } from "../../utils/search";

export default function SearchBar() {
  const { manifest } = useContentData();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const r = await searchFiles(manifest, query);
      setResults(r);
      setLoading(false);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, manifest]);

  function goTo(file) {
    navigate(`/${file.id}`);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md search-bar">
      <div className="flex items-center gap-2 bg-gray-100 rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-blue-600">
        <VscSearch size={16} className="text-gray-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm kiếm..."
          className="bg-transparent outline-none text-sm w-full text-gray-800 placeholder:text-gray-400"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Xóa"
            className="text-gray-400 hover:text-gray-600"
          >
            <VscClose size={14} />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-50">
          {loading && (
            <p className="px-3 py-2 text-sm text-gray-400">Đang tìm...</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">
              Không tìm thấy kết quả.
            </p>
          )}
          {!loading &&
            results.map((r) => (
              <button
                key={r.path}
                onClick={() => goTo(r)}
                className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-50 last:border-0"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-gray-800 truncate">
                    {r.name}
                  </span>
                  <span className="block text-xs text-gray-400 truncate">
                    {r.path}
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
