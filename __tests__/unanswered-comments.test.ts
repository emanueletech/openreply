import { describe, expect, it } from "vitest";
import { pickUnanswered, type CampaignRule } from "../lib/unanswered-comments";
import type { InstagramComment, InstagramMedia } from "../lib/meta/client";

const OWNER = "owner-1";
const media: InstagramMedia = {
  id: "media-1",
  caption: "Articulated dragon",
  media_type: "VIDEO",
  timestamp: "2026-11-16T10:00:00+0000",
  permalink: "https://www.instagram.com/reel/abc/",
};

function comment(id: string, text: string, from = "user-1", replies: string[] = []): InstagramComment {
  return {
    id,
    text,
    timestamp: "2026-11-17T08:00:00+0000",
    from: { id: from, username: `u_${from}` },
    replies: { data: replies.map((r, i) => ({ id: `${id}-r${i}`, from: { id: r } })) },
  } as InstagramComment;
}

const campaign = (over: Partial<CampaignRule> = {}): CampaignRule => ({
  postId: "media-1",
  matchAnyPost: false,
  matchAnyWord: false,
  keywords: ["dragon", "stl"],
  wholeWordMatch: true,
  ...over,
});

describe("pickUnanswered", () => {
  it("keeps a plain comment on a post without campaigns", () => {
    const out = pickUnanswered([comment("c1", "So cool!")], media, OWNER, [], new Set());
    expect(out).toEqual([
      expect.objectContaining({ id: "c1", text: "So cool!", username: "u_user-1", mediaId: "media-1", keyword: null }),
    ]);
  });

  it("skips the account's own comments and comments it already replied to", () => {
    const out = pickUnanswered(
      [comment("c1", "hi", OWNER), comment("c2", "nice", "user-2", [OWNER]), comment("c3", "wow", "user-3", ["user-9"])],
      media,
      OWNER,
      [],
      new Set()
    );
    expect(out.map((c) => c.id)).toEqual(["c3"]);
  });

  it("skips comments a campaign handled or will handle, and reports its first keyword", () => {
    const out = pickUnanswered(
      [comment("c1", "DRAGON please"), comment("c2", "what filament?"), comment("c3", "logged")],
      media,
      OWNER,
      [campaign()],
      new Set(["c3"])
    );
    expect(out.map((c) => c.id)).toEqual(["c2"]);
    expect(out[0].keyword).toBe("dragon");
  });

  it("ignores campaigns bound to other posts but honours any-post ones", () => {
    const other = campaign({ postId: "media-2" });
    expect(pickUnanswered([comment("c1", "stl?")], media, OWNER, [other], new Set())).toHaveLength(1);
    const anyPost = campaign({ postId: null, matchAnyPost: true });
    expect(pickUnanswered([comment("c1", "stl?")], media, OWNER, [anyPost], new Set())).toHaveLength(0);
  });

  it("treats an any-word campaign as answering every comment", () => {
    const out = pickUnanswered([comment("c1", "hello")], media, OWNER, [campaign({ matchAnyWord: true })], new Set());
    expect(out).toHaveLength(0);
  });
});
