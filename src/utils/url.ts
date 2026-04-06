const ABSOLUTE_URL_PATTERN = /^(?:[a-z]+:)?\/\//i;

export function resolvePublicUrl(path: string): string {
  if (!path) {
    return path;
  }

  if (ABSOLUTE_URL_PATTERN.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  return `${normalizedBase}${normalizedPath}`;
}
