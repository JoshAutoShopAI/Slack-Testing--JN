import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseOnboardText, verifySlackSignature } from '../src/slackUtils.js';

test('parseOnboardText parses mention + email', () => {
  const parsed = parseOnboardText('<@U123ABC|doryan> doryan@autoshopcallbacks.net');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.targetUserId, 'U123ABC');
  assert.equal(parsed.value.email, 'doryan@autoshopcallbacks.net');
});

test('parseOnboardText accepts @display name with spaces + email', () => {
  const parsed = parseOnboardText('@Doryan Jackson doryan@autoshopcallbacks.net');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.targetUserId, null);
  assert.equal(parsed.value.targetDisplay, '@Doryan Jackson');
  assert.equal(parsed.value.email, 'doryan@autoshopcallbacks.net');
});

test('parseOnboardText rejects invalid email', () => {
  const parsed = parseOnboardText('@Doryan Jackson not-an-email');
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /valid email/i);
});

test('verifySlackSignature accepts known-good signature', () => {
  const signingSecret = 'secret';
  const timestamp = '1710000000';
  const rawBody = 'command=%2Fcodex-onboard&text=%40doryan';
  const digest = crypto
    .createHmac('sha256', signingSecret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest('hex');

  const ok = verifySlackSignature({
    signingSecret,
    timestamp,
    signature: `v0=${digest}`,
    rawBody,
    nowSeconds: 1710000001,
  });

  assert.equal(ok, true);
});

test('verifySlackSignature rejects stale requests', () => {
  const ok = verifySlackSignature({
    signingSecret: 'secret',
    timestamp: '100',
    signature: 'v0=anything',
    rawBody: 'body',
    nowSeconds: 10000,
  });

  assert.equal(ok, false);
});
