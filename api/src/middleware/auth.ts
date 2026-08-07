import type { NextFunction, Request, Response } from 'express';

import { forbidden, unauthorized } from '@/lib/errors';
import { verifyToken, type Actor } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { id: string; actor: Actor };
    }
  }
}

function readBearer(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();
  const token = header.slice(7).trim();
  if (!token) throw unauthorized();
  return token;
}

/** Requires a valid token belonging to one of `actors`. */
export function requireAuth(...actors: Actor[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const payload = verifyToken(readBearer(req));
      if (actors.length && !actors.includes(payload.actor)) {
        throw forbidden('This endpoint is not available for your account type.');
      }
      req.auth = { id: payload.sub, actor: payload.actor };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Riders may browse jobs while their documents are under review, but must be
 * APPROVED before they can accept one (design.md rider verification flow).
 */
export async function requireApprovedRider(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.auth?.actor !== 'rider') throw forbidden('Rider account required.');
    const rider = await prisma.rider.findUnique({
      where: { id: req.auth.id },
      select: { status: true },
    });
    if (!rider) throw unauthorized();
    if (rider.status !== 'APPROVED') {
      throw forbidden('Your account is still being verified. You can browse jobs but not accept them yet.');
    }
    next();
  } catch (err) {
    next(err);
  }
}
