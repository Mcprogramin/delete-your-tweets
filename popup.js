// merged_ext/popup.js

// ──────────────────────────────────────────────
// EXTENSION A LOGIC
// ──────────────────────────────────────────────
// ── Extension A Logic (Basic DOM Injection) ─────────────
document.getElementById("extA-start-delete").addEventListener("click", () => {
  const action = document.getElementById("extA-action").value;
  const scriptFile = action === "retweets" ? "content_retweets.js" : "content_tweets.js";
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: [scriptFile]
    });
  });
});

document.getElementById("extA-stop-delete").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        window.tweetRemoverRunning = false;
        if (typeof window.stopUnretweet === "function") window.stopUnretweet();
      }
    });
  });
});

// ──────────────────────────────────────────────
// EXTENSION B LOGIC
// ──────────────────────────────────────────────
// ── Extension B Logic (Headless / Settings) ─────────────
const FIELDS = [
  "extB_includeReplies",
  "extB_removeLikes",
  "extB_urlOnly",
  "extB_keepPinned",
  "extB_keywords",
  "extB_ignoreIds",
  "extB_onlyIds",
  "extB_afterDate",
  "extB_beforeDate",
];

const DEFAULTS = {
  extB_includeReplies: false,
  extB_removeLikes: false,
  extB_urlOnly: false,
  extB_keepPinned: true,
  extB_keywords: "",
  extB_ignoreIds: "",
  extB_onlyIds: "",
  extB_afterDate: "",
  extB_beforeDate: "",
};

const statusEl = document.getElementById("extB-status");

function log(msg) {
  statusEl.textContent += msg + "\n";
  statusEl.scrollTop = statusEl.scrollHeight; // Auto-scroll to bottom
}

function get(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  return el.type === "checkbox" ? el.checked : el.value;
}

function set(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === "checkbox") el.checked = !!val;
  else el.value = val ?? "";
}

// ── Load / save ─────────────────────────────────────────
async function load() {
  const data = await chrome.storage.local.get(DEFAULTS);
  FIELDS.forEach((f) => set(f, data[f]));
}

async function save() {
  const data = {};
  FIELDS.forEach((f) => (data[f] = get(f)));
  await chrome.storage.local.set(data);
  
  // Transform keys back to original expected by background script
  const bgSettings = {};
  for (const f of FIELDS) {
    const originalKey = f.replace("extB_", "");
    bgSettings[originalKey] = data[f];
  }
  return bgSettings;
}

// Auto‑save on every change
FIELDS.forEach((f) => {
  const el = document.getElementById(f);
  if (el) el.addEventListener("change", save);
});

// ── Start ───────────────────────────────────────────────
document.getElementById("extB-startBtn").addEventListener("click", async () => {
  try {
    const settings = await save();
    chrome.runtime.sendMessage({
      type: "EXT_B_START_DELETE",
      settings,
    });
    statusEl.textContent = "Started Web Scraper! Check logs.";
  } catch (err) {
    log("Error: " + err.message);
  }
});



// ── Stop ────────────────────────────────────────────────
document.getElementById("extB-stopBtn").addEventListener("click", async () => {
  try {
    chrome.runtime.sendMessage({ type: "EXT_B_STOP_DELETE" });
    log("Stop requested.");
  } catch (err) {
    log("Error: " + err.message);
  }
});

// ── Receive logs from background script ────────────────────
let tweetsDeleted = 0;
let likesRemoved = 0;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "EXT_B_LOG") {
    log(msg.text);
    if (msg.text.includes("[Deleted]")) {
      tweetsDeleted++;
      document.getElementById("stat-tweets").textContent = tweetsDeleted;
    } else if (msg.text.includes("[Unliked]")) {
      likesRemoved++;
      document.getElementById("stat-likes").textContent = likesRemoved;
    }
  }
  else if (msg.type === "EXT_B_DONE") log("✅ Finished.");
});

load();
