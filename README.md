# Website Locker 🔐

A Chrome extension that **Lock access to websites you choose** until you enter the correct password. When someone tries to open a locked domain, they are redirected to a full-screen lock page instead of the site.

---

## What it does

You pick a domain (for example `twitter.com`) and set a password. After that, any normal browsing tab that tries to load that domain (or its subdomains) is sent to a lock screen. Entering the right password unlocks that visit briefly so you can use the site; wrong guesses are limited, and repeated failures trigger a dramatic “breach” state and data cleanup (see below).

Passwords are **never stored in plain text**—only a SHA-256 hash is saved in the browser.

---

## Features
- **Domain locks** — Add one or more domains from the extension popup; remove them when you no longer want a lock.
- **Subdomains included** — Locking `example.com` also applies to `www.example.com`, `app.example.com`, and similar hosts.
- **Lock screen** — A dedicated page asks for the password and shows which domain is locked; successful unlock sends you to the URL you were trying to open.
- **Temporary unlock** — After a correct password, that tab can reach the site for a short window without being sent back to the lock page immediately.
- **Wrong-password limit** — After three failed attempts, the extension treats it as a security event: site data for that origin is cleared (cookies, storage, cache, etc.), matching history entries are removed, and a **glitch-style “breach”** UI appears on the lock screen.
- **Incognito** — Locks apply to normal windows only; incognito tabs are not intercepted (by design).

---

## How to use

### Clone repository

```bash
git clone https://github.com/chiragjoshi12/website-locker-extension.git
cd website-locker-extension
```

### Install (Chrome / Chromium)
1. Open `chrome://extensions` (or your browser’s extensions page).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this project folder (the one containing `manifest.json`).

### Lock a site
1. Click the **Website Locker** icon in the toolbar to open the popup.
2. Enter a **domain** (e.g. `youtube.com` or `https://youtube.com`—the extension normalizes it).
3. Enter a **password** (at least 4 characters).
4. Click **Add Lock**.

### Unlock while browsing

When you navigate to a locked domain, you’ll see the lock page. Enter your password. If it’s correct, you’re redirected to the page you wanted. If it’s wrong, you’ll see feedback; after three wrong tries, the breach behavior and cleanup run as described above.

### Stop locking a domain

Open the popup, find the domain in **Locked Domains**, and click **Remove**.

---

## Permissions (why they’re needed)

| Permission        | Purpose |
|------------------|---------|
| `storage`        | Save locked domains and password hashes locally. |
| `webNavigation`  | Redirect tabs to the lock page when they hit a locked URL. |
| `history`        | Remove history entries for the domain after repeated failed unlocks. |
| `browsingData`   | Clear site data for that origin after repeated failed unlocks. |
| `<all_urls>`     | Match navigation to locked sites across the web. |

---

## Disclaimer

This project was **fully vibe-coded**—built quickly with AI assistance and iteration rather than a formal security audit. It may contain bugs, rough edges, or unexpected behavior in edge cases. **Do not rely on it as your only line of defense for high-risk scenarios**; treat it as a helpful friction layer for focus or casual blocking, not a certified security product.

If something feels off, file an issue or patch it; assume there could be a glitch somewhere.
