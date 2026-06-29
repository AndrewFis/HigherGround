const OVERLAY_ID = "commonground-overlay";

const PURPOSE_LABELS = {
  understand: "Understand",
  decide: "Decide",
  apply: "Apply",
  teach: "Teach",
  scan: "Scan"
};

const DEPTH_LABELS = {
  plain: "Plain language",
  balanced: "Balanced",
  deep: "Deeper context"
};

function getCandidateText() {
  const selectors = [
    "article",
    "main",
    "[role='main']",
    ".content",
    ".post",
    ".entry-content"
  ];

  const candidates = selectors
    .flatMap((selector) => [...document.querySelectorAll(selector)])
    .filter((node) => node.innerText && node.innerText.trim().length > 300)
    .sort((a, b) => b.innerText.length - a.innerText.length);

  const source = candidates[0] || document.body;
  return source.innerText
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

function applyConsent(memory) {
  const consent = {
    pageText: memory.consent?.pageText ?? true,
    localMemory: memory.consent?.localMemory ?? true,
    remoteProcessing: false
  };

  if (consent.localMemory) {
    return { ...memory, consent };
  }

  return {
    purpose: memory.purpose || "understand",
    depth: memory.depth || "plain",
    role: "",
    notes: "",
    consent
  };
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 36 && sentence.length < 320);
}

function scoreSentence(sentence, memory) {
  const lower = sentence.toLowerCase();
  const purposeTerms = {
    understand: ["means", "because", "important", "learn", "understand"],
    decide: ["option", "risk", "benefit", "cost", "choose", "compare"],
    apply: ["step", "must", "should", "use", "complete", "start"],
    teach: ["example", "means", "because", "helps", "explains"],
    scan: ["important", "summary", "key", "must", "deadline", "require"]
  };

  let score = Math.min(sentence.length / 90, 3);
  (purposeTerms[memory.purpose] || []).forEach((term) => {
    if (lower.includes(term)) score += 2;
  });

  if (memory.role && lower.includes(memory.role.toLowerCase())) score += 2;
  if (/\b(need|must|required|cannot|deadline|eligib|warning)\b/i.test(sentence)) score += 1.5;

  return score;
}

function extractTerms(sentences) {
  const terms = new Map();
  const pattern = /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}|[A-Z]{2,})\b/g;

  sentences.slice(0, 60).forEach((sentence) => {
    [...sentence.matchAll(pattern)].forEach((match) => {
      const term = match[1].trim();
      if (term.length < 3 || ["The", "This", "That"].includes(term)) return;
      terms.set(term, (terms.get(term) || 0) + 1);
    });
  });

  return [...terms.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term]) => term);
}

