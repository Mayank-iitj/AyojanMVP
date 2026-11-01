import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Rfc7807Error } from '../engine/types';

interface RateBucket {
  count: number;
  resetAtMs: number;
}

const MAX_BUCKETS = 2000;
const WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 120;

const rateLimitBuckets = new Map<string, RateBucket>();

/**
 * Enforces a bounded-memory sliding window rate limit per client IP + route bucket.
 */
export function checkRateLimit(
  req: NextRequest,
  bucketKey = 'api',
  maxRequests = DEFAULT_MAX_REQUESTS
): {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
  limit: number;
} {
  const now = Date.now();
  const forwarded = req.headers.get('x-forwarded-for');
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const key = `${bucketKey}:${clientIp}`;

  if (rateLimitBuckets.size > MAX_BUCKETS) {
    for (const [k, v] of rateLimitBuckets.entries()) {
      if (v.resetAtMs <= now) {
        rateLimitBuckets.delete(k);
      }
      if (rateLimitBuckets.size <= MAX_BUCKETS / 2) break;
    }
  }

  const existing = rateLimitBuckets.get(key);
  if (!existing || existing.resetAtMs <= now) {
    const resetAtMs = now + WINDOW_MS;
    rateLimitBuckets.set(key, { count: 1, resetAtMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAtMs,
      limit: maxRequests,
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, maxRequests - existing.count);
  return {
    allowed: existing.count <= maxRequests,
    remaining,
    resetAtMs: existing.resetAtMs,
    limit: maxRequests,
  };
}

/**
 * Strips executable HTML/script payloads and control characters from untrusted user text.
 */
export function sanitizeUserText(input: string, maxLength = 280): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Constant-time comparison of two hex SHA-256 digests to prevent timing side-channels.
 */
export function timingSafeHexEqual(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length) return false;
  try {
    const bufA = Buffer.from(aHex, 'hex');
    const bufB = Buffer.from(bHex, 'hex');
    if (bufA.length !== bufB.length || bufA.length === 0) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Attaches standard tracing, security, and rate-limit headers to a NextResponse.
 */
export function withSecurityHeaders<T>(
  res: NextResponse<T>,
  req?: NextRequest,
  rateInfo?: { limit: number; remaining: number; resetAtMs: number }
): NextResponse<T> {
  const correlationId =
    req?.headers.get('x-correlation-id') || crypto.randomUUID();
  res.headers.set('X-Correlation-ID', correlationId);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (rateInfo) {
    res.headers.set('X-RateLimit-Limit', String(rateInfo.limit));
    res.headers.set('X-RateLimit-Remaining', String(rateInfo.remaining));
    res.headers.set(
      'X-RateLimit-Reset',
      String(Math.ceil(rateInfo.resetAtMs / 1000))
    );
  }
  return res;
}

/**
 * Builds an RFC 7807 Problem Details JSON response with standard security headers.
 */
export function rfc7807Response(
  problem: Omit<Rfc7807Error, 'request_id'> & { request_id?: string },
  req?: NextRequest
): NextResponse<Rfc7807Error> {
  const fullProblem: Rfc7807Error = {
    ...problem,
    request_id:
      problem.request_id ||
      req?.headers.get('x-correlation-id') ||
      `req_${crypto.randomUUID().slice(0, 8)}`,
  };
  const res = NextResponse.json(fullProblem, {
    status: fullProblem.status,
    headers: {
      'Content-Type': 'application/problem+json',
    },
  });
  return withSecurityHeaders(res, req);
}
