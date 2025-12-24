import {
  RuntimeSchema,
  AuthOverride,
  AuthStrategy,
  BaseUrl,
  CallArgs,
  CallResult,
  ClientOptions,
  Contract,
  EndpointDef,
  EndpointFor,
  Exact,
  Keys,
} from "./types";
import { ApiError, ValidationError } from "./errors";
import { buildPath, buildQueryString, joinURL } from "./https";

const parseKey = (key: string): { method: string; path: string } => {
  const index = key.indexOf(" ");
  if (index === -1)
    throw new Error(`Invalid Endpoint key "${key}". Expected "METHOD /path"`);

  const method = key.slice(0, index).trim().toUpperCase();
  const path = key.slice(index + 1).trim();

  return { method, path };
};

const resolveBaseUrl = async (base?: BaseUrl): Promise<string> => {
  if (!base) return "";

  return typeof base === "string" ? base : await base();
};

const resolveAuthHeaders = async (
  strategy: AuthStrategy | undefined
): Promise<Record<string, string>> => {
  if (!strategy) return {};

  switch (strategy.kind) {
    case "cookie":
      return {};
    case "bearer": {
      const token = await strategy.token();
      return token ? { Authorization: `Bearer ${token}` } : {};
    }
    case "headers": {
      const h = await strategy.getHeaders();
      return h ?? {};
    }
    default:
      return {};
  }
};

const resolveOverrideAuthHeaders = async (
  override: AuthOverride
): Promise<Record<string, string>> => {
  switch (override.kind) {
    case "cookie":
      return {};
    case "bearer": {
      const t = override.token;
      const token = typeof t === "string" ? t : await t();

      return token ? { Authorization: `Bearer ${token}` } : {};
    }
    case "headers": {
      const h = await override.getHeaders();
      return h ?? {};
    }
    default:
      return {};
  }
};

const tryToParse = <T>(
  schema: RuntimeSchema<T>,
  input: unknown
): { ok: true; value: T } | { ok: false; issues: unknown } => {
  try {
    return { ok: true, value: schema.parse(input) };
  } catch (error) {
    return { ok: false, issues: error };
  }
};

const safeJSON = (
  decodeJson: (t: string) => unknown,
  text: string
): unknown | undefined => {
  try {
    return decodeJson(text);
  } catch (error) {
    return undefined;
  }
};

const getEndpoint = <const C extends Contract, const K extends Keys<C>>(
  contract: C,
  key: K
): EndpointFor<C, K> => {
  const def = contract[key];
  if (!def) throw new Error(`Unknown endpoint key: ${String(key)}`);
  return def;
};

