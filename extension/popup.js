document.getElementById("run-checker").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });

  document.getElementById("status").innerText = "Running script... check the console for progress.";
});
