import express from 'express';
import dotenv from 'dotenv';
import { parseOnboardText, verifySlackSignature } from './slackUtils.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(
  express.urlencoded({
    extended: true,
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

function isValidSlackRequest(req) {
  return verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    timestamp: req.headers['x-slack-request-timestamp'],
    signature: req.headers['x-slack-signature'],
    rawBody: req.rawBody,
  });
}

async function slackApi(method, body) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error('Missing SLACK_BOT_TOKEN');
  }

  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack API ${method} failed: ${data.error}`);
  }
  return data;
}

async function sendToResponseUrl(responseUrl, message) {
  if (!responseUrl) {
    return;
  }

  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(message),
  });
}

async function resolveUserId(parsedValue) {
  if (parsedValue.targetUserId) {
    return parsedValue.targetUserId;
  }

  const lookup = await slackApi('users.lookupByEmail', { email: parsedValue.email });
  const userId = lookup.user?.id;
  if (!userId) {
    throw new Error(`Could not resolve Slack user by email ${parsedValue.email}`);
  }

  return userId;
}

async function sendOnboardingDm(targetUserId, email) {
  const open = await slackApi('conversations.open', { users: targetUserId });
  const channel = open.channel?.id;

  if (!channel) {
    throw new Error('Could not open DM channel');
  }

  await slackApi('chat.postMessage', {
    channel,
    text: `Hi <@${targetUserId}>! Let's connect your Codex account for ${email}.`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Hi <@${targetUserId}>! Click below to link your Codex account and start onboarding.`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Link Codex to Slack',
              emoji: true,
            },
            url: `${process.env.APP_BASE_URL}/oauth/start?slack_user_id=${encodeURIComponent(targetUserId)}&email=${encodeURIComponent(email)}`,
            action_id: 'link_codex',
          },
        ],
      },
    ],
  });
}

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, version: process.env.APP_VERSION || 'dev' });
});

app.post('/slack/commands', async (req, res) => {
  if (!isValidSlackRequest(req)) {
    return res.status(401).send('Invalid Slack signature');
  }

  if (req.body.command !== '/codex-onboard') {
    return res.status(200).send(`Unsupported command: ${req.body.command}`);
  }

  const parsed = parseOnboardText(req.body.text);
  if (!parsed.ok) {
    return res.status(200).send(parsed.error);
  }

  const { email, targetDisplay } = parsed.value;
  const responseUrl = req.body.response_url;

  res.status(200).send(`Onboarding queued for ${targetDisplay} (${email}).`);

  try {
    const targetUserId = await resolveUserId(parsed.value);
    await sendOnboardingDm(targetUserId, email);
    await sendToResponseUrl(responseUrl, {
      response_type: 'ephemeral',
      text: `✅ DM sent to <@${targetUserId}> with Codex linking instructions.`,
    });
  } catch (error) {
    console.error(error);
    await sendToResponseUrl(responseUrl, {
      response_type: 'ephemeral',
      text: `❌ Failed to start onboarding for ${targetDisplay}: ${error.message}`,
    });
  }
});

app.post('/slack/actions', (req, res) => {
  if (!isValidSlackRequest(req)) {
    return res.status(401).send('Invalid Slack signature');
  }

  res.status(200).send();
});

app.get('/oauth/start', (req, res) => {
  const { slack_user_id: slackUserId, email } = req.query;
  res
    .status(200)
    .send(
      `Codex link placeholder for Slack user ${slackUserId} (${email}). Next: redirect to your Codex OAuth authorize URL.`
    );
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
