import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { createInstagramContext } from "@/lib/instagram/provider";
import { findUnansweredComments } from "@/lib/unanswered-comments";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
  getTokenWorkspaceContext,
} from "@/lib/workspace-access";

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

/// Recent comments no campaign will answer, for the comment bot on the NAS
/// (Bearer AUTOMATION_API_TOKEN) or an owner's browser session.
export async function GET(request: NextRequest) {
  const context =
    (await getTokenWorkspaceContext(request)) ?? (await getCurrentWorkspaceContext());
  if (!context) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const account = await getWorkspaceInstagramAccount(context.workspaceId);
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Instagram account not connected" },
      { status: 400 }
    );
  }

  const params = request.nextUrl.searchParams;
  const hours = clampInt(params.get("hours"), 48, 1, 168);
  const posts = clampInt(params.get("posts"), 10, 1, 25);

  try {
    const comments = await findUnansweredComments({
      context: await createInstagramContext(account),
      accountId: account.id,
      instagramId: account.instagramId,
      sinceMs: Date.now() - hours * 3_600_000,
      maxPosts: posts,
    });
    return NextResponse.json({ success: true, data: comments });
  } catch (err) {
    console.error("[Unanswered comments] Error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to read comments" },
      { status: 502 }
    );
  }
}
