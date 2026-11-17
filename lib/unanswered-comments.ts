import { prisma } from "@/lib/db/client";
import {
  getRecentMediaComments,
  getUserMedia,
  type InstagramContext,
} from "@/lib/instagram/provider";
import type { InstagramComment, InstagramMedia } from "@/lib/meta/client";
import { matchKeywords } from "@/lib/utils/keyword-matcher";

/// The fields of an active campaign that decide whether it answers a comment.
export type CampaignRule = {
  postId: string | null;
  matchAnyPost: boolean;
  matchAnyWord: boolean;
  keywords: string[];
  wholeWordMatch: boolean;
};

export type UnansweredComment = {
  id: string;
  text: string;
  username: string;
  timestamp: string | null;
  mediaId: string;
  caption: string;
  permalink: string | null;
  /// First trigger word of a campaign on this post, so a reply can tell people
  /// what to comment to get the link. Null when the post has no campaign.
  keyword: string | null;
};

const CAPTION_MAX = 1500;

/**
 * Comments on one post that nobody will answer: not written by the account,
 * not already replied to by the account, not handled by a campaign (logged in
 * DmLog) and not about to be (they would match an active campaign's keywords).
 * Kept pure so the rules can be tested without Instagram or a database.
 */
export function pickUnanswered(
  comments: InstagramComment[],
  media: InstagramMedia,
  ownerId: string,
  rules: CampaignRule[],
  handledIds: Set<string>
): UnansweredComment[] {
  const postRules = rules.filter((r) => r.postId === media.id || r.matchAnyPost);
  const keyword =
    postRules.find((r) => !r.matchAnyWord && r.keywords.length > 0)?.keywords[0] ?? null;

  return comments
    .filter((c) => {
      const authorId = c.from?.id;
      if (!authorId || authorId === ownerId) return false;
      if (handledIds.has(c.id)) return false;
      if ((c.replies?.data ?? []).some((r) => r.from?.id === ownerId)) return false;
      return !postRules.some((r) =>
        r.matchAnyWord ? true : matchKeywords(c.text ?? "", r.keywords, r.wholeWordMatch).matched
      );
    })
    .map((c) => ({
      id: c.id,
      text: c.text ?? "",
      username: c.from?.username ?? "",
      timestamp: c.timestamp ?? null,
      mediaId: media.id,
      caption: (media.caption ?? "").slice(0, CAPTION_MAX),
      permalink: media.permalink ?? null,
      keyword,
    }));
}

/**
 * Unanswered comments from the last `sinceMs` on the account's `maxPosts` most
 * recent posts, for an external service that drafts replies (the comment bot on
 * the NAS). Posts without comments are skipped to stay well inside Instagram's
 * hourly call budget.
 */
export async function findUnansweredComments({
  context,
  accountId,
  instagramId,
  sinceMs,
  maxPosts,
}: {
  context: InstagramContext;
  accountId: string;
  instagramId: string;
  sinceMs: number;
  maxPosts: number;
}): Promise<UnansweredComment[]> {
  const [media, rules] = await Promise.all([
    getUserMedia({ context, limit: maxPosts }),
    prisma.automation.findMany({
      where: { instagramAccountId: accountId, isActive: true },
      select: {
        postId: true,
        matchAnyPost: true,
        matchAnyWord: true,
        keywords: true,
        wholeWordMatch: true,
      },
    }),
  ]);

  const result: UnansweredComment[] = [];
  for (const post of media) {
    if (post.comments_count === 0) continue;
    const comments = await getRecentMediaComments({
      context,
      mediaId: post.id,
      sinceMs,
      max: 200,
    });
    if (comments.length === 0) continue;
    const handled = await prisma.dmLog.findMany({
      where: { commentId: { in: comments.map((c) => c.id) } },
      select: { commentId: true },
    });
    result.push(
      ...pickUnanswered(
        comments,
        post,
        instagramId,
        rules,
        new Set(handled.map((h) => h.commentId))
      )
    );
  }
  return result;
}
