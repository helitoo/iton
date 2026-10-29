import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { VscChevronLeft, VscChevronRight } from "react-icons/vsc";
import { extractHeadings } from "../../utils/extractHeadings";
import { dirOf } from "../../utils/pathUtils";
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
  const navigate = useNavigate();
  const headings = useMemo(() => extractHeadings(raw), [raw]);
  const processed = useMemo(() => preprocessMarkdown(raw), [raw]);
  const components = useMemo(
    () => createMarkdownComponents({ manifest, currentFilePath: file.path }),
    [manifest, file.path],
  );

  const siblingFiles = useMemo(() => {
    if (!manifest || !file) return [];
    const currentDir = dirOf(file.path);
    return manifest.filter((f) => dirOf(f.path) === currentDir);
  }, [manifest, file]);

  const currentIndex = useMemo(() => {
    if (!file) return -1;
    return siblingFiles.findIndex((f) => f.path === file.path);
  }, [siblingFiles, file]);

  const prevFile = currentIndex > 0 ? siblingFiles[currentIndex - 1] : null;
  const nextFile =
    currentIndex >= 0 && currentIndex < siblingFiles.length - 1
      ? siblingFiles[currentIndex + 1]
      : null;

  const handlePrev = () => {
    if (prevFile) {
      navigate(`/${prevFile.id}`);
    }
  };

  const handleNext = () => {
    if (nextFile) {
      navigate(`/${nextFile.id}`);
    }
  };

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
        <h1 className="text-3xl font-bold mb-6 pb-2 border-b border-gray-200 text-gray-900 break-words">
          {file?.name}
        </h1>
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
      <div className="fixed bottom-6 right-4 z-50 flex items-center gap-3">
        <button
          onClick={handlePrev}
          disabled={!prevFile}
          className="cursor-pointer size-10 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 transition-colors"
          aria-label="Trang trước"
          title={
            prevFile ? `Trang trước: ${prevFile.name}` : "Không có trang trước"
          }
        >
          <VscChevronLeft size={20} />
        </button>
        <button
          onClick={handleNext}
          disabled={!nextFile}
          className="cursor-pointer size-10 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 transition-colors"
          aria-label="Trang sau"
          title={
            nextFile ? `Trang sau: ${nextFile.name}` : "Không có trang sau"
          }
        >
          <VscChevronRight size={20} />
        </button>
        <TableOfContents headings={headings} />
      </div>
    </div>
  );
}
