/**
 * Reading a post's recent comments.
 *
 * The sweep asks for `replies{from}` on every comment, an expansion Instagram
 * evaluates per comment, so a post with busy comment threads gets refused with
 * code 1 ("Please reduce the amount of data you're asking for") instead of a
 * truncated page. That refusal used to abandon the media for good: the campaign
 * on that post was never swept again, every five minutes, silently.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRecentMediaComments, MetaApiError } from "../lib/meta/client";

const TOKEN = "test-token";
const MEDIA = "18102827710567494";
const NOW = Date.parse("2026-09-13T12:00:00Z");
const SINCE = NOW - 72 * 3600_000;

function comment(id: string, minutesAgo = 5) {
  return {
    id,
    text: `comment ${id}`,
    timestamp: new Date(NOW - minutesAgo * 60_000).toISOString(),
    from: { id: "999", username: "someone" },
  };
}

/** A Graph API error body, as Instagram returns it. */
function graphError(code: number, message: string) {
  return {
    ok: false,
    url: `https://graph.instagram.com/v25.0/${MEDIA}/comments`,
    json: async () => ({ error: { message, type: "OAuthException", code } }),
  } as unknown as Response;
}

function graphPage(data: unknown[], next?: string) {
  return {
    ok: true,
    url: `https://graph.instagram.com/v25.0/${MEDIA}/comments`,
    json: async () => ({ data, paging: next ? { next } : undefined }),
  } as unknown as Response;
}

const TOO_HEAVY = "Please reduce the amount of data you're asking for, then retry your request";

function limitOf(call: unknown): string | null {
  return new URL(String(call)).searchParams.get("limit");
}

describe("getRecentMediaComments", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("asks for a full page while the post can serve one", async () => {
    fetchMock.mockResolvedValueOnce(graphPage([comment("1"), comment("2")]));

    await expect(
      getRecentMediaComments(TOKEN, MEDIA, SINCE)
    ).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(limitOf(fetchMock.mock.calls[0][0])).toBe("50");
  });

  it("retries the same page smaller when Meta refuses the expansion", async () => {
    fetchMock
      .mockResolvedValueOnce(graphError(1, TOO_HEAVY))
      .mockResolvedValueOnce(graphPage([comment("1")]));

    await expect(
      getRecentMediaComments(TOKEN, MEDIA, SINCE)
    ).resolves.toHaveLength(1);
    expect(limitOf(fetchMock.mock.calls[0][0])).toBe("50");
    expect(limitOf(fetchMock.mock.calls[1][0])).toBe("25");
  });

  it("keeps the reduced page size for the rest of the media", async () => {
    const next = `https://graph.instagram.com/v25.0/${MEDIA}/comments?after=CURSOR&limit=50`;
    fetchMock
      .mockResolvedValueOnce(graphError(1, TOO_HEAVY))
      .mockResolvedValueOnce(graphPage([comment("1")], next))
      .mockResolvedValueOnce(graphPage([comment("2")]));

    await expect(
      getRecentMediaComments(TOKEN, MEDIA, SINCE)
    ).resolves.toHaveLength(2);
    // The cursor Meta handed back still carries limit=50; the page it is
    // fetched with must be the reduced one, or the next page fails again.
    expect(limitOf(fetchMock.mock.calls[2][0])).toBe("25");
    expect(String(fetchMock.mock.calls[2][0])).toContain("after=CURSOR");
  });

  it("gives up once the page cannot shrink further", async () => {
    fetchMock.mockResolvedValue(graphError(1, TOO_HEAVY));

    await expect(getRecentMediaComments(TOKEN, MEDIA, SINCE)).rejects.toThrow(
      MetaApiError
    );
    // 50, 25, 12, 6, 5 — then the error propagates unchanged.
    expect(fetchMock.mock.calls.map((c) => limitOf(c[0]))).toEqual([
      "50",
      "25",
      "12",
      "6",
      "5",
    ]);
  });

  it("does not retry an error that a smaller page cannot fix", async () => {
    fetchMock.mockResolvedValue(graphError(190, "Session has expired"));

    await expect(getRecentMediaComments(TOKEN, MEDIA, SINCE)).rejects.toThrow(
      MetaApiError
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops paging once a page predates the lookback window", async () => {
    const next = `https://graph.instagram.com/v25.0/${MEDIA}/comments?after=CURSOR`;
    fetchMock.mockResolvedValueOnce(
      graphPage([comment("1"), comment("old", 96 * 60)], next)
    );

    await expect(
      getRecentMediaComments(TOKEN, MEDIA, SINCE)
    ).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops walking a post that only answers in tiny pages", async () => {
    const next = `https://graph.instagram.com/v25.0/${MEDIA}/comments?after=CURSOR`;
    fetchMock.mockImplementation(async (url: string) =>
      limitOf(url) === "5"
        ? graphPage([comment("x")], next)
        : graphError(1, TOO_HEAVY)
    );

    await getRecentMediaComments(TOKEN, MEDIA, SINCE);
    // Four rejected sizes, then at most MAX_COMMENT_PAGES pages of five.
    expect(fetchMock.mock.calls.length).toBe(4 + 40);
  });
});
