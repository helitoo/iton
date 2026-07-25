import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  VscChevronRight,
  VscFolder,
  VscFolderOpened,
  VscFileText,
  VscFileMedia,
  VscFilePdf,
} from "react-icons/vsc";
import { fileKind, findFileForRoute } from "../../utils/pathUtils";
import { useContentData } from "../../utils/context/ContentContext";

function getParentFolderPaths(filePath) {
  if (!filePath) return [];
  const segments = filePath.split("/");
  const paths = [];
  for (let i = 0; i < segments.length - 1; i++) {
    paths.push(segments.slice(0, i + 1).join("/"));
  }
  return paths;
}

function FileIcon({ ext }) {
  const kind = fileKind(ext);
  if (kind === "image")
    return <VscFileMedia size={16} className="shrink-0 text-gray-400" />;
  if (kind === "pdf")
    return <VscFilePdf size={16} className="shrink-0 text-gray-400" />;
  return <VscFileText size={16} className="shrink-0 text-gray-400" />;
}

function FolderNode({
  node,
  depth,
  onNavigate,
  expandedFolders,
  onToggleFolder,
}) {
  const open = expandedFolders.has(node.path);

  return (
    <li>
      <button
        type="button"
        onClick={() => onToggleFolder(node.path)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm text-gray-700 hover:bg-gray-100 font-medium cursor-pointer"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        title={node.name}
      >
        <VscChevronRight
          size={14}
          className={`shrink-0 transition-transform text-gray-400 ${
            open ? "rotate-90" : ""
          }`}
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
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
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

function TreeNode({
  node,
  depth,
  onNavigate,
  expandedFolders,
  onToggleFolder,
}) {
  if (node.type === "folder") {
    return (
      <FolderNode
        node={node}
        depth={depth}
        onNavigate={onNavigate}
        expandedFolders={expandedFolders}
        onToggleFolder={onToggleFolder}
      />
    );
  }
  return <FileNode node={node} depth={depth} onNavigate={onNavigate} />;
}

export default function SidebarTree({ tree, onNavigate }) {
  const { manifest } = useContentData();
  const location = useLocation();
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());

  const routePath = location.pathname.replace(/^\//, "");
  const activeFile = useMemo(
    () => findFileForRoute(manifest, routePath),
    [manifest, routePath],
  );

  useEffect(() => {
    if (!activeFile?.path) return;
    const parentPaths = getParentFolderPaths(activeFile.path);
    if (parentPaths.length === 0) return;

    setExpandedFolders((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const p of parentPaths) {
        if (!next.has(p)) {
          next.add(p);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeFile?.path]);

  const handleToggleFolder = useCallback((folderPath) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

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
          expandedFolders={expandedFolders}
          onToggleFolder={handleToggleFolder}
        />
      ))}
    </ul>
  );
}
