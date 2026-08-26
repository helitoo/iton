import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import katex from "katex";
import { visit } from "unist-util-visit";
import { slugify } from "./slugify";
import { resolveWikiHref, parseWikiLink } from "./localLinks";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

// Các rule bắt buộc của katex.min.css mà file CSS hiện tại của dự án không có.
// Ta "inline hóa" chúng trực tiếp vào node, thay vì phụ thuộc stylesheet ngoài.
const KATEX_REQUIRED_STYLES = {
  stretchy: "display:block;overflow:hidden;position:relative;width:100%;",
  fbox: "box-sizing:border-box;",
  cbox: "box-sizing:border-box;",
  boxpad: "padding:0 0.3em;",
};

function patchMissingKatexStyles(tree) {
  visit(tree, "element", (node) => {
    const classList = node.properties && node.properties.className;
    if (!Array.isArray(classList)) return;

    for (const cls of classList) {
      const extra = KATEX_REQUIRED_STYLES[cls];
      if (!extra) continue;

      const current = (node.properties.style || "").trim();
      // Tránh chèn trùng nếu node đã có style đó (idempotent).
      if (current.includes(extra)) continue;

      node.properties.style = current ? `${current};${extra}` : extra;
    }
  });
}

// Bổ sung cơ chế định vị "vlist" — cốt lõi mà rất nhiều cấu trúc KaTeX
// (phân số, boxed, accent, sqrt...) đều dựa vào để chồng các hàng lên nhau.
function patchVlistPositioning(tree) {
  visit(tree, "element", (node, index, parent) => {
    const classList = (node.properties && node.properties.className) || [];
    if (!Array.isArray(classList)) return;

    const addStyle = (n, extra) => {
      const current = (n.properties.style || "").trim();
      if (current.includes(extra)) return;
      n.properties.style = current ? `${current};${extra}` : extra;
    };

    if (classList.includes("vlist-t")) {
      addStyle(node, "display:inline-table;");
      if (classList.includes("vlist-t2")) addStyle(node, "margin-right:-2px;");
    }
    if (classList.includes("vlist-r")) {
      addStyle(node, "display:table-row;");
    }
    if (classList.includes("vlist-s")) {
      addStyle(
        node,
        "display:table-cell;vertical-align:bottom;font-size:1px;width:2px;",
      );
    }
    // .vlist (nhưng không phải vlist-t/-r/-s)
    if (
      classList.includes("vlist") &&
      !classList.some((c) => ["vlist-t", "vlist-r", "vlist-s"].includes(c))
    ) {
      addStyle(
        node,
        "display:table-cell;vertical-align:bottom;position:relative;",
      );
      // các span con trực tiếp — mỗi span này là 1 "hàng" có inline style top:...
      (node.children || []).forEach((row) => {
        if (row.type !== "element" || row.tagName !== "span") return;
        addStyle(row, "display:block;height:0;position:relative;");
        (row.children || []).forEach((inner) => {
          if (inner.type !== "element" || inner.tagName !== "span") return;
          addStyle(inner, "display:inline-block;");
        });
      });
    }
  });
}

// ---------------------------------------------------------------------------
// 1. Text preprocessing (runs on the raw markdown string before it reaches
//    the remark/react-markdown pipeline). This is where we translate
//    Obsidian-style wikilinks/embeds into normal markdown link/image syntax,
//    and make sure block math ($$...$$) always renders on its own line even
//    if the author wrote it inline with other text.
// ---------------------------------------------------------------------------

function escapeParens(text) {
  return text.replace(/[()]/g, (c) => (c === "(" ? "%28" : "%29"));
}

function encodeWikiTarget(target) {
  return escapeParens(encodeURI(target));
}

