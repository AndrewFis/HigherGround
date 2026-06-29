import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_PAGE_CHARS = 18000;

const LENSES = {
  clarity: {
    name: "Clarity",
    instruction: "Explain the page in plain language, prioritize the main idea, define unfamiliar concepts, and avoid unnecessary detail."
  },
  action: {
    name: "Action",
    instruction: "Turn the page into practical next steps, requirements, deadlines, decisions, and things the reader can do next."
  },
  learning: {
    name: "Learning",
    instruction: "Teach the page like a tutor: introduce concepts, use examples, connect new ideas to likely prior knowledge, and check for confusion."
  },
  decision: {
    name: "Decision",
    instruction: "Surface choices, tradeoffs, risks, benefits, assumptions, and information the reader should verify before deciding."
  },
  advocacy: {
    name: "Advocacy",
    instruction: "Help the reader ask stronger questions, notice missing information, prepare for conversations, and advocate for their needs."
  }
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function safeString(value, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeProfile(profileText) {
  const text = safeString(profileText, 5000);
  if (!text) return null;

  try {
    return {
      format: "json",
      value: JSON.parse(text)
    };
  } catch {
    return {
      format: "text",
      value: text
    };
  }
}

function normalizeTempContext(tempContext) {
  const text = safeString(tempContext?.text, 5000);
  if (!text) return null;

  try {
    return {
      format: "json",
      savedAt: safeString(tempContext.savedAt, 80),
      value: JSON.parse(text)
    };
  } catch {
    return {
      format: "text",
      savedAt: safeString(tempContext.savedAt, 80),
      value: text
    };
  }
}

function normalizePayload(payload) {
  const memory = payload.memory || {};
  const consent = memory.consent || {};
  const lensKey = safeString(memory.lens, 80) || "clarity";
  const canUseMemory = Boolean(consent.localMemory);
  const canUseProfile = canUseMemory && Boolean(consent.profileInApi);

  return {
    page: {
      title: safeString(payload.page?.title, 240),
      url: safeString(payload.page?.url, 600),
      text: safeString(payload.page?.text, MAX_PAGE_CHARS)
    },
    memory: {
      role: consent.localMemory ? safeString(memory.role, 500) : "",
      purpose: safeString(memory.purpose, 80) || "understand",
      depth: safeString(memory.depth, 80) || "plain",
      comfort: canUseMemory ? safeString(memory.comfort, 80) : "",
      lens: LENSES[lensKey] ? lensKey : "clarity",
      notes: canUseMemory ? safeString(memory.notes, 3000) : "",
      profile: canUseProfile ? normalizeProfile(memory.profileText) : null,
      tempContext: normalizeTempContext(memory.tempContext),
      consent: {
        pageText: Boolean(consent.pageText),
        localMemory: canUseMemory,
        remoteProcessing: Boolean(consent.remoteProcessing),
        profileInApi: canUseProfile
      }
    }
  };
}

function buildPrompt({ page, memory }) {
  const lens = LENSES[memory.lens] || LENSES.clarity;

  return [
    {
      role: "system",
      content: [
        "You are CommonGround, a privacy-preserving adaptive reader for HigherGround.",
        "Adapt content to the reader's stated purpose while preserving the author's intent.",
        `Use this reader lens: ${lens.name}. ${lens.instruction}`,
        "Do not invent facts. If the page is unclear, say what is unclear.",
        "Use profile information only to contextualize presentation, examples, vocabulary, and next steps.",
        "Do not reveal sensitive profile details unless the reader explicitly included them and they are necessary for the adaptation.",
        "Return only valid JSON with keys: opener, highlights, terms, nextSteps."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Create a personalized reading adaptation for the browser extension overlay.",
        reader: {
          role: memory.role,
          purpose: memory.purpose,
          depth: memory.depth,
          comfort: memory.comfort,
          lens,
          notes: memory.notes,
          profile: memory.profile,
          temporaryContext: memory.tempContext,
          consent: memory.consent
        },
        page: {
          title: page.title,
          url: page.url,
          text: page.text
        },
        outputRules: {
          opener: "One short paragraph that frames the page for this reader.",
          highlights: "Five concise personalized bullets.",
          terms: "Up to eight terms or phrases worth noticing.",
          nextSteps: "Two to four useful next moves."
        }
      })
    }
  ];
}

function buildProfilePrompt({ page, memory }) {
  const lens = LENSES[memory.lens] || LENSES.clarity;

  return [
    {
      role: "system",
      content: [
        "You are CommonGround, creating a temporary reader context from one user-approved visible page.",
        "Summarize only what is visible in the provided page text.",
        "Do not infer sensitive traits, protected characteristics, or private facts beyond the text.",
        "The output will be reviewed by the user before being saved.",
        "Return only valid JSON with keys: source, sourceTitle, sourceUrl, createdAt, summary, relevantSignals, useGuidance."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Create a temporary context profile to personalize later article summaries.",
        selectedLens: lens,
        existingReaderMemory: {
          role: memory.role,
          purpose: memory.purpose,
          comfort: memory.comfort,
          notes: memory.notes
        },
        page: {
          title: page.title,
          url: page.url,
          text: page.text
        },
        outputRules: {
          source: "Use visible_page.",
          summary: "One concise paragraph about the relevant reader context visible on the page.",
          relevantSignals: "Five to eight short strings about professional interests, skills, domains, goals, or vantage point visible in the page text.",
          useGuidance: "One sentence explaining how this temporary context should guide later summaries."
        }
      })
    }
  ];
}

function parseModelJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}

function normalizeAdaptation(value) {
  return {
    opener: safeString(value.opener, 1200) || "Here is a personalized reading lens for this page.",
    highlights: Array.isArray(value.highlights)
      ? value.highlights.map((item) => safeString(item, 600)).filter(Boolean).slice(0, 7)
      : [],
    terms: Array.isArray(value.terms)
      ? value.terms.map((item) => safeString(item, 120)).filter(Boolean).slice(0, 8)
      : [],
    nextSteps: Array.isArray(value.nextSteps)
      ? value.nextSteps.map((item) => safeString(item, 400)).filter(Boolean).slice(0, 4)
      : []
  };
}

async function callOpenAI(payload) {
  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      input: buildPrompt(payload)
    })
  });

  const data = await openaiResponse.json();

  if (!openaiResponse.ok) {
    const message = data.error?.message || "OpenAI request failed.";
    throw new Error(message);
  }

  const outputText =
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n") ||
    "";

  if (!outputText) {
    throw new Error("OpenAI returned an empty response.");
  }

  return normalizeAdaptation(parseModelJson(outputText));
}

async function callOpenAIForProfile(payload) {
  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      input: buildProfilePrompt(payload)
    })
  });

  const data = await openaiResponse.json();

  if (!openaiResponse.ok) {
    const message = data.error?.message || "OpenAI profile request failed.";
    throw new Error(message);
  }

  const outputText =
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n") ||
    "";

  if (!outputText) {
    throw new Error("OpenAI returned an empty profile response.");
  }

  const profile = parseModelJson(outputText);
  return {
    source: safeString(profile.source, 80) || "visible_page",
    sourceTitle: safeString(profile.sourceTitle || payload.page.title, 240),
    sourceUrl: safeString(profile.sourceUrl || payload.page.url, 600),
    createdAt: safeString(profile.createdAt, 80) || new Date().toISOString(),
    summary: safeString(profile.summary, 1200),
    relevantSignals: Array.isArray(profile.relevantSignals)
      ? profile.relevantSignals.map((item) => safeString(item, 180)).filter(Boolean).slice(0, 8)
      : [],
    useGuidance: safeString(profile.useGuidance, 500)
  };
}

async function handleAdapt(request, response) {
  if (!OPENAI_API_KEY) {
    sendJson(response, 500, {
      error: "Missing OPENAI_API_KEY. Start the server with your OpenAI API key in the environment."
    });
    return;
  }

  try {
    const body = await readBody(request);
    const payload = normalizePayload(JSON.parse(body || "{}"));

    if (!payload.memory.consent.remoteProcessing) {
      sendJson(response, 403, { error: "Remote AI processing consent is off." });
      return;
    }

    if (!payload.memory.consent.pageText || !payload.page.text) {
      sendJson(response, 400, { error: "No page text was approved for AI adaptation." });
      return;
    }

    const adaptation = await callOpenAI(payload);
    sendJson(response, 200, { adaptation, model: MODEL });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unexpected server error." });
  }
}

async function handleProfile(request, response) {
  if (!OPENAI_API_KEY) {
    sendJson(response, 500, {
      error: "Missing OPENAI_API_KEY. Start the server with your OpenAI API key in the environment."
    });
    return;
  }

  try {
    const body = await readBody(request);
    const payload = normalizePayload(JSON.parse(body || "{}"));

    if (!payload.memory.consent.remoteProcessing) {
      sendJson(response, 403, { error: "Remote AI processing consent is off." });
      return;
    }

    if (!payload.memory.consent.pageText || !payload.page.text) {
      sendJson(response, 400, { error: "No page text was approved for temporary profile capture." });
      return;
    }

    const profile = await callOpenAIForProfile(payload);
    sendJson(response, 200, { profile, model: MODEL });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Unexpected server error." });
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true, model: MODEL });
    return;
  }

  if (request.method === "POST" && request.url === "/adapt") {
    handleAdapt(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/profile") {
    handleProfile(request, response);
    return;
  }

  sendJson(response, 404, { error: "Not found." });
});

server.listen(PORT, HOST, () => {
  console.log(`CommonGround API server listening on http://${HOST}:${PORT}`);
});
