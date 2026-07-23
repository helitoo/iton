import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  VscChevronRight,
  VscFolder,
  VscFolderOpened,
  VscFileText,
  VscFileMedia,
  VscFilePdf,
} from "react-icons/vsc";
import { fileKind } from "../../utils/pathUtils";

function FileIcon({ ext }) {
  const kind = fileKind(ext);
  if (kind === "image")
    return <VscFileMedia size={16} className="shrink-0 text-gray-400" />;
  if (kind === "pdf")
    return <VscFilePdf size={16} className="shrink-0 text-gray-400" />;
  return <VscFileText size={16} className="shrink-0 text-gray-400" />;
}

function FolderNode({ node, depth, onNavigate }) {
  const [open, setOpen] = useState(false);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm text-gray-700 hover:bg-gray-100 font-medium cursor-pointer"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        title={node.name}
      >
        <VscChevronRight
          size={14}
          className={`shrink-0 transition-transform text-gray-400 ${open ? "rotate-90" : ""}`}
        />
        {open ? (
          <VscFolderOpened size={16} className="shrink-0 text-blue-600" />
        ) : (
          <VscFolder size={16} className="shrink-0 text-blue-600" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {open && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNode
              key={child.path + child.type}
              node={child}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function FileNode({ node, depth, onNavigate }) {
  return (
    <li>
      <NavLink
        to={`/${node.route}`}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm truncate ${
            isActive
              ? "bg-blue-50 text-blue-700 font-semibold"
              : "text-gray-600 hover:bg-gray-100"
          }`
        }
        style={{ paddingLeft: `${depth * 14 + 28}px` }}
        title={node.name}
      >
        <FileIcon ext={node.ext} />
        <span className="truncate">{node.name}</span>
      </NavLink>
    </li>
  );
}

function TreeNode({ node, depth, onNavigate }) {
  if (node.type === "folder") {
    return <FolderNode node={node} depth={depth} onNavigate={onNavigate} />;
  }
  return <FileNode node={node} depth={depth} onNavigate={onNavigate} />;
}

export default function SidebarTree({ tree, onNavigate }) {
  if (!tree || tree.children.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-gray-400">Chưa có nội dung nào.</p>
    );
  }

  return (
    <ul className="py-2">
      {tree.children.map((child) => (
        <TreeNode
          key={child.path + child.type}
          node={child}
          depth={0}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}