export function preprocessMarkdown(raw) {
  if (!raw || typeof raw !== "string") return "";
  let text = raw;

  // Convert leading tabs (\t) at line starts to 2 spaces.
  // In Obsidian, sub-lists use tab indentation (\t). Standard CommonMark/GFM
  // treats a leading tab as 4 spaces (Indented Code Block) if not preceded by a parent list.
  // Converting leading tabs to 2 spaces per tab ensures lists remain valid lists rather than code blocks.
  text = text.replace(/^(\t+)/gm, (_, tabs) => "  ".repeat(tabs.length));

  // Embeds: ![[target]] or ![[target|alt]]
  text = text.replace(/!\[\[([^\]]+)\]\]/g, (_m, content) => {
    const { target, alias } = parseWikiLink(content);
    return `![${alias}](${encodeWikiTarget(target)})`;
  });

  // Links: [[target]] or [[target|text]]
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_m, content) => {
    const { target, alias } = parseWikiLink(content);
    return `[${alias}](${encodeWikiTarget(target)})`;
  });

  // Force $$...$$ onto its own line/block cleanly while preserving list item indentation.
  // Note: if $$...$$ is used inside a table cell (line contains '|'), do not insert blank lines.
  text = text.replace(
    /\$\$([\s\S]+?)\$\$/g,
    (match, expr, offset, fullText) => {
      if (expr == null) return match;
      const lineStart = fullText.lastIndexOf("\n", offset);
      const lineEnd = fullText.indexOf("\n", offset);
      const currentLine = fullText.slice(
        lineStart === -1 ? 0 : lineStart + 1,
        lineEnd === -1 ? fullText.length : lineEnd,
      );
      if (currentLine.includes("|")) {
        return `$$${expr.trim()}$$`;
      }
      const indentMatch = currentLine.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : "";
      return `\n${indent}$$\n${indent}${expr.trim()}\n${indent}$$\n`;
    },
  );

  return text;
}

// ---------------------------------------------------------------------------
// 2. Callouts: >[!note] Header ... turned into a styled <div>.
// ---------------------------------------------------------------------------

const CALLOUT_TYPES = [
  "quote",
  "note",
  "important",
  "tip",
  "warning",
  "caution",
  "question",
];

const CALLOUT_STYLES = {
  quote: {
    container: "border-slate-600 bg-slate-50",
    title: "text-slate-700",
    icon: "🔖",
  },
  note: {
    container: "border-blue-600 bg-blue-50",
    title: "text-blue-700",
    icon: "ℹ️",
  },
  important: {
    container: "border-rose-600 bg-rose-50",
    title: "text-rose-700",
    icon: "❗",
  },
  tip: {
    container: "border-emerald-600 bg-emerald-50",
    title: "text-emerald-700",
    icon: "💡",
  },
  warning: {
    container: "border-amber-500 bg-amber-50",
    title: "text-amber-700",
    icon: "⚠️",
  },
  caution: {
    container: "border-red-600 bg-red-50",
    title: "text-red-700",
    icon: "🚫",
  },
  question: {
    container: "border-violet-600 bg-violet-50",
    title: "text-violet-700",
    icon: "❓",
  },
};

// A remark plugin that turns blockquotes starting with [!type] into
// callout divs.
export function remarkCallouts() {
  return (tree) => {
    visit(tree, "blockquote", (node) => {
      const firstParagraph = node.children[0];
      if (!firstParagraph || firstParagraph.type !== "paragraph") return;
      const firstText = firstParagraph.children[0];
      if (!firstText || firstText.type !== "text") return;

      const re = new RegExp(
        `^\\[!(${CALLOUT_TYPES.join("|")})\\]([^\\n]*)\\n?([\\s\\S]*)$`,
        "i",
      );
      const match = re.exec(firstText.value);
      if (!match) return;

      const calloutType = match[1].toLowerCase();
      const title = match[2].trim();
      const remainder = match[3];

      if (remainder) {
        firstText.value = remainder;
      } else {
        firstParagraph.children.shift();
        if (firstParagraph.children.length === 0) {
          node.children.shift();
        }
      }

      const style = CALLOUT_STYLES[calloutType];
      const titleText =
        title || calloutType.charAt(0).toUpperCase() + calloutType.slice(1);

      node.data = node.data || {};
      node.data.hName = "div";
      node.data.hProperties = {
        className: `callout not-prose border-l-4 rounded-r-md px-4 py-3 my-4 ${style.container}`,
        "data-callout": calloutType,
      };

      node.children.unshift({
        type: "paragraph",
        data: {
          hName: "div",
          hProperties: {
            className: `callout-title font-semibold mb-1 flex items-center gap-2 ${style.title}`,
          },
        },
        children: [
          { type: "text", value: `${style.icon} ` },
          { type: "text", value: titleText },
        ],
      });
    });
  };
}

