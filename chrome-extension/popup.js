const DEFAULT_MEMORY = {
  role: "",
  purpose: "understand",
  depth: "plain",
  comfort: "balanced",
  lens: "clarity",
  notes: "",
  profileText: "",
  consent: {
    pageText: true,
    localMemory: true,
    remoteProcessing: false,
    profileInApi: false
  },
  backendUrl: "http://localhost:8787/adapt"
};

const purpose = document.getElementById("purpose");
const role = document.getElementById("role");
const status = document.getElementById("status");
const tempContext = document.getElementById("tempContext");
const tempState = document.getElementById("tempState");
const depthButtons = [...document.querySelectorAll("[data-depth]")];

let selectedDepth = DEFAULT_MEMORY.depth;

function setStatus(message) {
  status.textContent = message;
  if (!message) return;
  setTimeout(() => {
    status.textContent = "";
  }, 2400);
}

function setDepth(depth) {
  selectedDepth = depth;
  depthButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.depth === depth);
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function saveMemory() {
  const result = await chrome.storage.local.get(["commonGroundMemory"]);
  const existing = result.commonGroundMemory || DEFAULT_MEMORY;
  const memory = {
    ...DEFAULT_MEMORY,
    ...existing,
    purpose: purpose.value,
    depth: selectedDepth,
    role: role.value.trim()
  };

  await chrome.storage.local.set({ commonGroundMemory: memory });
  return memory;
}

function getLocalTempDraft(page) {
  const text = page.text || "";
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 45 && sentence.length < 260)
    .slice(0, 6);

  return JSON.stringify(
    {
      source: "visible_page",
      sourceTitle: page.title || "Untitled page",
      sourceUrl: page.url || "",
      createdAt: new Date().toISOString(),
      summary: sentences.slice(0, 3).join(" "),
      relevantSignals: sentences.slice(3, 6),
      useGuidance: "Use this temporary context to personalize explanations, examples, vocabulary, and next steps. Do not treat it as verified identity data."
    },
    null,
    2
  );
}

async function getTempContext() {
  const result = await chrome.storage.session.get(["commonGroundTempContext"]);
  return result.commonGroundTempContext || null;
}

async function refreshTempState() {
  const temp = await getTempContext();
  if (!temp) {
    tempState.textContent = "None saved";
    return;
  }

  tempState.textContent = "Saved this session";
  if (!tempContext.value.trim()) {
    tempContext.value = temp.text || "";
  }
}

async function getPageCapture() {
  const tab = await getActiveTab();

  if (!tab?.id) {
    throw new Error("No active tab");
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { type: "CG_GET_PAGE_PAYLOAD" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error("Refresh page"));
        return;
      }

      if (!response?.page?.text) {
        reject(new Error("No visible text"));
        return;
      }

      resolve(response.page);
    });
  });
}

async function buildRemoteTempDraft(page, memory) {
  const backendUrl = memory.backendUrl || DEFAULT_MEMORY.backendUrl;
  const response = await fetch(backendUrl.replace(/\/adapt$/, "/profile"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      page,
      memory
    })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Profile capture failed");
  }

  return JSON.stringify(data.profile, null, 2);
}

async function captureTempContext() {
  setStatus("Capturing...");
  const page = await getPageCapture();
  const memory = await saveMemory();
  let draft = "";

  if (memory.consent?.remoteProcessing) {
    try {
      draft = await buildRemoteTempDraft(page, memory);
    } catch {
      draft = getLocalTempDraft(page);
      setStatus("Local draft");
    }
  } else {
    draft = getLocalTempDraft(page);
  }

  tempContext.value = draft;
  setStatus("Review then save");
}

async function saveTempContext() {
  const text = tempContext.value.trim();

  if (!text) {
    setStatus("Nothing to save");
    return;
  }

  await chrome.storage.session.set({
    commonGroundTempContext: {
      text,
      savedAt: new Date().toISOString()
    }
  });
  await refreshTempState();
  setStatus("Temp saved");
}

async function clearTempContext() {
  await chrome.storage.session.remove(["commonGroundTempContext"]);
  tempContext.value = "";
  await refreshTempState();
  setStatus("Temp cleared");
}

async function sendToPage(type) {
  const memory = await saveMemory();
  const temp = await getTempContext();
  const tab = await getActiveTab();

  if (!tab?.id) {
    setStatus("No active tab");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type, memory: { ...memory, tempContext: temp } }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Refresh page");
      return;
    }

    setStatus(response?.message || "Done");
  });
}

chrome.storage.local.get(["commonGroundMemory"], (result) => {
  const memory = { ...DEFAULT_MEMORY, ...(result.commonGroundMemory || {}) };
  purpose.value = memory.purpose || DEFAULT_MEMORY.purpose;
  role.value = memory.role || "";
  setDepth(memory.depth || DEFAULT_MEMORY.depth);
});

refreshTempState();

purpose.addEventListener("change", saveMemory);
role.addEventListener("change", saveMemory);

depthButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setDepth(button.dataset.depth);
    saveMemory();
  });
});

document.getElementById("adaptPage").addEventListener("click", () => {
  sendToPage("CG_ADAPT_PAGE");
});

document.getElementById("toggleOverlay").addEventListener("click", () => {
  sendToPage("CG_TOGGLE_OVERLAY");
});

document.getElementById("captureTemp").addEventListener("click", () => {
  captureTempContext().catch((error) => {
    setStatus(error.message || "Capture failed");
  });
});

document.getElementById("saveTemp").addEventListener("click", () => {
  saveTempContext();
});

document.getElementById("clearTemp").addEventListener("click", () => {
  clearTempContext();
});

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
