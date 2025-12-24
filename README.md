# @ficazam/contract-api

A **contract-first HTTP client** for applications that *call APIs*, designed to make misuse **impossible at compile time** and invalid data **impossible at runtime**.

This library is intentionally strict. If something can go wrong, the compiler should stop you before it ships.

---

## What this is

`@ficazam/contract-api` is a **TypeScript-first API client generator** built around runtime schemas (Zod, etc.).

You define an API **contract map** once, and you get:

- Compile-time enforcement of required params, query, body, and auth
- Runtime validation at the network boundary
- Typed responses derived from schemas
- Impossible-to-call protected endpoints without auth
- No framework lock-in (Node, Next.js, browsers, workers)

This is for **applications that call APIs** — not for building servers.

---

## What this is NOT

- ❌ Not a server or router
- ❌ Not RPC
- ❌ Not OpenAPI
- ❌ Not framework-coupled
- ❌ Not flexible-by-default

If you want permissive or loosely typed API calls, this is not the right tool.

---

## Why this exists

Most HTTP clients are:

- runtime-only validated
- loosely typed
- easy to misuse
- silently wrong

This library takes the opposite stance:

> **If an API call is invalid, it will not compile.**

That includes:

- Missing required params
- Extra unexpected fields (deep exactness enforced)
- Calling protected endpoints without auth
- Passing auth to public endpoints
- Receiving invalid response data

---

## Installation

```bash
npm install @ficazam/contract-api zod
```

> Zod is a **peer dependency**.  
> Any schema library that exposes `{ parse(input): T }` will work.

---

## Core idea

Define a **contract map**:

```ts
import { z } from "zod";
import { defineContract } from "@ficazam/contract-api";

const Item = z.object({
  id: z.string(),
  name: z.string(),
});

export const contract = defineContract({
  "GET /items": {
    auth: "public",
    query: z.object({ q: z.string() }),
    response: z.object({
      items: z.array(Item),
    }),
  },

  "POST /items": {
    auth: "required",
    body: z.object({ name: z.string() }),
    response: Item,
  },
} as const);
```

This contract is the **single source of truth**.

---

## Creating a client

```ts
import { createClient } from "@ficazam/contract-api";
import { contract } from "./contract";

const client = createClient(contract, {
  baseUrl: "https://api.example.com",
  auth: {
    kind: "bearer",
    token: async () => getTokenSomehow(),
  },
});
```

Works in:
- Node
- Next.js (App Router / Server Components)
- Browsers
- Workers

You may inject your own `fetch` implementation if needed.

---

## Calling endpoints

### Public GET with query

```ts
const res = await client.call("GET /items", {
  query: { q: "search" },
});
```

The return type is inferred from the response schema.

---

### Auth-required POST with body

```ts
await client.call("POST /items", {
  auth: true,
  body: { name: "Item name" },
});
```

---

## Compile-time errors (by design)

```ts
// ❌ Missing required query
client.call("GET /items", {});

// ❌ Extra field (deep exactness enforced)
client.call("GET /items", {
  query: { q: "x", extra: 123 },
});

// ❌ Missing auth on protected endpoint
client.call("POST /items", {
  body: { name: "x" },
});

// ❌ Passing auth to public endpoint
client.call("GET /items", {
  auth: true,
  query: { q: "x" },
});
```

All of the above fail **at compile time**.

---

## Errors

### ApiError

Thrown when the server responds with a non-2xx status.

Includes:
- HTTP status
- endpoint key
- URL
- raw response text
- parsed error body (if an error schema is provided)

```ts
try {
  await client.call("POST /items", { auth: true, body: { name: "x" } });
} catch (err) {
  if (err instanceof ApiError) {
    console.error(err.status, err.parsedError);
  }
}
```

---

### ValidationError

Thrown when request or response validation fails.

```ts
try {
  await client.call("GET /items", { query: { q: 123 } });
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(err.issues);
  }
}
```

---

## Design principles

- **Contract-first**
- **Runtime validation at IO boundaries**
- **Compiler-hostile misuse**
- **No framework assumptions**
- **Strict by default**

---

## License

MIT
