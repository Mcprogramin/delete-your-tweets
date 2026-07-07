// background.js - Headless architecture

let stopRequested = false;
const apiDetails = {};
const apiIds = {};

// Helper to log back to the popup
function logToPopup(msg) {
  console.log(msg);
  chrome.runtime.sendMessage({ type: "EXT_B_LOG", text: msg }).catch(() => {});
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract cookies
async function getCookie(name) {
  const cookie = await chrome.cookies.get({ url: "https://x.com", name });
  return cookie ? cookie.value : null;
}

// Standard Headers
function getHeaders(csrf, authToken) {
  return {
    "accept": "*/*",
    "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
    "content-type": "application/json",
    "x-csrf-token": csrf,
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": "en"
  };
}

// ── Headless Analyzer ──
async function analyzeHeadless(csrf) {
  logToPopup("Debug: Starting headless analysis...");
  
  // 1. Fetch main X HTML to get __INITIAL_STATE__ and JS bundle links
  // We must use credentials: "include" so it sends the cookies we just verified.
  // We don't use API headers here because this is a standard HTML page load.
  const resp = await fetch("https://x.com/home", { 
    credentials: "include",
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "upgrade-insecure-requests": "1"
    }
  });
  const html = await resp.text();
  
  // Extract __INITIAL_STATE__
  let initialState = {};
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
  if (stateMatch) {
    try {
      initialState = JSON.parse(stateMatch[1]);
      logToPopup("Debug: Parsed __INITIAL_STATE__ successfully.");
    } catch (e) {
      logToPopup("⚠ Failed to parse __INITIAL_STATE__");
    }
  } else {
    logToPopup("⚠ Couldn't find __INITIAL_STATE__ in HTML");
  }

  function getFeatureValue(featName) {
    if (initialState?.featureSwitch?.user?.config?.[featName] !== undefined) {
      return initialState.featureSwitch.user.config[featName].value;
    }
    if (initialState?.featureSwitch?.defaultConfig?.[featName] !== undefined) {
      return initialState.featureSwitch.defaultConfig[featName].value;
    }
    return false; // MUST default to false!
  }

  // 2. Extract Webpack JS URLs
  // Broadened regex to catch any responsive-web JS bundles
  const scriptRegex = /src="([^"]*abs\.twimg\.com\/responsive-web\/client-web(?:-[^/]+)?\/[^"]+\.js)"/g;
  let match;
  const scriptUrls = [];
  while ((match = scriptRegex.exec(html)) !== null) {
    scriptUrls.push(match[1]);
  }
  
  logToPopup(`Debug: Found ${scriptUrls.length} JS bundles. Scanning...`);

  // 3. Scan JS bundles for queryId, features, and fieldToggles
  for (const url of scriptUrls) {
    if (Object.keys(apiIds).length > 10) break; // We probably found enough
    
    try {
      const jsResp = await fetch(url);
      const src = await jsResp.text();
      
      const qMatch = src.match(/queryId:"([^"]+)"/);
      const oMatch = src.match(/operationName:"([^"]+)"/);
      
      if (qMatch && oMatch) {
        const qid = qMatch[1];
        const op = oMatch[1];
        
        let featsObj = {};
        const fMatch = src.match(/featureSwitches:\[([^\]]*)\]/);
        if (fMatch) {
          const featRegex = /"([^"]+)"/g;
          let featResult;
          while ((featResult = featRegex.exec(fMatch[1])) !== null) {
            featsObj[featResult[1]] = getFeatureValue(featResult[1]);
          }
        }
        
        let togglesObj = {};
        const tMatch = src.match(/fieldToggles:\[([^\]]*)\]/);
        if (tMatch) {
          const togRegex = /"([^"]+)"/g;
          let togResult;
          while ((togResult = togRegex.exec(tMatch[1])) !== null) {
            togglesObj[togResult[1]] = false; // Usually field toggles default to false unless explicitly on
          }
        }

        apiIds[op] = qid;
        apiDetails[op] = {
          features: JSON.stringify(featsObj),
          fieldToggles: JSON.stringify(togglesObj)
        };
      }
      
      // Secondary regex for minified chunks that combine them differently
      const reA = /queryId:"([^"]+)"[^{}]{0,300}operationName:"([^"]+)"/g;
      let mA;
      while ((mA = reA.exec(src)) !== null) {
        if (!apiIds[mA[2]]) apiIds[mA[2]] = mA[1];
      }
      const reB = /operationName:"([^"]+)"[^{}]{0,300}queryId:"([^"]+)"/g;
      let mB;
      while ((mB = reB.exec(src)) !== null) {
        if (!apiIds[mB[1]]) apiIds[mB[1]] = mB[2];
      }
    } catch (e) {
      // Ignore fetch errors
    }
  }
  
  logToPopup(`Debug: Discovered ${Object.keys(apiIds).length} operations via headless scan.`);
}

