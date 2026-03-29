const domainInput = document.getElementById("domainInput");
const passwordInput = document.getElementById("passwordInput");
const addBtn = document.getElementById("addBtn");
const statusEl = document.getElementById("status");
const domainList = document.getElementById("domainList");
const emptyState = document.getElementById("emptyState");

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

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

async function loadDomains() {
  const res = await chrome.runtime.sendMessage({ type: "getLockedDomains" });
  domainList.innerHTML = "";
  const map = res?.data || {};
  const domains = Object.keys(map).sort();
  emptyState.style.display = domains.length ? "none" : "block";

  for (const domain of domains) {
    const li = document.createElement("li");
    li.className = "list-item";

    const label = document.createElement("span");
    label.textContent = domain;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.className = "ghost";
    removeBtn.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "removeDomain", domain });
      await loadDomains();
    });

    li.append(label, removeBtn);
    domainList.appendChild(li);
  }
}

addBtn.addEventListener("click", async () => {
  const domain = normalizeDomain(domainInput.value);
  const password = passwordInput.value || "";

  if (!domain) {
    setStatus("Enter a valid domain.", true);
    return;
  }
  if (password.length < 4) {
    setStatus("Password must be at least 4 characters.", true);
    return;
  }

  const hash = await sha256(password);
  const res = await chrome.runtime.sendMessage({ type: "addDomain", domain, hash });
  if (!res?.ok) {
    setStatus(res?.error || "Failed to add domain.", true);
    return;
  }

  domainInput.value = "";
  passwordInput.value = "";
  setStatus("Domain locked.");
  await loadDomains();
});

document.addEventListener("DOMContentLoaded", loadDomains);
