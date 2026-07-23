import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { visit } from "unist-util-visit";
import { slugify } from "./slugify";
import { resolveWikiHref } from "./localLinks";
import ReactMarkdown from "react-markdown";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

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
  let text = raw;

  // Embeds: ![[target]] or ![[target|alt]]
  text = text.replace(
    /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_m, target, alt) => {
      const t = target.trim();
      const a = (alt || t).trim();
      return `![${a}](${encodeWikiTarget(t)})`;
    },
  );

  // Links: [[target]] or [[target|text]]
  text = text.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_m, target, label) => {
      const t = target.trim();
      const l = (label || t).trim();
      return `[${l}](${encodeWikiTarget(t)})`;
    },
  );

  // Force $$...$$ onto its own blank-line-delimited block, regardless of
  // where it was declared, so it always renders as a block equation.
  text = text.replace(
    /\$\$([\s\S]+?)\$\$/g,
    (_m, expr) => `\n\n$$${expr.trim()}$$\n\n`,
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
    container: "border-violet-600 bg-violet-50",
    title: "text-violet-700",
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

export const remarkPlugins = [remarkGfm, remarkMath, remarkCallouts];
export const rehypePlugins = [rehypeKatex, rehypeHeadingIds];

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

function cellChildrenToText(nodes) {
  if (nodes === undefined || nodes === null) return "";
  if (typeof nodes === "string") return nodes;
  if (typeof nodes === "number") return String(nodes);
  if (Array.isArray(nodes)) return nodes.map(cellChildrenToText).join("");
  if (nodes.type === "br" || nodes.props?.mdxType === "br") return "\n";
  if (nodes.props && "children" in nodes.props) {
    return cellChildrenToText(nodes.props.children);
  }
  return "";
}

function nodesToMarkdown(nodes) {
  if (nodes === undefined || nodes === null) return "";
  if (typeof nodes === "string") return nodes;
  if (typeof nodes === "number") return String(nodes);
  if (Array.isArray(nodes)) return nodes.map(nodesToMarkdown).join("");

  const type = nodes.type;
  const props = nodes.props || {};
  const children = props.children;

  if (type === "br" || props.mdxType === "br") {
    return "\n";
  }
  if (type === "strong" || type === "b") {
    return `**${nodesToMarkdown(children)}**`;
  }
  if (type === "em" || type === "i") {
    return `*${nodesToMarkdown(children)}*`;
  }
  if (type === "code") {
    return `\`${nodesToMarkdown(children)}\``;
  }
  if (type === "a") {
    return `[${nodesToMarkdown(children)}](${props.href || ""})`;
  }
  if (type === "img") {
    return `![${props.alt || ""}](${props.src || ""})`;
  }
  if (type === "del") {
    return `~~${nodesToMarkdown(children)}~~`;
  }
  if (props && "children" in props) {
    return nodesToMarkdown(children);
  }
  return "";
}

export function createMarkdownComponents({ manifest, currentFilePath }) {
  function headingFactory(Tag) {
    return function Heading({ id, children, ...props }) {
      return (
        <Tag id={id} className="scroll-mt-6 font-bold" {...props}>
          {children}
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
              {children}
            </a>
          );
        }
        if (!isExternal) {
          try {
            const target = decodeURIComponent(href);
            const resolved = resolveWikiHref(manifest, currentFilePath, target);
            if (resolved.type === "route") {
              return (
                <Link
                  to={resolved.href}
                  className="text-blue-600 hover:underline font-medium"
                  {...props}
                >
                  {children}
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
                  {children}
                </a>
              );
            }
            return <span {...props}>{children}</span>;
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
          {children}
        </a>
      );
    },
    img({ src, alt, ...props }) {
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
      return (
        <img
          src={resolvedSrc}
          alt={alt}
          className="max-w-full rounded-md my-3 mx-auto"
          {...props}
        />
      );
    },
    table({ children, ...props }) {
      return (
        <div className="overflow-x-auto my-4">
          <table
            className="min-w-full border border-gray-200 text-sm"
            {...props}
          >
            {children}
          </table>
        </div>
      );
    },
    th({ children, ...props }) {
      const rawText = nodesToMarkdown(children).replace(/<br\s*\/?>/gi, "\n");
      return (
        <th
          className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-bold"
          {...props}
        >
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={nestedComponents}
          >
            {rawText}
          </ReactMarkdown>
        </th>
      );
    },
    td({ children, ...props }) {
      const rawText = nodesToMarkdown(children).replace(/<br\s*\/?>/gi, "\n");
      return (
        <td className="border border-gray-200 px-3 py-2 align-top" {...props}>
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={nestedComponents}
          >
            {rawText}
          </ReactMarkdown>
        </td>
      );
    },
    p({ children, ...props }) {
      return (
        <p className="my-3 leading-relaxed text-gray-800" {...props}>
          {children}
        </p>
      );
    },
    li({ children, ...props }) {
      return (
        <li className="text-gray-800 leading-relaxed" {...props}>
          {children}
        </li>
      );
    },
    strong({ children, ...props }) {
      return (
        <strong className="font-bold text-gray-900" {...props}>
          {children}
        </strong>
      );
    },
    em({ children, ...props }) {
      return (
        <em className="italic" {...props}>
          {children}
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
          {children}
        </blockquote>
      );
    },
    ul({ children, ...props }) {
      return (
        <ul className="list-disc pl-6 my-2 space-y-1" {...props}>
          {children}
        </ul>
      );
    },
    ol({ children, ...props }) {
      return (
        <ol className="list-decimal pl-6 my-2 space-y-1" {...props}>
          {children}
        </ol>
      );
    },
    pre({ children, ...props }) {
      const codeEl = Array.isArray(children) ? children[0] : children;
      const codeClassName =
        codeEl && codeEl.props ? codeEl.props.className : "";
      const match = /language-(\w+)/.exec(codeClassName || "");
      const codeText =
        codeEl && codeEl.props
          ? String(codeEl.props.children).replace(/\n$/, "")
          : "";

      if (match && match[1] === "mermaid") {
        return <MermaidBlock code={codeText} />;
      }

      return (
        <pre
          className="bg-white border border-gray-200 rounded-md p-4 overflow-x-auto my-4 text-sm"
          {...props}
        >
          {children}
        </pre>
      );
    },
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const isFenced = !!match;
      if (isFenced) {
        const lang = match[1];
        const codeText = String(children).replace(/\n$/, "");
        let highlightedHtml = "";
        try {
          if (hljs.getLanguage(lang)) {
            highlightedHtml = hljs.highlight(codeText, {
              language: lang,
            }).value;
          } else {
            highlightedHtml = hljs.highlightAuto(codeText).value;
          }
        } catch (err) {
          highlightedHtml = codeText;
        }
        return (
          <code
            className={`${className} hljs`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            {...props}
          />
        );
      }
      return (
        <code className="bg-gray-100 rounded px-1.5 py-0.5 text-sm" {...props}>
          {children}
        </code>
      );
    },
  };

  const nestedComponents = {
    ...components,
    table: ({ children }) => <>{children}</>,
    th: ({ children }) => <>{children}</>,
    td: ({ children }) => <>{children}</>,
  };

  return components;
}

function childrenToText(children) {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  if (children && children.props && children.props.children) {
    return childrenToText(children.props.children);
  }
  return "";
}

function decodeParens(text) {
  return text.replace(/%28/g, "(").replace(/%29/g, ")");
}