export const createClient = <const C extends Contract>(
  contract: C,
  options: ClientOptions
) => {
  const fetcher = options.fetcher ?? globalThis.fetch;
  if (!fetcher)
    throw new Error(
      "No fetch implementation found. Provide options.fetcher or use an environment with fetch."
    );

  const encodeJson = options.codecs?.encodeJson ?? JSON.stringify;
  const decodeJson = options.codecs?.decodeJson ?? ((t) => JSON.parse(t));

  const call = async <
    const K extends Keys<C>,
    A extends CallArgs<EndpointFor<C, K>>
  >(
    key: K,
    args: Exact<CallArgs<EndpointFor<C, K>>, A>
  ): Promise<CallResult<EndpointFor<C, K>>> => {
    const def = getEndpoint(contract, key);

    const { method, path: pathTemplate } = parseKey(key);

    let paramsObj: any = undefined;
    let queryObj: any = undefined;
    let bodyObj: any = undefined;
    let headersObj: any = undefined;

    const baseUrl = await resolveBaseUrl(options.baseUrl);

    if (def.params) {
      const r = tryToParse(def.params, (args as any).params);
      if (!r.ok)
        throw new ValidationError({
          message: "Invalid path params",
          key,
          url: `${baseUrl}${pathTemplate}`,
          kind: "request",
          issues: r.issues,
        });
      paramsObj = r.value;
    }

    if (def.query) {
      const r = tryToParse(def.query, (args as any).query);
      if (!r.ok)
        throw new ValidationError({
          message: "Invalid query",
          key,
          url: `${baseUrl}${pathTemplate}`,
          kind: "request",
          issues: r.issues,
        });
      queryObj = r.value;
    }

    if (def.body) {
      const r = tryToParse(def.body, (args as any).body);
      if (!r.ok)
        throw new ValidationError({
          message: "Invalid body",
          key,
          url: `${baseUrl}${pathTemplate}`,
          kind: "request",
          issues: r.issues,
        });
      bodyObj = r.value;
    }

    if (def.headers) {
      const r = tryToParse(def.headers, (args as any).headers);
      if (!r.ok)
        throw new ValidationError({
          message: "Invalid headers",
          key,
          url: `${baseUrl}${pathTemplate}`,
          kind: "request",
          issues: r.issues,
        });
      headersObj = r.value;
    }

    const builtPath = paramsObj
      ? buildPath(pathTemplate, paramsObj)
      : pathTemplate;
    const qs = queryObj ? buildQueryString(queryObj) : "";
    const url = joinURL(baseUrl, `${builtPath}${qs}`);

    const h: Record<string, string> = {
      ...(headersObj ?? {}),
    };

    const authField = (args as any).auth as true | AuthOverride | undefined;

    if (def.auth === "required") {
      if (authField && authField !== true) {
        Object.assign(h, await resolveOverrideAuthHeaders(authField));
      } else {
        Object.assign(h, await resolveAuthHeaders(options.auth));
      }
    }

    let body: BodyInit | undefined;
    const contentType = def.contentType ?? (def.body ? "json" : "none");

    if (contentType === "json" && bodyObj !== undefined) {
      h["Content-Type"] = h["Content-Type"] ?? "application/json";
      body = encodeJson(bodyObj);
    } else if (contentType === "text" && bodyObj !== undefined) {
      h["Content-Type"] = h["Content-Type"] ?? "text/plain";
      body = String(bodyObj);
    }

    let init: RequestInit = {
      method,
      headers: h,
      body,
      signal: (args as any).signal,
      ...(args as any).init,
    };

    const before = options.hooks?.beforeRequest ?? [];
    for (const fn of before) {
      const maybe = await fn({ key, url, init });
      if (maybe) init = maybe;
    }

    let response = await fetcher(url, init);

    const after = options.hooks?.afterResponse ?? [];
    for (const fn of after) {
      const maybe = await fn({ key, url, init, response });
      if (maybe) response = maybe;
    }

    const text = await response.text();
    const isLikelyJson =
      !!text &&
      (response.headers.get("content-type")?.includes("application/json") ||
        text.trim().startsWith("{") ||
        text.trim().startsWith("["));

    const rawJson = isLikelyJson ? safeJSON(decodeJson, text) : undefined;

    if (!response.ok) {
      let parsedError: unknown = undefined;
      if (def.error && rawJson !== undefined) {
        const r = tryToParse(def.error, rawJson);
        if (r.ok) parsedError = r.value;
      }

      const errArgs: {
        message: string;
        status: number;
        key: string;
        url: string;
        rawText?: string;
        rawJson?: unknown;
        parsedError?: unknown;
      } = {
        message: `API request failed: ${response.status} ${response.statusText}`,
        status: response.status,
        key,
        url,
      };

      if (text) errArgs.rawText = text;
      if (rawJson !== undefined) errArgs.rawJson = rawJson;
      if (parsedError !== undefined) errArgs.parsedError = parsedError;

      throw new ApiError(errArgs);
    }

    const input = rawJson !== undefined ? rawJson : text;
    const parsed = tryToParse(def.response, input);
    if (!parsed.ok) {
      throw new ValidationError({
        message: "Response validation failed",
        key,
        url,
        kind: "response",
        issues: parsed.issues,
      });
    }

    return parsed.value as any;
  };

  return {
    call,
  };
};
