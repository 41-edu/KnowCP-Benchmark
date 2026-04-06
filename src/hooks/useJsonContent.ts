import { useEffect, useState } from "react";
import { resolvePublicUrl } from "../utils/url";

export function useJsonContent<T>(path: string, fallback: T): T {
  const [data, setData] = useState<T>(fallback);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const resolvedPath = resolvePublicUrl(path);
        const version = (window as Window & { __KNOWCP_CONTENT_VERSION__?: string })
          .__KNOWCP_CONTENT_VERSION__;
        const url = version
          ? `${resolvedPath}${resolvedPath.includes("?") ? "&" : "?"}v=${version}`
          : resolvedPath;

        const response = await fetch(url, { cache: "force-cache" });
        if (!response.ok) {
          return;
        }
        const parsed = (await response.json()) as T;
        if (!cancelled) {
          setData(parsed);
        }
      } catch {
        // Keep fallback content when fetch fails.
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [path]);

  return data;
}
