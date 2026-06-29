const DEFAULT_MEMORY = {
  role: "",
  purpose: "understand",
  depth: "plain",
  comfort: "balanced",
  notes: "",
  consent: {
    pageText: true,
    localMemory: true,
    remoteProcessing: false
  }
};

const purpose = document.getElementById("purpose");
const role = document.getElementById("role");
const status = document.getElementById("status");
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

async function sendToPage(type) {
  const memory = await saveMemory();
  const tab = await getActiveTab();

  if (!tab?.id) {
    setStatus("No active tab");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type, memory }, (response) => {
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

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
