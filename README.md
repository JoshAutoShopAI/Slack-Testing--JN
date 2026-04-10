# Slack Codex Onboard (Railway)

Backend for `/codex-onboard @user email@example.com` with Slack request verification and DM kickoff.

## What it does
- Verifies Slack request signatures (`X-Slack-Signature` / `X-Slack-Request-Timestamp`)
- Accepts `/codex-onboard @user email@example.com` (mention or display name)
- Immediately acknowledges command to avoid Slack timeouts
- Sends target user a DM with a **Link Codex to Slack** button
- Posts async success/failure update to the command invoker via `response_url`

## Railway deploy
1. Create a new Railway project from this repository.
2. Set environment variables from `.env.example`.
3. Deploy.
4. Copy Railway public URL into Slack app settings:
   - Slash command URL: `https://<railway-url>/slack/commands`
   - Interactivity URL: `https://<railway-url>/slack/actions`

## Local run
```bash
npm install
npm start
```

## Test
```bash
npm test
```

## Required Slack app bot scopes
- `commands`
- `chat:write`
- `im:write`
- `users:read`
- `users:read.email`
