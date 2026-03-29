import { Request, Response, NextFunction } from "express";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

export interface AuthUser {
  userId: number;
  role: string;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.["session_token"] || req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    res.status(401).json({ error: "Unauthorized", message: "No session token" });
    return;
  }

  try {
    const sessions = await db
      .select({
        userId: sessionsTable.userId,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
      })
      .from(sessionsTable)
      .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
      .where(
        and(
          eq(sessionsTable.token, token),
          gt(sessionsTable.expiresAt, new Date())
        )
      )
      .limit(1);

    if (sessions.length === 0) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid or expired session" });
      return;
    }

    req.user = sessions[0] as AuthUser;
    next();
  } catch (err) {
    req.log.error({ err }, "Auth middleware error");
    res.status(500).json({ error: "Internal server error" });
  }
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await requireAuth(req, res, () => {
      if (!req.user || !roles.includes(req.user.role)) {
        res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" });
        return;
      }
      next();
    });
  };
}
