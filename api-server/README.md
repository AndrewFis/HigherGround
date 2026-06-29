# CommonGround API Server

This tiny backend keeps your OpenAI API key out of the Chrome extension.

## Start it

Use Node 18 or newer.

```bash
cd api-server
OPENAI_API_KEY="sk-your-key-here" npm start
```

Optional:

```bash
OPENAI_MODEL="gpt-4.1-mini" HOST=127.0.0.1 PORT=8787 npm start
```

Health check:

```bash
curl http://localhost:8787/health
```

## How it works

The Chrome extension sends approved page text and approved portable memory to:

```text
http://localhost:8787/adapt
```

The server calls the OpenAI Responses API and returns structured JSON for the extension overlay:

- `opener`
- `highlights`
- `terms`
- `nextSteps`

The API key stays only in this server process.

## Reader lens

Before the OpenAI request is made, the server combines:

- the selected reader lens
- approved role, purpose, comfort, and memory notes
- approved machine-readable profile JSON or structured text
- approved page text

The profile is only included when the extension setting `Include my machine-readable profile in AI requests` is turned on.

## Temporary context

The popup can capture visible text from a user-opened page and call:

```text
POST /profile
```

That endpoint returns an editable temporary context profile. The extension stores it in `chrome.storage.session` after the user chooses `Save temp`, then includes it in later `/adapt` calls until the browser session ends or the user clears it.