// A remark plugin that recognizes inline code immediately preceding a code block
// (e.g. `abc..` followed by ```...```) as the filename header for that code block.
export function remarkCodeBlockFilename() {
  return (tree) => {
    visit(tree, "code", (node, index, parent) => {
      if (!parent || index == null || index === 0) return;

      const prevNode = parent.children[index - 1];
      if (!prevNode || prevNode.type !== "paragraph") return;

      const nonSpaceChildren = (prevNode.children || []).filter((child) => {
        if (child.type === "text") {
          return child.value && child.value.trim().length > 0;
        }
        return true;
      });

      if (
        nonSpaceChildren.length === 1 &&
        nonSpaceChildren[0].type === "inlineCode"
      ) {
        const filename = (nonSpaceChildren[0].value || "").trim();
        if (filename) {
          node.data = node.data || {};
          node.data.hProperties = node.data.hProperties || {};
          node.data.hProperties["data-filename"] = filename;

          parent.children.splice(index - 1, 1);
          return index - 1;
        }
      }
    });
  };
}

function hastToText(node) {
  if (!node) return "";
  if (node.type === "text") return node.value || "";
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(hastToText).join("");
  }
  return "";
}

export function rehypeHeadingIds() {
  return (tree) => {
    const usedSlugs = new Set();
    visit(tree, "element", (node) => {
      if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName)) {
        const text = hastToText(node);
        const id = slugify(text, usedSlugs);
        node.properties = node.properties || {};
        node.properties.id = id;
      }
    });
  };
}

// Custom rehype-katex wrapper to filter out KaTeX console warnings for non-ASCII/Vietnamese characters
// and character metrics while passing KaTeX configuration options.
// If any LaTeX/KaTeX math node has invalid syntax or throws an error (or generates "undefined"),
// we catch it and display the raw markdown math text as plain text.
function safeRehypeKatex(options) {
  let opts = options;
  let directTree = null;
  let directFile = null;

  if (options && typeof options === "object" && options.type === "root") {
    directTree = options;
    opts = {};
  }

  const defaultOptions = {
    strict: "ignore",
    trust: true,
    throwOnError: false,
    ...opts,
  };

  const katexPlugin = rehypeKatex(defaultOptions);

  const runner = (tree, file) => {
    if (!tree) return tree;

    // Filter out non-critical KaTeX console warnings for non-ASCII/Vietnamese characters
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const msg = typeof args[0] === "string" ? args[0] : "";
      if (
        msg.includes("No character metrics for") ||
        msg.includes("LaTeX-incompatible input") ||
        msg.includes("Unrecognized Unicode character") ||
        msg.includes("character metrics")
      ) {
        return;
      }
      originalWarn.apply(console, args);
    };

    try {
      // 1. Pre-pass: Validate all math nodes with KaTeX throwOnError: true.
      // If any math expression has wrong syntax or throws an error, convert it to plain text.
      visit(tree, (node) => {
        if (!node) return;

        const isMathNode =
          node.type === "inlineMath" ||
          node.type === "math" ||
          node.tagName === "inlineMath" ||
          node.tagName === "math" ||
          (node.type === "element" &&
            node.properties &&
            node.properties.className &&
            Array.isArray(node.properties.className) &&
            (node.properties.className.includes("math") ||
              node.properties.className.includes("math-inline") ||
              node.properties.className.includes("math-display") ||
              node.properties.className.some(
                (c) => typeof c === "string" && c.startsWith("language-math"),
              )));

        if (!isMathNode) return;

        const isDisplay =
          node.type === "math" ||
          node.tagName === "math" ||
          (node.properties &&
            node.properties.className &&
            Array.isArray(node.properties.className) &&
            (node.properties.className.includes("math-display") ||
              node.properties.className.includes("displayMode")));

        const rawCode = hastToText(node) || node.value || "";
        if (!rawCode || !rawCode.trim()) return;

        let isValid = true;
        try {
          const rendered = katex.renderToString(rawCode.trim(), {
            displayMode: isDisplay,
            throwOnError: true,
            trust: true,
            strict: "ignore",
          });
          if (
            !rendered ||
            typeof rendered !== "string" ||
            rendered.includes("undefined")
          ) {
            isValid = false;
          }
        } catch {
          isValid = false;
        }

        if (!isValid) {
          // Syntax error or KaTeX failure: render as plain text paragraph/span
          const rawText = isDisplay
            ? `$$${rawCode.trim()}$$`
            : `$${rawCode.trim()}$`;
          node.type = "element";
          node.tagName = isDisplay ? "div" : "span";
          node.properties = {
            className: isDisplay
              ? "math-fallback-block my-2 font-mono text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-2.5 rounded border border-gray-200"
              : "math-fallback-inline font-mono text-sm text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded",
          };
          node.children = [{ type: "text", value: rawText }];
          delete node.value;
        }
      });

      // 2. Run standard rehypeKatex on valid nodes
      katexPlugin(tree, file);
      patchMissingKatexStyles(tree);
      patchVlistPositioning(tree);
    } catch (e) {
      console.error("rehypeKatex execution error ignored:", e);
    } finally {
      console.warn = originalWarn;
    }

    // 3. Post-pass: Clean up any leftover katex-error or "undefined" text nodes in HAST tree
    visit(tree, (node, index, parent) => {
      if (!node) return;

      if (
        node.type === "element" &&
        node.properties &&
        node.properties.className &&
        Array.isArray(node.properties.className) &&
        node.properties.className.includes("katex-error")
      ) {
        const errorText = hastToText(node) || "";
        node.tagName = "span";
        node.properties = {
          className: "font-mono text-sm text-gray-700 bg-gray-100 px-1 rounded",
        };
        node.children = [
          { type: "text", value: errorText.replace(/^ParseError:\s*/i, "") },
        ];
      }

      if (node.type === "text" && node.value === "undefined") {
        if (parent && Array.isArray(parent.children) && index != null) {
          parent.children.splice(index, 1);
        } else {
          node.value = "";
        }
      }
    });

    return tree;
  };

  if (directTree) {
    return runner(directTree, directFile);
  }

  return runner;
}

