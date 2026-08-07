import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ZodError, type ZodSchema } from 'zod';

import { env } from '@/config/env';
import { AppError } from '@/lib/errors';

/** Validates and REPLACES the given request part with the parsed result. */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        new AppError(400, 'VALIDATION_ERROR', 'Some fields need fixing.', fieldErrors(result.error))
      );
    }
    // Query/params are getter-only on Express 5; assign defensively.
    if (source === 'body') req.body = result.data;
    else Object.defineProperty(req, source, { value: result.data, writable: true });
    next();
  };
}

function fieldErrors(error: ZodError) {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    const key = issue.path.join('.') || '_';
    if (!acc[key]) acc[key] = issue.message;
    return acc;
  }, {});
}

/** Tight limit on OTP endpoints — this is the SMS-cost and brute-force surface. */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many code requests. Try again in a few minutes.' } },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Cannot ${req.method} ${req.path}` },
  });
}

// Must keep all four params — Express identifies error handlers by arity.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Some fields need fixing.', details: fieldErrors(err) },
    });
  }

  // Prisma's unique-constraint violation.
  if (typeof err === 'object' && err && 'code' in err && (err as { code: string }).code === 'P2002') {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'That record already exists.' },
    });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our end.',
      ...(env.isProd ? {} : { debug: err instanceof Error ? err.message : String(err) }),
    },
  });
}

/** Wraps an async handler so rejected promises reach the error handler. */
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(
  fn: T
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
