(async () => {
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function afterUrlGenerator(cursor, userId) {
    return `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${userId}","include_reel":"true","fetch_mutual":"false","first":"24","after":"${cursor}"}`;
  }

  const csrftoken = getCookie("csrftoken");
  const ds_user_id = getCookie("ds_user_id");

  if (!csrftoken || !ds_user_id) {
    alert("Error: Please log into Instagram first.");
    return;
  }

  const headers = {
    "x-csrftoken": csrftoken,
    "x-requested-with": "XMLHttpRequest"
  };

  let initialURL = `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${ds_user_id}","include_reel":"true","fetch_mutual":"false","first":"24"}`;
  let doNext = true;
  let followedPeople = null;
  let filteredList = [];
  let counter = 0;
  let scrollCicle = 0;

  while (doNext) {
    let response;
    try {
      response = await fetch(initialURL, {
        headers,
        credentials: "include"
      }).then(res => res.json());
    } catch (e) {
      console.warn("Fetch error, retrying...");
      continue;
    }

    if (!followedPeople) {
      followedPeople = response.data.user.edge_follow.count;
    }

    doNext = response.data.user.edge_follow.page_info.has_next_page;
    initialURL = afterUrlGenerator(response.data.user.edge_follow.page_info.end_cursor, ds_user_id);
    counter += response.data.user.edge_follow.edges.length;

    response.data.user.edge_follow.edges.forEach(edge => {
      if (!edge.node.follows_viewer) {
        filteredList.push(edge.node);
      }
    });

    console.clear();
    console.log(`%c Progress: ${counter}/${followedPeople} (${parseInt((100 * counter) / followedPeople)}%)`, "background:#222;color:#0f0;font-size:16px;");
    console.log("%c Unfollowers so far:", "background:#222;color:#f44;font-size:14px;");
    filteredList.forEach(user => console.log(user.username));

    await sleep(Math.floor(Math.random() * 400) + 1000);
    scrollCicle++;

    if (scrollCicle > 6) {
      scrollCicle = 0;
      console.log("Sleeping for 10s to avoid rate limit...");
      await sleep(10000);
    }
  }

  const blob = new Blob([JSON.stringify(filteredList)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "usersNotFollowingBack.json";
  link.click();

  console.log("%c Done! JSON downloaded.", "background:#222;color:#0f0;font-size:16px;");
})();
