/** Hiding a comment: one POST on the comment itself with `hide: true`. */

import { afterEach, describe, expect, it, vi } from "vitest";

import { hideComment, MetaApiError } from "../lib/meta/client";

afterEach(() => vi.unstubAllGlobals());

describe("hideComment", () => {
  it("posts hide=true to the comment with the bearer token", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(hideComment("tok", "17890")).resolves.toEqual({ success: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/graph\.instagram\.com\/v[\d.]+\/17890$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ hide: true });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("surfaces Graph API errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      url: "https://graph.instagram.com/v25.0/17890",
      json: async () => ({ error: { message: "nope", type: "OAuthException", code: 100 } }),
    })));
    await expect(hideComment("tok", "17890")).rejects.toBeInstanceOf(MetaApiError);
  });
});
