/**
 * Comment reconciliation: ad copies of a boosted post, and what a sweep reports
 * when it fails.
 *
 * Comments left on an ad carry the ad's own media id, so the sweep has to look
 * at those media too or a webhook Meta never delivers is lost for good.
 *
 * The reporting half exists because a failed sweep used to log its counters and
 * nothing else — "0 enqueued, 0 matched, 0 already replied" at WARNING level,
 * identical to a healthy sweep with nothing to do.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, queueAdd, readComments } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn(),
    automation: { findMany: vi.fn() },
    dmLog: { findMany: vi.fn() },
    operationalEvent: { create: vi.fn() },
  },
  queueAdd: vi.fn(),
  readComments: vi.fn(),
}));
vi.mock("@/lib/queue/client", () => ({
  getDMQueue: () => ({ add: queueAdd }),
}));
vi.mock("@/lib/instagram/provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/instagram/provider")>()),
  createInstagramContext: async () => ({
    provider: "META",
    accessToken: "local-test",
  }),
  getRecentMediaComments: readComments,
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));

import {
  adMediaFor,
  reconcileComments,
  summarizeSweepErrors,
  sweepMessage,
  type SweepStat,
} from "../lib/polling/comment-reconciler";

const POST = "18023946917554990";
const AD = "17899788633163100";

describe("adMediaFor", () => {
  beforeEach(() => {
    mockPrisma.$queryRaw.mockReset();
  });

  it("returns the ad media ids seen for the post", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ mediaId: AD }]);
    await expect(adMediaFor(POST)).resolves.toEqual([AD]);
  });

  it("never returns the post itself, so it is not swept twice", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { mediaId: AD },
      { mediaId: POST },
    ]);
    await expect(adMediaFor(POST)).resolves.toEqual([AD]);
  });

  it("drops rows without a media id", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { mediaId: null },
      { mediaId: AD },
    ]);
    await expect(adMediaFor(POST)).resolves.toEqual([AD]);
  });

  it("returns nothing when the post was never boosted", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    await expect(adMediaFor(POST)).resolves.toEqual([]);
  });

  it("swallows a query failure, leaving the post itself still swept", async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error("connection lost"));
    await expect(adMediaFor(POST)).resolves.toEqual([]);
  });
});

describe("comment polling does not recreate unsafe sends", () => {
  beforeEach(() => {
    queueAdd.mockReset();
    mockPrisma.operationalEvent.create.mockResolvedValue({});
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.automation.findMany.mockResolvedValue([
      {
        id: "campaign",
        name: "Campaign",
        workspaceId: "workspace",
        postId: POST,
        matchAnyWord: false,
        keywords: ["AI"],
        publicReplyEnabled: true,
        instagramAccount: {
          id: "connection",
          instagramId: "owner",
          provider: "META",
          accessToken: "test",
        },
      },
    ]);
    readComments.mockResolvedValue([
      {
        id: "old",
        text: "AI",
        from: { id: "reader" },
        timestamp: new Date().toISOString(),
      },
      {
        id: "new",
        text: "AI",
        from: { id: "another-reader" },
        timestamp: new Date().toISOString(),
      },
    ]);
  });
  it.each([
    { status: "FAILED", attempts: 1, dmDeliveryUnconfirmed: true },
    { status: "FAILED", attempts: 3, dmDeliveryUnconfirmed: false },
    {
      status: "FAILED",
      attempts: 1,
      errorMessage: "MetaApiError 1: An unknown error has occurred.",
    },
    { status: "PENDING", attempts: 1, dmDeliveryUnconfirmed: true },
  ])(
    "leaves an unsafe old comment alone while continuing new comments: %j",
    async (state) => {
      mockPrisma.dmLog.findMany.mockResolvedValue([
        { commentId: "old", publicReplySentAt: new Date(), ...state },
      ]);
      await reconcileComments();
      await reconcileComments();
      expect(queueAdd).toHaveBeenCalledTimes(2);
      for (const [, data] of queueAdd.mock.calls)
        expect(data.commentId).toBe("new");
    },
  );
});

const CLEAN_SWEEP: SweepStat = {
  campaign: "Skeletron",
  keywords: "Crazy,stl",
  matched: 0,
  alreadyReplied: 0,
  enqueued: 0,
  errors: [],
};

describe("sweepMessage", () => {
  it("reports the counters of a sweep that worked", () => {
    expect(
      sweepMessage({
        ...CLEAN_SWEEP,
        enqueued: 2,
        matched: 5,
        alreadyReplied: 3,
      })
    ).toBe(
      'Comment sweep "Skeletron" [Crazy,stl]: 2 enqueued, 5 matched, 3 already replied'
    );
  });

  it("names the failure, so a zeroed sweep is not read as an idle one", () => {
    expect(
      sweepMessage({
        ...CLEAN_SWEEP,
        errors: [{ scope: "token", reason: "Failed to decrypt access token" }],
      })
    ).toBe(
      'Comment sweep "Skeletron" [Crazy,stl]: 0 enqueued, 0 matched, 0 already replied \u2014 token: Failed to decrypt access token'
    );
  });
});

describe("summarizeSweepErrors", () => {
  it("says nothing when nothing failed", () => {
    expect(summarizeSweepErrors([])).toBe("");
  });

  it("collapses one reason shared by several media into a single entry", () => {
    expect(
      summarizeSweepErrors([
        { scope: "media 1", reason: "Meta 368: rate limit" },
        { scope: "media 2", reason: "Meta 368: rate limit" },
        { scope: "media 3", reason: "Meta 368: rate limit" },
      ])
    ).toBe("media 1 (\u00d73): Meta 368: rate limit");
  });

  it("keeps distinct reasons apart", () => {
    expect(
      summarizeSweepErrors([
        { scope: "media list", reason: "Meta 190: session expired" },
        { scope: "media 1", reason: "Meta 368: rate limit" },
      ])
    ).toBe(
      "media list: Meta 190: session expired; media 1: Meta 368: rate limit"
    );
  });

  it("caps the list so one failure mode cannot hide the rest", () => {
    expect(
      summarizeSweepErrors(
        ["a", "b", "c", "d", "e"].map((reason, i) => ({
          scope: `media ${i}`,
          reason,
        }))
      )
    ).toBe("media 0: a; media 1: b; media 2: c; +2 more");
  });

  it("truncates a reason long enough to crowd out the others", () => {
    const summary = summarizeSweepErrors([
      { scope: "media 1", reason: "x".repeat(400) },
      { scope: "media 2", reason: "Meta 368: rate limit" },
    ]);
    expect(summary).toContain("\u2026");
    expect(summary).toContain("media 2: Meta 368: rate limit");
    expect(summary.length).toBeLessThan(250);
  });
});
