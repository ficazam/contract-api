import { QueryValue } from "./types";

export const joinURL = (base: string, path: string): string => {
  if (!base) return path;

  const a = base.endsWith("/") ? base.slice(0, -1) : base;
  const b = path.startsWith("/") ? path : `/${path}`;

  return `${a}${b}`;
};

export const buildPath = (
  template: string,
  params: Record<string, string | number | boolean>
): string => {
  return template.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const v = params[key];
    if (v === undefined || v === null) {
      throw new Error(`Missing path param "${key}"`);
    }
    return encodeURIComponent(String(v));
  });
};

export const buildQueryString = (query: Record<string, QueryValue>): string => {
  const sp = new URLSearchParams();

  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;

    if (Array.isArray(v)) {
      for (const item of v) sp.append(k, String(item));
      continue;
    }

    sp.set(k, String(v));
  }

  const s = sp.toString();
  return s ? `?${s}` : "";
};