export const remarkPlugins = [
  remarkGfm,
  remarkMath,
  remarkCallouts,
  remarkCodeBlockFilename,
];
export const rehypePlugins = [rehypeRaw, safeRehypeKatex, rehypeHeadingIds];

// ---------------------------------------------------------------------------
// 3. Mermaid diagram renderer
// ---------------------------------------------------------------------------

function MermaidBlock({ code }) {
  const ref = useRef(null);
  const id = useId().replace(/:/g, "");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    import("mermaid").then(async ({ default: mermaid }) => {
      try {
        mermaid.initialize({ startOnLoad: false, theme: "default" });
        const { svg } = await mermaid.render(`mermaid-${id}`, code);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) setError(String(e && e.message ? e.message : e));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <pre className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 overflow-x-auto">
        Lỗi sơ đồ Mermaid: {error}
      </pre>
    );
  }

  return <div className="my-4 flex justify-center overflow-x-auto" ref={ref} />;
}

// ---------------------------------------------------------------------------
// 4. React component overrides for react-markdown
// ---------------------------------------------------------------------------

function cleanChildren(children) {
  if (children == null || children === "undefined") return null;
  if (Array.isArray(children)) {
    const filtered = children.filter((c) => c != null && c !== "undefined");
    return filtered.length === 0 ? null : filtered;
  }
  return children;
}

function MarkdownImage({
  src,
  alt,
  manifest,
  currentFilePath,
  className = "",
  ...props
}) {
  let resolvedSrc = src;
  if (src) {
    const isExternal = /^(https?:)?\/\//.test(src);
    if (!isExternal) {
      try {
        const target = decodeURIComponent(src);
        const resolved = resolveWikiHref(manifest, currentFilePath, target);
        resolvedSrc = resolved.type === "missing" ? "" : resolved.href;
      } catch (e) {
        console.error("Failed to decode image src:", src, e);
      }
    }
  }

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!resolvedSrc) {
      setIsLoading(false);
      setHasError(true);
      return;
    }

    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setIsLoading(false);
        setHasError(false);
      } else {
        setIsLoading(false);
        setHasError(true);
      }
    } else {
      setIsLoading(true);
      setHasError(false);
    }
  }, [resolvedSrc]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError || !resolvedSrc) {
    return (
      <span className="inline-flex flex-col items-center justify-center w-full max-w-md p-4 my-3 mx-auto rounded-md border border-gray-200 bg-gray-50 text-gray-500 text-xs gap-1.5 select-none">
        <svg
          className="w-6 h-6 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>Không tải được hình ảnh{alt ? `: ${alt}` : ""}</span>
      </span>
    );
  }

  return (
    <span className="block relative my-3 mx-auto max-w-full text-center">
      {isLoading && (
        <span
          aria-hidden="true"
          className="inline-flex flex-col items-center justify-center w-full max-w-2xl h-56 sm:h-72 bg-gray-200/80 rounded-md animate-pulse text-gray-400 select-none"
        >
          <svg
            className="w-10 h-10 mb-2 opacity-40 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {alt && (
            <span className="text-xs text-gray-400 truncate max-w-xs px-2 font-normal">
              {alt}
            </span>
          )}
        </span>
      )}
      <img
        ref={imgRef}
        src={resolvedSrc}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={`max-w-full rounded-md mx-auto transition-opacity duration-300 ${
          isLoading ? "hidden" : "inline-block"
        } ${className}`.trim()}
        draggable={false}
        {...props}
      />
    </span>
  );
}

