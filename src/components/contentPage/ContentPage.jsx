import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import { useContentData } from "../../utils/context/ContentContext";
import { findFileForRoute, fileKind } from "../../utils/pathUtils";
import { contentUrl } from "../../utils/context/manifest";
import MarkdownView from "./MarkdownView";
import LoadingScene from "../scenes/loadingScene";
import FailedScene from "../scenes/failedScene";

export default function ContentPage() {
  const { manifest, loading: manifestLoading } = useContentData();
  const location = useLocation();
  const { setActiveFileName } = useOutletContext();

  const routePath = location.pathname.replace(/^\//, "");
  const file = useMemo(
    () => (manifestLoading ? null : findFileForRoute(manifest, routePath)),
    [manifest, manifestLoading, routePath],
  );

  const [text, setText] = useState("");
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const timeoutRef = useRef(null);

  const handleReload = () => {
    setStatus("loading");
    setErrorMessage("");
    setReloadKey((k) => k + 1);
  };

  const handleMediaLoad = () => {
    setStatus((prev) => {
      if (prev === "loading") {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        return "ready";
      }
      return prev;
    });
  };

  const handleMediaError = (defaultMsg) => {
    setStatus((prev) => {
      if (prev === "loading") {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setErrorMessage(defaultMsg);
        return "error";
      }
      return prev;
    });
  };

  useEffect(() => {
    setActiveFileName(file ? file.name : "");
    if (file?.name) {
      document.title = `${file.name} - iton`;
    } else {
      document.title = "iton";
    }
  }, [file, setActiveFileName]);

  useEffect(() => {
    setStatus("loading");
    setErrorMessage("");

    // 10-second timeout limit
    timeoutRef.current = setTimeout(() => {
      setStatus((currentStatus) => {
        if (currentStatus === "loading") {
          setErrorMessage(
            "Thời gian tải nội dung quá 10 giây. Vui lòng thử lại.",
          );
          return "error";
        }
        return currentStatus;
      });
    }, 10000);

    if (manifestLoading) {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }

    if (!file) {
      setStatus("error");
      setErrorMessage(
        "Contents do not exist or have been renamed, please check again.",
      );
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }

    const kind = fileKind(file.ext);
    if (kind === "markdown" || kind === "text") {
      let isSubscribed = true;
      fetch(contentUrl(file.path), { cache: "no-store" })
        .then((res) => {
          if (!res.ok) throw new Error("Không thể tải tệp nội dung.");
          return res.text();
        })
        .then((t) => {
          if (isSubscribed) {
            setText(t);
            setStatus("ready");
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }
        })
        .catch((err) => {
          if (isSubscribed) {
            setErrorMessage(err.message || "Không thể tải nội dung.");
            setStatus("error");
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }
        });

      return () => {
        isSubscribed = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    } else {
      // For image and pdf (iframe), status is updated via onLoad / onError
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
  }, [file, manifestLoading, routePath, reloadKey]);

  if (status === "error" || (!manifestLoading && !file)) {
    return (
      <FailedScene
        message={
          errorMessage ||
          "Contents do not exist or have been renamed, please check again."
        }
        onReload={handleReload}
      />
    );
  }

  if (!file) {
    return <LoadingScene message="Đang tải..." />;
  }

  const kind = fileKind(file.ext);

  if (kind === "image") {
    return (
      <>
        {(manifestLoading || status === "loading") && (
          <LoadingScene message="Đang tải hình ảnh..." />
        )}
        <div
          className={`px-6 py-8 max-w-4xl mx-auto ${
            status === "loading" ? "hidden" : ""
          }`}
        >
          <h1 className="text-3xl font-bold mb-6 pb-2 border-b border-gray-200 text-gray-900 break-words">
            {file.name}
          </h1>
          <div className="flex justify-center">
            <img
              src={contentUrl(file.path)}
              alt={file.name}
              onLoad={handleMediaLoad}
              onError={() => handleMediaError("Không thể tải hình ảnh.")}
              className="max-w-full rounded-md shadow-sm"
            />
          </div>
        </div>
      </>
    );
  }

  if (kind === "pdf") {
    return (
      <>
        {(manifestLoading || status === "loading") && (
          <LoadingScene message="Đang tải tệp PDF..." />
        )}
        <div
          className={`w-full flex flex-col ${status === "loading" ? "hidden" : ""}`}
          style={{ height: "calc(100vh - 3.5rem)" }}
        >
          <div className="px-6 py-3 border-b border-gray-200 bg-white">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {file.name}
            </h1>
          </div>
          <iframe
            title={file.name}
            src={contentUrl(file.path)}
            onLoad={handleMediaLoad}
            onError={() => handleMediaError("Không thể tải tệp PDF.")}
            className="w-full flex-1 border-0"
          />
        </div>
      </>
    );
  }

  if (manifestLoading || status === "loading") {
    return <LoadingScene message="Đang tải nội dung..." />;
  }

  if (kind === "markdown") {
    return <MarkdownView file={file} raw={text} manifest={manifest} />;
  }

  // Plain text / other raw text formats
  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 pb-2 border-b border-gray-200 text-gray-900 break-words">
        {file.name}
      </h1>
      <pre className="whitespace-pre-wrap wrap-break-word bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-800">
        {text}
      </pre>
    </div>
  );
}
