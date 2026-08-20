import type { Workspace, WorkspaceRole } from "@/app/generated/prisma/client";
import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser } from "@/lib/workspace";

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  workspace: Workspace;
  role: WorkspaceRole;
};

const ROLE_ORDER: Record<WorkspaceRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function hasWorkspaceRole(
  role: WorkspaceRole,
  minimumRole: WorkspaceRole
) {
  return ROLE_ORDER[role] >= ROLE_ORDER[minimumRole];
}

export function canManageWorkspace(role: WorkspaceRole) {
  return hasWorkspaceRole(role, "ADMIN");
}

export function canManageBilling(role: WorkspaceRole) {
  return role === "OWNER";
}

/// Context for machine-to-machine calls (the publishing automation on the NAS),
/// which create a campaign before the reel exists and have no browser session.
/// Authenticated with AUTOMATION_API_TOKEN, acting as the workspace owner.
/// Returns null when the token is unset or does not match, so session auth stays
/// the only way in unless the operator opts in.
export async function getTokenWorkspaceContext(
  request: Request
): Promise<WorkspaceContext | null> {
  const expected = process.env.AUTOMATION_API_TOKEN;
  if (!expected) return null;
  if (request.headers.get("authorization") !== `Bearer ${expected}`) return null;

  const workspaceId = process.env.AUTOMATION_WORKSPACE_ID;
  const membership = await prisma.workspaceMember.findFirst({
    where: { role: "OWNER", ...(workspaceId ? { workspaceId } : {}) },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return null;

  return {
    userId: membership.userId,
    workspaceId: membership.workspaceId,
    workspace: membership.workspace,
    role: membership.role,
  };
}

export async function getCurrentWorkspaceContext(): Promise<WorkspaceContext | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (membership) {
    return {
      userId,
      workspaceId: membership.workspaceId,
      workspace: membership.workspace,
      role: membership.role,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const workspace = await ensureWorkspaceForUser(userId, user?.email);
  const createdMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId,
      },
    },
  });

  return {
    userId,
    workspaceId: workspace.id,
    workspace,
    role: createdMembership?.role ?? "OWNER",
  };
}

