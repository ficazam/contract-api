import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineContract, createClient, ApiError, ValidationError } from "../src";

const Item = z.object({ id: z.string(), name: z.string() });

const contract = defineContract({
  "GET /items/id/:id": {
    auth: "public",
    params: z.object({ id: z.string() }),
    response: Item,
  },
  "POST /items": {
    auth: "required",
    body: z.object({ name: z.string() }),
    response: Item,
    error: z.object({ message: z.string() }),
  },
} as const);

function mockFetch(handler: (url: string, init: RequestInit) => Promise<Response>) {
  return (url: any, init: any) => handler(String(url), init ?? {});
}

describe("contract-api runtime", () => {
  it("validates response and returns typed data", async () => {
    const client = createClient(contract, {
      baseUrl: "https://x.test",
      fetcher: mockFetch(async () => {
        return new Response(JSON.stringify({ id: "1", name: "Boots" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as any,
    });

    const item = await client.call("GET /items/id/:id", { params: { id: "1" } });
    expect(item.name).toBe("Boots");
  });

  it("throws ValidationError on invalid response shape", async () => {
    const client = createClient(contract, {
      baseUrl: "https://x.test",
      fetcher: mockFetch(async () => {
        return new Response(JSON.stringify({ nope: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as any,
    });

    await expect(
      client.call("GET /items/id/:id", { params: { id: "1" } })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws ApiError with parsedError when error schema matches", async () => {
    const client = createClient(contract, {
      baseUrl: "https://x.test",
      auth: { kind: "bearer", token: async () => "TOKEN" },
      fetcher: mockFetch(async (_url, init) => {
        // should include Authorization
        const h = init.headers as Record<string, string>;
        expect(String((h as any).Authorization ?? "")).toContain("Bearer");

        return new Response(JSON.stringify({ message: "nope" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }) as any,
    });

    await expect(
      client.call("POST /items", { auth: true, body: { name: "x" } })
    ).rejects.toBeInstanceOf(ApiError);
  });
});
