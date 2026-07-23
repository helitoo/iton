import React, { useState } from "react";
import { VscListUnordered, VscClose } from "react-icons/vsc";
import { headingsToTree } from "../utils/extractHeadings";

function TocNode({ node, onNavigate }) {
  return (
    <li>
      <a
        href={`#${node.id}`}
        onClick={(e) => {
          e.preventDefault();
          onNavigate(node.id);
        }}
        className="block px-2 py-1 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded truncate"
      >
        {node.text}
      </a>
      {node.children.length > 0 && (
        <ul className="pl-3 border-l border-gray-100 ml-2">
          {node.children.map((child) => (
            <TocNode key={child.id} node={child} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TableOfContents({ headings }) {
  const [open, setOpen] = useState(false);

  if (!headings || headings.length === 0) return null;

  const tree = headingsToTree(headings);

  function navigate(id) {
    const targetId = decodeURIComponent(id);
    const el = document.getElementById(targetId) || document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.pushState(null, '', `#${targetId}`);
    }
    setOpen(false);
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/10 md:bg-transparent"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-64 h-[70vh] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl p-2">
          <ul>
            {tree.map((node) => (
              <TocNode key={node.id} node={node} onNavigate={navigate} />
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer fixed bottom-6 right-4 z-50 w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700"
        aria-label="Bật/tắt mục lục"
      >
        {open ? <VscClose size={20} /> : <VscListUnordered size={20} />}
      </button>
    </>
  );
}