function adaptText(memory) {
  const consentedMemory = applyConsent(memory);
  const text = consentedMemory.consent.pageText ? getCandidateText() : "";
  const sentences = splitSentences(text);
  const topSentences = sentences
    .map((sentence) => ({ sentence, score: scoreSentence(sentence, consentedMemory) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, consentedMemory.depth === "deep" ? 7 : 5)
    .map((item) => item.sentence);

  const terms = extractTerms(sentences);
  const opener = buildOpener(consentedMemory, text);
  const nextSteps = buildNextSteps(consentedMemory);

  return {
    opener,
    highlights: topSentences,
    terms,
    nextSteps,
    wordCount: text ? text.split(/\s+/).length : 0
  };
}

function buildOpener(memory, text) {
  const role = memory.role ? ` as a ${memory.role}` : "";
  const purpose = PURPOSE_LABELS[memory.purpose] || "Understand";
  const depth = DEPTH_LABELS[memory.depth] || "Plain language";

  if (!text) {
    return "I could not find enough readable text on this page yet.";
  }

  return `${purpose}${role}. Lens: ${depth}. The page has been reduced to the pieces most likely to support your current reading purpose.`;
}

function buildNextSteps(memory) {
  const steps = {
    understand: [
      "Read the key points first, then return to the original page for exact wording.",
      "Pause on any named terms and decide whether they need definition or context."
    ],
    decide: [
      "Look for tradeoffs, deadlines, eligibility rules, and consequences.",
      "Compare the page's recommendation against your constraints before acting."
    ],
    apply: [
      "Turn each requirement into a checklist item.",
      "Find the first action you can complete without needing more information."
    ],
    teach: [
      "Restate the core idea in one sentence before adding detail.",
      "Use one example that matches your audience's lived context."
    ],
    scan: [
      "Start with warnings, requirements, dates, and repeated terms.",
      "Open the original section only when a key point affects your task."
    ]
  };

  return steps[memory.purpose] || steps.understand;
}

function ensureOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;

  overlay = document.createElement("aside");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("aria-label", "CommonGround adaptive reader overlay");
  overlay.innerHTML = `
    <header class="cg-header">
      <div class="cg-title">
        <p class="cg-eyebrow">CommonGround</p>
        <h2>Adaptive reader</h2>
      </div>
      <button type="button" class="cg-close" aria-label="Close CommonGround overlay">×</button>
    </header>
    <div class="cg-body">
      <section class="cg-section">
        <h3>Reading lens</h3>
        <p data-cg-opener>Choose Adapt page from the extension popup.</p>
      </section>
      <section class="cg-section">
        <h3>Key points</h3>
        <ol data-cg-highlights></ol>
      </section>
      <section class="cg-section">
        <h3>Terms to notice</h3>
        <div class="cg-chip-row" data-cg-terms></div>
      </section>
      <section class="cg-section">
        <h3>Useful next moves</h3>
        <ul data-cg-next></ul>
      </section>
      <div class="cg-consent">
        No page text leaves this browser in this prototype. Memory is stored with Chrome local storage.
      </div>
    </div>
    <footer class="cg-footer">
      <button type="button" class="cg-action" data-cg-readable>Reading mode</button>
      <button type="button" class="cg-action" data-cg-refresh>Refresh lens</button>
    </footer>
  `;

  overlay.querySelector(".cg-close").addEventListener("click", () => {
    overlay.hidden = true;
  });

  overlay.querySelector("[data-cg-readable]").addEventListener("click", () => {
    document.documentElement.classList.toggle("commonground-readable");
  });

  overlay.querySelector("[data-cg-refresh]").addEventListener("click", () => {
    chrome.storage.local.get(["commonGroundMemory"], (result) => {
      renderOverlay(result.commonGroundMemory || {});
    });
  });

  document.documentElement.appendChild(overlay);
  return overlay;
}

function renderOverlay(memory) {
  const overlay = ensureOverlay();
  const adapted = adaptText(memory);

  overlay.querySelector("[data-cg-opener]").textContent =
    `${adapted.opener} Approximate page length: ${adapted.wordCount.toLocaleString()} words.`;

  const highlights = overlay.querySelector("[data-cg-highlights]");
  highlights.replaceChildren(
    ...adapted.highlights.map((sentence) => {
      const item = document.createElement("li");
      item.textContent = sentence;
      return item;
    })
  );

  const terms = overlay.querySelector("[data-cg-terms]");
  terms.replaceChildren(
    ...adapted.terms.map((term) => {
      const chip = document.createElement("span");
      chip.className = "cg-chip";
      chip.textContent = term;
      return chip;
    })
  );

  const next = overlay.querySelector("[data-cg-next]");
  next.replaceChildren(
    ...adapted.nextSteps.map((step) => {
      const item = document.createElement("li");
      item.textContent = step;
      return item;
    })
  );

  overlay.hidden = false;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === "CG_TOGGLE_OVERLAY") {
    const overlay = ensureOverlay();
    overlay.hidden = !overlay.hidden;
    sendResponse({ message: overlay.hidden ? "Hidden" : "Shown" });
    return true;
  }

  if (request.type === "CG_ADAPT_PAGE") {
    renderOverlay(request.memory || {});
    sendResponse({ message: "Adapted" });
    return true;
  }

  return false;
});
