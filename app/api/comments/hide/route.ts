import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { createInstagramContext } from "@/lib/instagram/provider";
import { hideComment } from "@/lib/meta/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
  getTokenWorkspaceContext,
} from "@/lib/workspace-access";

const hideSchema = z.object({ commentId: z.string().min(1).max(100) });

/// Hides an offensive comment, for the comment bot on the NAS
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

  const parsed = hideSchema.safeParse(await request.json().catch(() => null));
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

  const instagram = await createInstagramContext(account);
  if (instagram.provider !== "META") {
    return NextResponse.json(
      { success: false, error: "Hiding comments needs the Meta provider" },
      { status: 400 }
    );
  }

  try {
    await hideComment(instagram.accessToken, parsed.data.commentId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Comment hide] Error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to hide" },
      { status: 502 }
    );
  }
}
