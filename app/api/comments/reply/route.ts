import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { createInstagramContext, sendCommentReply } from "@/lib/instagram/provider";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
  getTokenWorkspaceContext,
} from "@/lib/workspace-access";

const replySchema = z.object({
  commentId: z.string().min(1).max(100),
  // Instagram caps a comment at 2,200 characters.
  message: z.string().trim().min(1).max(2200),
  mediaId: z.string().max(100).optional(),
});

/// Posts a public reply to one comment, for the comment bot on the NAS
/// (Bearer AUTOMATION_API_TOKEN) or an owner's browser session.
export async function POST(request: NextRequest) {
  const context =
    (await getTokenWorkspaceContext(request)) ?? (await getCurrentWorkspaceContext());
  if (!context) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const parsed = replySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const account = await getWorkspaceInstagramAccount(context.workspaceId);
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Instagram account not connected" },
      { status: 400 }
    );
  }

  try {
    const result = await sendCommentReply({
      context: await createInstagramContext(account),
      commentId: parsed.data.commentId,
      message: parsed.data.message,
      postId: parsed.data.mediaId,
    });
    return NextResponse.json({ success: true, data: { id: result.id } });
  } catch (err) {
    console.error("[Comment reply] Error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to reply" },
      { status: 502 }
    );
  }
}
