import { NextRequest, NextResponse } from 'next/server';
import { buildRoleScopedSharePayload } from '@/lib/engine/export-utils';
import {
  checkRateLimit,
  rfc7807Response,
  timingSafeHexEqual,
  withSecurityHeaders,
} from '@/lib/server/security';
import { getStore, hashShareToken } from '@/lib/server/store';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const rate = checkRateLimit(req, 'share', 90);
  if (!rate.allowed) {
    return rfc7807Response(
      {
        type: 'https://aayojan.dev/errors/rate-limit-exceeded',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Share link lookup rate limit exceeded. Please retry shortly.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      req
    );
  }

  const { token } = await context.params;
  const store = getStore();
  const link = store.shareLinks.get(token);

  if (!link || !timingSafeHexEqual(link.token_hash, hashShareToken(token))) {
    return rfc7807Response(
      {
        type: 'https://aayojan.dev/errors/share-not-found',
        title: 'Share Link Not Found',
        status: 404,
        detail: 'This share link does not exist.',
        code: 'SHARE_LINK_NOT_FOUND',
      },
      req
    );
  }

  if (link.revoked_at) {
    return rfc7807Response(
      {
        type: 'https://aayojan.dev/errors/share-revoked',
        title: 'Share Link Revoked',
        status: 410,
        detail: `This share link was revoked by the organizer on ${link.revoked_at.slice(0, 10)}.`,
        code: 'SHARE_LINK_REVOKED',
      },
      req
    );
  }

  if (new Date(link.expires_at).getTime() <= Date.now()) {
    return rfc7807Response(
      {
        type: 'https://aayojan.dev/errors/share-expired',
        title: 'Share Link Expired',
        status: 410,
        detail: `This share link expired on ${link.expires_at.slice(0, 10)}.`,
        code: 'SHARE_LINK_EXPIRED',
      },
      req
    );
  }

  const event = store.events.get(link.event_id);
  if (!event) {
    return rfc7807Response(
      {
        type: 'https://aayojan.dev/errors/event-not-found',
        title: 'Event Not Found',
        status: 404,
        detail: 'The associated event was not found.',
        code: 'EVENT_NOT_FOUND',
      },
      req
    );
  }

  const payload = buildRoleScopedSharePayload(event, link);
  return withSecurityHeaders(NextResponse.json(payload), req, rate);
}
