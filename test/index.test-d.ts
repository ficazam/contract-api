import { expectError, expectType } from "tsd";
import { z } from "zod";
import { defineContract, createClient } from "../src";

const Item = z.object({ id: z.string(), name: z.string() });

const contract = defineContract({
  "GET /items": {
    auth: "public",
    query: z.object({ q: z.string() }),
    response: z.object({ items: z.array(Item) }),
  },
  "POST /items": {
    auth: "required",
    body: z.object({ name: z.string() }),
    response: Item,
  },
} as const);

const client = createClient(contract, {
  baseUrl: "https://x.test",
  fetcher: fetch,
});

expectType<Promise<{ items: Array<{ id: string; name: string }> }>>(
  client.call("GET /items", { query: { q: "x" } })
);

// missing query.q
expectError(client.call("GET /items", { query: {} }));

// extra key should fail (exactness)
expectError(client.call("GET /items", { query: { q: "x", extra: 1 } }));

// auth required
expectError(client.call("POST /items", { body: { name: "x" } }));

// auth forbidden on public
expectError(client.call("GET /items", { auth: true, query: { q: "x" } }));
