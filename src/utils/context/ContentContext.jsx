import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { MANIFEST_URL } from "./manifest";
import { buildTree } from "./tree";

const ContentContext = createContext(null);

export function ContentProvider({ children }) {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch(MANIFEST_URL, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .catch(() => [])
      .then((files) => {
        if (!mounted) return;
        const validFiles = Array.isArray(files)
          ? files.filter((f) => f && f.id !== undefined && f.id !== null)
          : [];
        const sorted = [...validFiles].sort((a, b) =>
          a.path.localeCompare(b.path, "vi"),
        );
        setManifest(sorted);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const tree = useMemo(() => buildTree(manifest || []), [manifest]);

  const value = useMemo(
    () => ({ manifest: manifest || [], tree, loading }),
    [manifest, tree, loading],
  );

  return (
    <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
  );
}

export function useContentData() {
  const ctx = useContext(ContentContext);
  if (!ctx)
    throw new Error("useContentData must be used within ContentProvider");
  return ctx;
}