// ── Fetch Page ──
async function fetchPage(cursor, userId, endpoint, qid, csrf, retry = 0) {
  if (retry > 5) throw new Error("Max retries fetching " + endpoint);
  
  const details = apiDetails[endpoint] || {};
  
  let varsObj = {
    includePromotedContent: true,
    withCommunity: true,
    withVoice: true,
    withV2Timeline: true,
    withClientEventToken: false,
    withBirdwatchNotes: false,
    withDownvotePerspective: false,
    withQuickPromoteEligibilityTweetFields: false,
    withReactiveUserScoreState: false,
    withSuperFollowsUserFields: false,
    userId: userId,
    count: 20
  };
  if (cursor) varsObj.cursor = cursor;
  
  const varsStr = encodeURIComponent(JSON.stringify(varsObj));
  const featsStr = encodeURIComponent(details.features || "{}");
  
  let url = `https://x.com/i/api/graphql/${qid}/${endpoint}?variables=${varsStr}&features=${featsStr}`;
  if (details.fieldToggles && details.fieldToggles !== "{}") {
    url += `&fieldToggles=${encodeURIComponent(details.fieldToggles)}`;
  }
  
  const resp = await fetch(url, { headers: getHeaders(csrf), credentials: "include" });

  if (!resp.ok) {
    if (resp.status === 429) { 
      logToPopup(`⚠ 429 Rate Limit for ${endpoint}, waiting 60s...`);
      await sleep(60000); 
      return fetchPage(cursor, userId, endpoint, qid, csrf, retry + 1); 
    }
    const waitMs = 10000 * (1 + retry);
    logToPopup(`⚠ HTTP ${resp.status} for ${endpoint}, retrying in ${waitMs/1000}s... (Attempt ${retry+1}/6)`);
    await sleep(waitMs);
    return fetchPage(cursor, userId, endpoint, qid, csrf, retry + 1);
  }

  return resp.json();
}

