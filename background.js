const STORAGE_KEY = "lockedDomains";
const unlockedTabs = new Map();

function normalizeDomain(input) {
  const trimmed = (input || "").trim().toLowerCase();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^\.+|\.+$/g, "");
  } catch {
    return trimmed.replace(/^\.+|\.+$/g, "");
  }
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

async function getLockedDomains() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || {};
}

async function setLockedDomains(map) {
  await chrome.storage.local.set({ [STORAGE_KEY]: map });
}

function getDomainFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isStrictMatch(host, lockedDomain) {
  if (!host || !lockedDomain) return false;
  if (host === lockedDomain) return true;
  return host.endsWith(`.${lockedDomain}`);
}

async function shouldLockUrl(url) {
  if (!isHttpUrl(url)) return { locked: false };
  const host = getDomainFromUrl(url);
  if (!host) return { locked: false };

  const map = await getLockedDomains();
  for (const domain of Object.keys(map)) {
    if (isStrictMatch(host, domain)) {
      return { locked: true, domain };
    }
  }
  return { locked: false };
}

function isTabTemporarilyUnlocked(tabId, url) {
  const entry = unlockedTabs.get(tabId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    unlockedTabs.delete(tabId);
    return false;
  }
  const host = getDomainFromUrl(url);
  return isStrictMatch(host, entry.domain);
}

async function redirectToLock(tabId, domain, url) {
  const lockUrl = chrome.runtime.getURL(
    `lock.html?domain=${encodeURIComponent(domain)}&redirect=${encodeURIComponent(url)}`
  );
  await chrome.tabs.update(tabId, { url: lockUrl });
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const { tabId, url } = details;
  if (isTabTemporarilyUnlocked(tabId, url)) return;
  const res = await shouldLockUrl(url);
  if (!res.locked) return;

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  if (tab.incognito) return; // only normal mode
  if (url.startsWith(chrome.runtime.getURL("lock.html"))) return;

  await redirectToLock(tabId, res.domain, url);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  unlockedTabs.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "getLockedDomains") {
      const map = await getLockedDomains();
      sendResponse({ ok: true, data: map });
      return;
    }

    if (message?.type === "addDomain") {
      const domain = normalizeDomain(message.domain);
      const hash = message.hash;
      if (!domain || !hash) {
        sendResponse({ ok: false, error: "Invalid domain or hash." });
        return;
      }
      const map = await getLockedDomains();
      map[domain] = { hash, failedAttempts: 0 };
      await setLockedDomains(map);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "removeDomain") {
      const domain = normalizeDomain(message.domain);
      const map = await getLockedDomains();
      delete map[domain];
      await setLockedDomains(map);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "checkPassword") {
      const domain = normalizeDomain(message.domain);
      const hash = message.hash;
      const map = await getLockedDomains();
      const entry = map[domain];
      if (!entry) {
        sendResponse({ ok: false, error: "Domain not locked." });
        return;
      }
      if (hash === entry.hash) {
        entry.failedAttempts = 0;
        map[domain] = entry;
        await setLockedDomains(map);
        sendResponse({ ok: true, match: true });
        return;
      }

      entry.failedAttempts = (entry.failedAttempts || 0) + 1;
      const attempts = entry.failedAttempts;
      map[domain] = entry;
      await setLockedDomains(map);

      if (attempts >= 3) {
        sendResponse({ ok: true, match: false, attempts });
        (async () => {
          await clearOriginData(domain);
          await deleteHistory(domain);
          const m = await getLockedDomains();
          const e = m[domain];
          if (e) {
            e.failedAttempts = 0;
            m[domain] = e;
            await setLockedDomains(m);
          }
        })();
        return;
      }

      sendResponse({ ok: true, match: false, attempts });
      return;
    }

    if (message?.type === "getAttempts") {
      const domain = normalizeDomain(message.domain);
      const map = await getLockedDomains();
      const entry = map[domain];
      const attempts = entry?.failedAttempts || 0;
      sendResponse({ ok: true, attempts });
      return;
    }

    if (message?.type === "unlockOnce") {
      const domain = normalizeDomain(message.domain);
      const tabId = sender?.tab?.id;
      if (!domain || typeof tabId !== "number") {
        sendResponse({ ok: false, error: "Missing domain or tab." });
        return;
      }
      unlockedTabs.set(tabId, { domain, expiresAt: Date.now() + 30 * 1000 });
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message." });
  })();

  return true;
});

async function clearOriginData(domain) {
  const origins = [`https://${domain}`, `http://${domain}`];
  await chrome.browsingData.remove({ originTypes: { unprotectedWeb: true }, origins }, {
    cache: true,
    cookies: true,
    localStorage: true,
    indexedDB: true,
    serviceWorkers: true,
    fileSystems: true,
    webSQL: true
  });
}

async function deleteHistory(domain) {
  const now = Date.now();
  const results = await chrome.history.search({ text: domain, startTime: 0, endTime: now, maxResults: 10000 });
  const deletes = results.map((item) => chrome.history.deleteUrl({ url: item.url }));
  await Promise.allSettled(deletes);
}
