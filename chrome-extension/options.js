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

const fields = {
  role: document.getElementById("role"),
  purpose: document.getElementById("purpose"),
  comfort: document.getElementById("comfort"),
  lens: document.getElementById("lens"),
  notes: document.getElementById("notes"),
  profileText: document.getElementById("profileText"),
  pageText: document.getElementById("pageText"),
  localMemory: document.getElementById("localMemory"),
  remoteProcessing: document.getElementById("remoteProcessing"),
  profileInApi: document.getElementById("profileInApi"),
  backendUrl: document.getElementById("backendUrl")
};

const output = document.getElementById("exportOutput");

function readForm() {
  return {
    ...DEFAULT_MEMORY,
    role: fields.role.value.trim(),
    purpose: fields.purpose.value,
    comfort: fields.comfort.value,
    lens: fields.lens.value,
    notes: fields.notes.value.trim(),
    profileText: fields.profileText.value.trim(),
    consent: {
      pageText: fields.pageText.checked,
      localMemory: fields.localMemory.checked,
      remoteProcessing: fields.remoteProcessing.checked,
      profileInApi: fields.profileInApi.checked
    },
    backendUrl: fields.backendUrl.value.trim() || DEFAULT_MEMORY.backendUrl
  };
}

function writeForm(memory) {
  fields.role.value = memory.role || "";
  fields.purpose.value = memory.purpose || DEFAULT_MEMORY.purpose;
  fields.comfort.value = memory.comfort || DEFAULT_MEMORY.comfort;
  fields.lens.value = memory.lens || DEFAULT_MEMORY.lens;
  fields.notes.value = memory.notes || "";
  fields.profileText.value = memory.profileText || "";
  fields.pageText.checked = memory.consent?.pageText ?? true;
  fields.localMemory.checked = memory.consent?.localMemory ?? true;
  fields.remoteProcessing.checked = memory.consent?.remoteProcessing ?? false;
  fields.profileInApi.checked = memory.consent?.profileInApi ?? false;
  fields.backendUrl.value = memory.backendUrl || DEFAULT_MEMORY.backendUrl;
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
