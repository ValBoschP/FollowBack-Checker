document.getElementById("startBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: startInstagramCheck
    });
  });
});

function startInstagramCheck() {
  const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const afterUrlGenerator = (cursor, id) =>
    `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables=` +
    encodeURIComponent(JSON.stringify({
      id,
      include_reel: true,
      fetch_mutual: false,
      first: 24,
      after: cursor
    }));

  const sendProgress = (value, total) => {
    const percent = Math.floor((value / total) * 100);
    window.postMessage({ type: "FOLLOWBACK_PROGRESS", percent }, "*");
  };

  const sendResults = (usernames) => {
    window.postMessage({ type: "FOLLOWBACK_DONE", usernames }, "*");
  };

  async function startScript() {
    const csrftoken = getCookie("csrftoken");
    const ds_user_id = getCookie("ds_user_id");

    if (!csrftoken || !ds_user_id) {
      alert("You must be logged in to Instagram.");
      return;
    }

    let filteredList = [];
    let nextPage = true;
    let endCursor = null;
    let followedCount = 0;
    let progress = 0;

    while (nextPage) {
      let url = endCursor
        ? afterUrlGenerator(endCursor, ds_user_id)
        : `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables=` +
          encodeURIComponent(JSON.stringify({
            id: ds_user_id,
            include_reel: true,
            fetch_mutual: false,
            first: 24
          }));

      try {
        const res = await fetch(url);
        const data = await res.json();

        if (!followedCount) followedCount = data.data.user.edge_follow.count;

        const edges = data.data.user.edge_follow.edges;
        progress += edges.length;

        edges.forEach((edge) => {
          if (!edge.node.follows_viewer) {
            filteredList.push(edge.node.username);
          }
        });

        sendProgress(progress, followedCount);

        nextPage = data.data.user.edge_follow.page_info.has_next_page;
        endCursor = data.data.user.edge_follow.page_info.end_cursor;

        await sleep(Math.floor(400 * Math.random()) + 1000);
      } catch (err) {
        console.error("Error fetching:", err);
        break;
      }
    }

    sendResults(filteredList);
  }

  startScript();
}

// Listen for messages in popup.js
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data.type === "FOLLOWBACK_PROGRESS") {
    const percent = event.data.percent;
    document.getElementById("progress-bar").style.width = percent + "%";
    document.getElementById("progress-text").innerText = percent + "%";
  }

  if (event.data.type === "FOLLOWBACK_DONE") {
    const list = document.getElementById("results");
    list.innerHTML = "";

    if (event.data.usernames.length === 0) {
      list.innerHTML = "<li>All your follows follow you back! 🎉</li>";
    } else {
      event.data.usernames.forEach((username) => {
        const li = document.createElement("li");
        li.textContent = username;
        list.appendChild(li);
      });
    }
  }
});
