import type { NextFunction, Request, Response } from 'express';

// Mirrors the frontend's already-established RBAC matrix (packages/frontend/src/shared/core.js,
// the `RBAC` table) so backend enforcement matches what the UI already implies - e.g. only
// hr/partner can approve leave, only hr can manage holidays. Must run after requireAuth.
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}