export function createMarkdownComponents({ manifest, currentFilePath }) {
  function headingFactory(Tag) {
    return function Heading({ id, children, ...props }) {
      return (
        <Tag id={id} className="scroll-mt-6 font-bold" {...props}>
          {cleanChildren(children)}
        </Tag>
      );
    };
  }

  const components = {
    h1: headingFactory("h1"),
    h2: headingFactory("h2"),
    h3: headingFactory("h3"),
    h4: headingFactory("h4"),
    h5: headingFactory("h5"),
    h6: headingFactory("h6"),
    a({ href, children, ...props }) {
      const safeChild = cleanChildren(children);
      if (href) {
        const isExternal =
          /^(https?:)?\/\//.test(href) ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:");
        const isAnchor = href.startsWith("#");
        if (isAnchor) {
          return (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                const id = decodeURIComponent(href.replace("#", ""));
                const el = document.getElementById(id);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className="text-blue-600 hover:underline font-medium"
              {...props}
            >
              {safeChild}
            </a>
          );
        }
        if (!isExternal) {
          try {
            const target = decodeURIComponent(href);
            const resolved = resolveWikiHref(manifest, currentFilePath, target);
            if (resolved.type === "anchor") {
              return (
                <a
                  href={resolved.href}
                  onClick={(e) => {
                    e.preventDefault();
                    const id = decodeURIComponent(resolved.href.replace("#", ""));
                    const el = document.getElementById(id);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className="text-blue-600 hover:underline font-medium"
                  {...props}
                >
                  {safeChild}
                </a>
              );
            }
            if (resolved.type === "route") {
              return (
                <Link
                  to={resolved.href}
                  className="text-blue-600 hover:underline font-medium"
                  {...props}
                >
                  {safeChild}
                </Link>
              );
            }
            if (resolved.type === "url") {
              return (
                <a
                  href={resolved.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                  {...props}
                >
                  {safeChild}
                </a>
              );
            }
            return (
              <span className="text-gray-500" {...props}>
                {safeChild}
              </span>
            );
          } catch (e) {
            console.error("Failed to decode local link href:", href, e);
          }
        }
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:underline font-medium"
          {...props}
        >
          {safeChild}
        </a>
      );
    },
    img(props) {
      return (
        <MarkdownImage
          manifest={manifest}
          currentFilePath={currentFilePath}
          {...props}
        />
      );
    },
    table({ children, ...props }) {
      return (
        <div className="overflow-x-auto my-4">
          <table className="min-w-full text-sm" {...props}>
            {cleanChildren(children)}
          </table>
        </div>
      );
    },
    th({ children, ...props }) {
      return (
        <th
          className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-bold"
          {...props}
        >
          {cleanChildren(children)}
        </th>
      );
    },
    td({ children, ...props }) {
      return (
        <td className="border border-gray-200 px-3 py-2 align-top" {...props}>
          {cleanChildren(children)}
        </td>
      );
    },
    p({ children, ...props }) {
      return (
        <p className="my-3 leading-relaxed text-gray-800" {...props}>
          {cleanChildren(children)}
        </p>
      );
    },
    li({ children, ...props }) {
      return (
        <li className="text-gray-800 leading-relaxed" {...props}>
          {cleanChildren(children)}
        </li>
      );
    },
    strong({ children, ...props }) {
      return (
        <strong className="font-bold text-gray-900" {...props}>
          {cleanChildren(children)}
        </strong>
      );
    },
    em({ children, ...props }) {
      return (
        <em className="italic" {...props}>
          {cleanChildren(children)}
        </em>
      );
    },
    hr(props) {
      return <hr className="my-6 border-gray-200" {...props} />;
    },
    blockquote({ children, ...props }) {
      return (
        <blockquote
          className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4"
          {...props}
        >
          {cleanChildren(children)}
        </blockquote>
      );
    },
    ul({ children, ...props }) {
      return (
        <ul className="list-disc pl-6 my-2 space-y-1" {...props}>
          {cleanChildren(children)}
        </ul>
      );
    },
    ol({ children, ...props }) {
      return (
        <ol className="list-decimal pl-6 my-2 space-y-1" {...props}>
          {cleanChildren(children)}
        </ol>
      );
    },
    pre({ children, ...props }) {
      const codeEl = Array.isArray(children) ? children[0] : children;
      const codeClassName =
        codeEl && codeEl.props ? codeEl.props.className : "";
      const match = /language-([\w+#-]+)/.exec(codeClassName || "");
      const rawChildren = codeEl && codeEl.props ? codeEl.props.children : "";
      const codeText =
        rawChildren != null && rawChildren !== "undefined"
          ? String(rawChildren).replace(/[\r\n]+$/, "")
          : "";

      if (match && match[1] === "mermaid") {
        return <MermaidBlock code={codeText} />;
      }

      const lang = match ? match[1] : null;
      const filename =
        codeEl && codeEl.props
          ? codeEl.props["data-filename"] || codeEl.props.dataFilename
          : null;

      if (filename) {
        return (
          <div className="code-block-wrapper my-4 rounded-md border border-gray-200 overflow-hidden bg-white shadow-xs">
            <div className="code-block-header flex items-center justify-between px-4 py-2 bg-gray-100/80 border-b border-gray-200 text-xs font-mono font-medium text-gray-700">
              <div className="flex items-center gap-2 truncate">
                <span className="truncate">{filename}</span>
              </div>
              {lang && (
                <span className="px-2 py-0.5 text-xs font-mono font-medium text-gray-500 bg-white border border-gray-200 rounded leading-none shrink-0 ml-2 select-none">
                  {lang}
                </span>
              )}
            </div>
            <pre
              className="overflow-x-auto text-sm bg-white border-0 rounded-none"
              style={{ margin: 0, padding: "0.75rem 1rem" }}
              {...props}
            >
              {cleanChildren(children)}
            </pre>
          </div>
        );
      }

      return (
        <div className="code-block-wrapper relative group my-4">
          {lang && (
            <div className="code-block-badge absolute top-2 right-2 z-10 inline-flex items-center justify-center px-2 py-0.5 text-xs font-mono font-medium text-gray-500 bg-white border border-gray-200/80 rounded shadow-xs select-none pointer-events-none leading-none">
              {lang}
            </div>
          )}
          <pre
            className={`bg-white border border-gray-200 rounded-md ${
              lang ? "pr-16" : ""
            } overflow-x-auto text-sm`}
            style={{
              margin: 0,
              padding: lang ? "0.875rem 4rem 0.875rem 1rem" : "0.875rem 1rem",
            }}
            {...props}
          >
            {cleanChildren(children)}
          </pre>
        </div>
      );
    },
    code({ className, children, ...props }) {
      const match = /language-([\w+#-]+)/.exec(className || "");
      const hasFilename = !!(props["data-filename"] || props.dataFilename);
      const isFenced = !!match || hasFilename;
      const codeText =
        children != null && children !== "undefined"
          ? String(children).replace(/[\r\n]+$/, "")
          : "";

      if (isFenced) {
        const lang = match ? match[1] : null;
        let highlightedHtml = "";
        try {
          if (lang && hljs.getLanguage(lang)) {
            highlightedHtml = hljs.highlight(codeText, {
              language: lang,
            }).value;
          } else {
            highlightedHtml = hljs.highlightAuto(codeText).value;
          }
        } catch {
          highlightedHtml = codeText;
        }
        return (
          <code
            className={`${className || ""} hljs`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            {...props}
          />
        );
      }
      return (
        <code className="bg-gray-100 rounded px-1.5 py-0.5 text-sm" {...props}>
          {cleanChildren(children)}
        </code>
      );
    },
  };

  return components;
}
