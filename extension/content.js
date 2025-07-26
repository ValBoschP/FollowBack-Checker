function getCookie(b) {
  let c = `; ${document.cookie}`;
  let a = c.split(`; ${b}=`);
  if (a.length === 2) return a.pop().split(";").shift();
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function afterUrlGenerator(cursor, userId) {
  return `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${userId}","include_reel":"true","fetch_mutual":"false","first":"24","after":"${cursor}"}`;
}

(async function startScript() {
  const csrftoken = getCookie("csrftoken");
  const ds_user_id = getCookie("ds_user_id");
  const headers = {
    "Content-Type": "application/json",
    "X-CSRFToken": csrftoken,
  };

  let initialURL = `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${ds_user_id}","include_reel":"true","fetch_mutual":"false","first":"24"}`;
  let doNext = true;
  let filteredList = [];
  let fetchedCount = 0;
  let totalFollowed = null;
  let scrollCycle = 0;

  while (doNext) {
    let json;
    try {
      const res = await fetch(initialURL, { headers });
      json = await res.json();
    } catch (err) {
      continue;
    }

    if (!totalFollowed) {
      totalFollowed = json.data.user.edge_follow.count;
    }

    const pageInfo = json.data.user.edge_follow.page_info;
    doNext = pageInfo.has_next_page;
    initialURL = afterUrlGenerator(pageInfo.end_cursor, ds_user_id);
    const edges = json.data.user.edge_follow.edges;

    fetchedCount += edges.length;

    edges.forEach(({ node }) => {
      if (!node.follows_viewer) {
        filteredList.push(node.username);
      }
    });

    chrome.runtime.sendMessage({
      type: "progress",
      done: fetchedCount,
      total: totalFollowed,
      percent: Math.floor((fetchedCount / totalFollowed) * 100),
    });

    await sleep(Math.floor(400 * Math.random()) + 1000);

    scrollCycle++;
    if (scrollCycle > 6) {
      scrollCycle = 0;
      await sleep(10000); // para evitar bloqueo temporal
    }
  }

  chrome.runtime.sendMessage({
    type: "result",
    users: filteredList,
  });
})();