// ── Delete/Unlike ──
async function deleteOrUnlike(tweetId, opName, qid, csrf) {
  let varsObj = { tweet_id: tweetId, dark_request: false };
  
  const details = apiDetails[opName] || {};
  let payload = {
    variables: varsObj,
    queryId: qid
  };
  // Mutations usually don't need features/fieldToggles, but if we parsed them, send them.
  
  const url = `https://x.com/i/api/graphql/${qid}/${opName}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: getHeaders(csrf),
    credentials: "include",
    body: JSON.stringify(payload)
  });
  return resp.ok;
}

// ── Main Loop ──
async function runLoop(settings, csrf, userId) {
  const phases = [{ label: "Tweets & Replies", fetchOp: "UserTweetsAndReplies", deleteOp: "DeleteTweet", deleteLabel: "Deleted", isLikes: false }];
  if (settings.removeLikes) phases.push({ label: "Likes", fetchOp: "Likes", deleteOp: "UnfavoriteTweet", deleteLabel: "Unliked", isLikes: true });

  const neededOps = [...new Set(phases.flatMap(p => [p.fetchOp, p.deleteOp]))];
  
  const missing = neededOps.filter(op => !apiIds[op]);
  if (missing.length > 0) {
    logToPopup(`⚠ Still missing IDs for: ${missing.join(", ")}. Will likely fail.`);
  }

  for (const phase of phases) {
    if (stopRequested) break;
    logToPopup(`Debug: Starting phase ${phase.label}`);
    
    const fetchQid = apiIds[phase.fetchOp];
    const deleteQid = apiIds[phase.deleteOp];
    
    if (!fetchQid || !deleteQid) {
      logToPopup(`⚠ Skipping ${phase.label} because missing IDs.`);
      continue;
    }

    let cursor = undefined;
    let keepGoing = true;

    while (keepGoing && !stopRequested) {
      try {
        const data = await fetchPage(cursor, userId, phase.fetchOp, fetchQid, csrf);
        
        let instructions = data?.data?.user?.result?.timeline_v2?.timeline?.instructions || data?.data?.user?.result?.timeline?.instructions || [];
        let entries = [];
        for (const inst of instructions) {
          if (inst.type === "TimelineAddEntries") entries = entries.concat(inst.entries || []);
          if (inst.type === "TimelinePinEntry") entries.push(inst.entry);
        }
        
        if (entries.length === 0) {
          logToPopup(`Debug: ${phase.fetchOp} returned 0 entries. Finished.`);
          break;
        }

        const toDelete = [];
        let newCursor = null;

        for (const entry of entries) {
          if (entry.entryId.startsWith("cursor-bottom")) {
            newCursor = entry.content?.value || entry.content?.itemContent?.value;
            continue;
          }
          
          if (!entry.entryId.startsWith("tweet-")) continue;
          
          const item = entry.content?.itemContent || entry.item;
          const tweet = item?.tweet_results?.result;
          if (!tweet) continue;

          // Standard filter logic
          const authorId = tweet.core?.user_results?.result?.rest_id || tweet.legacy?.user_id_str;
          const isOwner = authorId === userId;
          
          let matches = false;
          if (phase.isLikes) {
            matches = tweet.legacy?.favorited;
          } else {
            matches = isOwner;
          }

          if (matches) {
            toDelete.push(tweet.rest_id || tweet.legacy?.id_str);
          }
        }

        if (toDelete.length > 0) {
          let delCount = 0;
          for (const tid of toDelete) {
            if (stopRequested) break;
            
            const success = await deleteOrUnlike(tid, phase.deleteOp, deleteQid, csrf);
            if (success) {
              delCount++;
              logToPopup(`[${phase.deleteLabel}] ${tid}`);
            }
            await sleep(500);
          }
        }
        
        if (newCursor && newCursor !== cursor) {
          cursor = newCursor;
        } else {
          keepGoing = false; // No more cursor
        }
        
        await sleep(2000);
      } catch (err) {
        logToPopup("Error in loop: " + err.message);
        break;
      }
    }
  }
  
  if (!stopRequested) {
    chrome.runtime.sendMessage({ type: "EXT_B_DONE" }).catch(() => {});
  }
}

// ── Official API Logic Removed ──

// ── Listeners ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type && msg.type.startsWith('EXT_A_')) {
    // Extension A doesn't send messages in the current implementation
  } else if (msg.type && msg.type.startsWith('EXT_B_')) {
    if (msg.type === "EXT_B_START_DELETE") {
      stopRequested = false;
      (async () => {
        const csrf = await getCookie("ct0");
        const twid = await getCookie("twid");
        
        if (!csrf || !twid) {
          logToPopup("Error: Could not find Twitter cookies. Are you logged in?");
          return;
        }
        
        const userIdMatch = decodeURIComponent(twid).match(/\d+/);
        const userId = userIdMatch ? userIdMatch[0] : "";
        
        await analyzeHeadless(csrf);
        await runLoop(msg.settings, csrf, userId);
      })();
    } else if (msg.type === "EXT_B_STOP_DELETE") {
      stopRequested = true;
      logToPopup("Stop requested.");
    }
  }
});
