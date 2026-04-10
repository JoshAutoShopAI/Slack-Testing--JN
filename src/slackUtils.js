import crypto from 'node:crypto';

export function verifySlackSignature({
  signingSecret,
  timestamp,
  signature,
  rawBody,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  if (!signingSecret || !timestamp || !signature || !rawBody) {
    return false;
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 60 * 5) {
    return false;
  }

  const base = `v0:${timestamp}:${rawBody}`;
  const digest = crypto
    .createHmac('sha256', signingSecret)
    .update(base)
    .digest('hex');
  const expected = `v0=${digest}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function parseOnboardText(text) {
  const tokens = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return { ok: false, error: 'Usage: /codex-onboard @user email@example.com' };
  }

  const [targetToken, email] = tokens;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return { ok: false, error: 'Please provide a valid email as the second argument.' };
  }

  const mentionMatch = targetToken.match(/^<@([A-Z0-9]+)(?:\|[^>]+)?>$/);
  if (!mentionMatch) {
    return {
      ok: false,
      error: 'Please mention a Slack user as the first argument, e.g. @doryan',
    };
  }

  return {
    ok: true,
    value: {
      targetUserId: mentionMatch[1],
      email,
    },
  };
}
