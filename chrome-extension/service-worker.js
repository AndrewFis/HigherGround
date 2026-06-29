chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["commonGroundMemory"], (result) => {
    if (result.commonGroundMemory) return;

    chrome.storage.local.set({
      commonGroundMemory: {
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
      }
    });
  });
});
