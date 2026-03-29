const params = new URLSearchParams(window.location.search);
const domain = (params.get("domain") || "").toLowerCase();
const redirect = params.get("redirect") || "";

const domainNameEl = document.getElementById("domainName");
const passwordEl = document.getElementById("password");
const unlockBtn = document.getElementById("unlockBtn");
const remainingEl = document.getElementById("remaining");
const warningEl = document.getElementById("warning");
const noticeEl = document.getElementById("notice");

function showNotice(msg, isError = false) {
  noticeEl.textContent = msg;
  noticeEl.classList.remove("hidden");
  noticeEl.classList.toggle("error", isError);
}

function hideNotice() {
  noticeEl.textContent = "";
  noticeEl.classList.add("hidden");
  noticeEl.classList.remove("error");
}

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

function isStrictMatch(host, lockedDomain) {
  if (!host || !lockedDomain) return false;
  if (host === lockedDomain) return true;
  return host.endsWith(`.${lockedDomain}`);
}

function safeRedirectUrl() {
  try {
    const u = new URL(redirect);
    const host = u.hostname.toLowerCase();
    if (isStrictMatch(host, domain)) return u.toString();
  } catch {
    // ignore
  }
  return `https://${domain}`;
}

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function blockBackNavigation() {
  history.pushState(null, "", window.location.href);
  window.addEventListener("popstate", () => {
    history.pushState(null, "", window.location.href);
  });
}

function triggerBreachAnimation() {
  document.body.classList.remove("breach");
  void document.body.offsetWidth;
  document.body.classList.add("breach");
}

const GLITCH_LINES = [
  "INTRUSION DETECTED",
  "ACCESS VIOLATION",
  "SECURITY BREACH",
  "KERNEL PANIC",
  "DATA PURGE INIT",
  "OVERRIDE FAILED",
  "TRACE ACTIVE",
  "SIGNAL LOST",
  "SYSTEM LOCKDOWN",
  "UNAUTHORIZED",
  "セキュリティ侵害",
  "アクセス拒否",
  "侵入検知",
  "安全違反",
  "ERREUR SYSTEME",
  "ACCES REFUSE",
  "ALERTE CRITIQUE",
  "ERRORE DI SISTEMA",
  "ACCESSO NEGATO",
  "ALLARME",
  "SISTEMA BLOCCATO",
  "ZUGRIFF VERWEIGERT",
  "SICHERHEITSALARM",
  "SYSTEMFEHLER",
  "НЕСАНКЦИОНИРОВАНО",
  "ОШИБКА СИСТЕМЫ",
  "ДОСТУП ЗАПРЕЩЕН",
  "INTRUSION DETECTEE",
  "ACCES INTERDIT",
  "إنتهاك أمني",
  "رفض الوصول",
  "خطأ بالنظام",
  "ACCESO DENEGADO",
  "ALERTA CRITICA",
  "BLOQUEO ACTIVADO",
  "SISTEMA COMPROMETIDO",
  "잠금 실패",
  "접근 거부",
  "보안 경고",
  "ระบบถูกเจาะ",
  "การเข้าถูกปฏิเสธ",
  "FALHA DE SEGURANCA",
  "ACESSO NEGADO",
  "ERRO CRITICO",
  "TRAVA ATIVADA"
];

let glitchInterval = null;

function startGlitchRain() {
  const rain = document.getElementById("glitchRain");
  const wall = document.getElementById("glitchWall");
  if (!rain || !wall) return;

  const makeLine = () => {
    const line = document.createElement("div");
    const text = GLITCH_LINES[Math.floor(Math.random() * GLITCH_LINES.length)];
    line.textContent = text;
    line.className = "glitch-line";
    line.style.left = `${Math.random() * 100}%`;
    line.style.top = `${Math.random() * 100}%`;
    line.style.opacity = `${0.3 + Math.random() * 0.7}`;
    line.style.transform = `translateX(${Math.random() * 40 - 20}px) skewX(${Math.random() * 12 - 6}deg)`;
    return line;
  };

  const fillWall = () => {
    wall.innerHTML = "";
    for (let i = 0; i < 28; i += 1) {
      const line = document.createElement("div");
      line.textContent = GLITCH_LINES[Math.floor(Math.random() * GLITCH_LINES.length)];
      line.className = "glitch-wall-line";
      wall.appendChild(line);
    }
  };

  fillWall();
  rain.innerHTML = "";

  if (glitchInterval) clearInterval(glitchInterval);
  glitchInterval = setInterval(() => {
    if (!document.body.classList.contains("breach")) return;
    fillWall();
    for (let i = 0; i < 10; i += 1) {
      const line = makeLine();
      rain.appendChild(line);
      setTimeout(() => line.remove(), 400);
    }
  }, 120);
}

async function refreshAttempts() {
  const res = await chrome.runtime.sendMessage({ type: "getAttempts", domain });
  const attempts = res?.attempts || 0;
  const remaining = Math.max(0, 3 - attempts);
  remainingEl.textContent = String(remaining);
  if (attempts >= 2) {
    warningEl.classList.remove("hidden");
  } else {
    warningEl.classList.add("hidden");
  }
}

async function ensureLocked() {
  if (!domain) {
    showNotice("Missing domain information.", true);
    unlockBtn.disabled = true;
    passwordEl.disabled = true;
    return false;
  }

  const res = await chrome.runtime.sendMessage({ type: "getLockedDomains" });
  const map = res?.data || {};
  if (!map[normalizeDomain(domain)]) {
    showNotice("This domain is not currently locked.", true);
    unlockBtn.disabled = true;
    passwordEl.disabled = true;
    return false;
  }
  return true;
}

unlockBtn.addEventListener("click", async () => {
  hideNotice();
  const password = passwordEl.value || "";
  if (!password) {
    showNotice("Enter your password.", true);
    return;
  }

  const hash = await sha256(password);
  const res = await chrome.runtime.sendMessage({ type: "checkPassword", domain, hash });
  if (!res?.ok) {
    showNotice(res?.error || "Unable to verify password.", true);
    return;
  }

  if (res.match) {
    await chrome.runtime.sendMessage({ type: "unlockOnce", domain });
    window.location.replace(safeRedirectUrl());
    return;
  }

  if (res.attempts >= 3) {
    triggerBreachAnimation();
    showNotice("Too many failed attempts. Site data and history were cleared.", true);
    passwordEl.value = "";
    refreshAttempts();
    return;
  }

  showNotice("Incorrect password.", true);
  passwordEl.value = "";
  await refreshAttempts();
});

document.addEventListener("DOMContentLoaded", async () => {
  domainNameEl.textContent = domain || "unknown";
  blockBackNavigation();
  startGlitchRain();
  const ok = await ensureLocked();
  if (ok) {
    await refreshAttempts();
  }
});
