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

const fields = {
  role: document.getElementById("role"),
  purpose: document.getElementById("purpose"),
  comfort: document.getElementById("comfort"),
  notes: document.getElementById("notes"),
  pageText: document.getElementById("pageText"),
  localMemory: document.getElementById("localMemory"),
  remoteProcessing: document.getElementById("remoteProcessing")
};

const output = document.getElementById("exportOutput");

function readForm() {
  return {
    ...DEFAULT_MEMORY,
    role: fields.role.value.trim(),
    purpose: fields.purpose.value,
    comfort: fields.comfort.value,
    notes: fields.notes.value.trim(),
    consent: {
      pageText: fields.pageText.checked,
      localMemory: fields.localMemory.checked,
      remoteProcessing: false
    }
  };
}

function writeForm(memory) {
  fields.role.value = memory.role || "";
  fields.purpose.value = memory.purpose || DEFAULT_MEMORY.purpose;
  fields.comfort.value = memory.comfort || DEFAULT_MEMORY.comfort;
  fields.notes.value = memory.notes || "";
  fields.pageText.checked = memory.consent?.pageText ?? true;
  fields.localMemory.checked = memory.consent?.localMemory ?? true;
  fields.remoteProcessing.checked = false;
}

async function loadMemory() {
  const result = await chrome.storage.local.get(["commonGroundMemory"]);
  writeForm({ ...DEFAULT_MEMORY, ...(result.commonGroundMemory || {}) });
}

document.getElementById("memoryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await chrome.storage.local.set({ commonGroundMemory: readForm() });
  output.textContent = "Saved.";
});

document.getElementById("exportMemory").addEventListener("click", () => {
  output.textContent = JSON.stringify(readForm(), null, 2);
});

document.getElementById("clearMemory").addEventListener("click", async () => {
  await chrome.storage.local.set({ commonGroundMemory: DEFAULT_MEMORY });
  writeForm(DEFAULT_MEMORY);
  output.textContent = "Cleared local portable memory.";
});

loadMemory();
