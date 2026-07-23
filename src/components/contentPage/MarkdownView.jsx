import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { extractHeadings } from "../../utils/extractHeadings";
import {
  preprocessMarkdown,
  remarkPlugins,
  rehypePlugins,
  createMarkdownComponents,
} from "../../utils/markdownConfig";
import TableOfContents from "../TableOfContents";
import "github-markdown-css/github-markdown-light.css";

export default function MarkdownView({ file, raw, manifest }) {
  const location = useLocation();
  const headings = useMemo(() => extractHeadings(raw), [raw]);
  const processed = useMemo(() => preprocessMarkdown(raw), [raw]);
  const components = useMemo(
    () => createMarkdownComponents({ manifest, currentFilePath: file.path }),
    [manifest, file.path],
  );

  useEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.replace("#", ""));
      const timer = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [file.path, raw, location.hash]);

  return (
    <div
      className="w-full overflow-y-scroll"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <div className="px-6 py-8 max-w-4xl mx-auto markdown-body">
        <article className="prose-content">
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={components}
          >
            {processed}
          </ReactMarkdown>
        </article>
      </div>
      <TableOfContents headings={headings} />
    </div>
  );
}
