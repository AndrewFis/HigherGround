# CommonGround Adaptive Reader Extension

This is a Manifest V3 Chrome extension prototype for the HigherGround/CommonGround product.

## What it does

- Adds a browser action popup for selecting a reading purpose, reading depth, and current role.
- Injects a local adaptive reader overlay into the active page.
- Extracts readable page text in the browser and creates local key points, terms, and next moves.
- Stores portable memory in `chrome.storage.local`.
- Keeps remote AI processing off by default.
- Can call the local CommonGround API server when AI personalization is explicitly enabled.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select this `chrome-extension` folder.
5. Open a text-heavy page, click the CommonGround extension, and choose Adapt page.

## Enable OpenAI personalization

1. Start the local backend:

   ```bash
   cd ../api-server
   OPENAI_API_KEY="sk-your-key-here" npm start
   ```

2. Open the extension's Portable memory page.
3. Turn on `Allow AI personalization through my configured backend`.
4. To seed the AI call with your context, choose a Reader lens and paste a machine-readable profile.
4. Keep the backend URL set to:

   ```text
   http://localhost:8787/adapt
   ```

5. If you want the profile included in API calls, turn on `Include my machine-readable profile in AI requests`.
6. Save memory.
7. Return to a webpage and choose Adapt page.

When remote processing is off, the extension uses the local heuristic reader. When remote processing is on, it sends approved page text and approved memory to your local backend, which calls OpenAI.

## Use temporary context across tabs

For a two-tab POC:

1. Open your own profile or source page in one tab.
2. Open CommonGround.
3. Choose `Capture page`.
4. Review or edit the temporary context draft.
5. Choose `Save temp`.
6. Open an article in another tab.
7. Choose `Adapt page`.

The temporary context is stored in `chrome.storage.session`, so it is meant to last only while the browser session is open. Clear it from the popup with `Clear`.

Example machine-readable profile:

```json
{
  "readerProfileVersion": "0.1",
  "readingPreferences": {
    "language": "plain",
    "examplesFirst": true,
    "avoidJargon": true,
    "preferredStructure": "summary_then_steps"
  },
  "goals": [
    "understand what action to take next",
    "connect new information to work and learning goals"
  ],
  "doNotUse": [
    "do not make medical, legal, or financial decisions for me"
  ]
}
```

## Product direction

This scaffold is intentionally local-first. The next production step is to replace the heuristic parsing in `content.js` with the HigherGround parsing service behind an explicit consent boundary, then return structured adaptations to the same overlay UI.
