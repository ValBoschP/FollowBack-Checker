document.getElementById("startBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ["content.js"],
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "progress") {
    const bar = document.getElementById("progress-bar");
    const text = document.getElementById("progress-text");
    bar.style.width = `${message.percent}%`;
    text.textContent = `${message.done}/${message.total} (${message.percent}%)`;
  }

  if (message.type === "result") {
    const list = document.getElementById("results-list");
    list.innerHTML = "";
    const usernames = message.users.map(u => `@${u}`).join("\n");

    message.users.forEach((user) => {
      const li = document.createElement("li");
      li.textContent = `@${user}`;
      list.appendChild(li);
    });

    // Download TXT
    const blob = new Blob([usernames], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users_not_following_you.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
});
