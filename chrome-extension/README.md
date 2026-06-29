# CommonGround Adaptive Reader Extension

This is a Manifest V3 Chrome extension prototype for the HigherGround/CommonGround product.

## What it does

- Adds a browser action popup for selecting a reading purpose, reading depth, and current role.
- Injects a local adaptive reader overlay into the active page.
- Extracts readable page text in the browser and creates local key points, terms, and next moves.
- Stores portable memory in `chrome.storage.local`.
- Keeps remote AI processing off for the prototype.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select this `chrome-extension` folder.
5. Open a text-heavy page, click the CommonGround extension, and choose Adapt page.

## Product direction

This scaffold is intentionally local-first. The next production step is to replace the heuristic parsing in `content.js` with the HigherGround parsing service behind an explicit consent boundary, then return structured adaptations to the same overlay UI.
