# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

TaskFlow Lite is a Trello-style Kanban board app built with **zero build tooling**: plain HTML/CSS/JS served via GitHub Pages, backed by Firebase (Auth + Firestore) and optional Cloud Functions for email notifications. There is no `npm`, no bundler, and no compilation step for the frontend.

## Running locally

Since there is no build step, serve the root directory with any static file server:

```bash
# Python (no install needed)
python3 -m http.server 8080

# Node (if npx available)
npx serve .
```

Open `http://localhost:8080`. Firebase credentials in `js/firebase-config.js` point to the live production project — local changes hit real data.

## Cloud Functions

The `functions/` directory is a separate Node.js 18 project. Development requires the Firebase CLI installed globally.

```bash
cd functions
npm install

# Run Functions emulator locally
npm run serve            # → firebase emulators:start --only functions

# Deploy to production
npm run deploy           # → firebase deploy --only functions

# Tail logs
npm run logs             # → firebase functions:log
```

The Cloud Functions require a `SENDGRID_API_KEY` environment variable and optionally `SENDGRID_FROM_EMAIL`.

## Architecture

### Two-page app

- **`index.html`** — authentication screen + board list. Loads: `firebase-config.js` → `auth.js` → `boards.js`
- **`board.html`** — single board view with lists, cards, drag-and-drop. Loads: `firebase-config.js` → `notifications.js` → `memberships.js` → `board.js`

`settings.js` exists but is not yet included in any HTML page.

### No module system — globals and IIFEs

There is no `import`/`export`. Every JS file runs in the global scope. Modules use the IIFE pattern and expose their public API on `window`:

- `window.currentUser` — set by `firebase-config.js` via `onAuthStateChanged`; checked by every other module before making Firestore calls
- `window.db` / `window.auth` — Firebase instances initialized in `firebase-config.js`
- `window.showToast(message, type)` / `window.showError(error)` — UI helpers from `firebase-config.js`
- `window.logActivity(type, target)` — exported by `NotificationsModule` for `board.js` to call after mutations
- `window.MembershipsModule` — `board.js` calls `.updateMembers()` when the members modal opens
- `window.onBoardLoaded(board, bId)` — callback registered by `MembershipsModule`; intended to be called after board data loads
- `window.onBoardActivityReady(bId)` — callback registered by `NotificationsModule`; intended to be called after board data loads
- `window.onUserReady()` — callback registered by `BoardModule`; intended to be called by the auth listener once the user is confirmed

**Initialization chain on `board.html`**: `firebase-config.js` calls `window.onUserReady()` once auth resolves → `BoardModule.init()` runs → after the first board `onSnapshot`, calls `window.onBoardLoaded(board, boardId)` (starts `MembershipsModule` listeners) and `window.onBoardActivityReady(boardId)` (starts `NotificationsModule` activity feed). These callbacks fire exactly once via the `moduleInitialized` flag.

### Script load order matters

Scripts within each HTML page must stay in their declared order — later scripts depend on globals set by earlier ones (e.g., `board.js` uses `window.logActivity` defined by `notifications.js`).

### Firebase SDK: always use the compat CDN

Both HTML files load Firebase via CDN using the **compat** (not modular) SDK — filenames must end in `-compat.js` (e.g. `firebase-app-compat.js`). The non-compat files (`firebase-app.js`) do not expose `window.firebase`, which breaks all Firebase calls silently.

### Card and list positioning

Position values use sparse integer spacing with 65536-unit gaps (`position = lastPosition + 65536`). This allows inserting items between existing ones without rewriting all sibling positions.

## Firestore data model

```
users/{userId}                        ← user profile (email, name)
  settings/notifications              ← email notification preferences
  boards/{boardId}                    ← board (title, background color)
    lists/{listId}                    ← list (title, position)
      cards/{cardId}                  ← card (title, position)
    members/{memberId}                ← board membership (role, status)
    activity/{activityId}             ← audit log of board actions

notifications/{userId}
  messages/{notificationId}           ← cross-user notifications (invites, activity)
```

Two separate top-level collections exist: `users/` (owns all board data) and `notifications/` (cross-user messaging). This means board data is siloed per owner — there is no shared-board document; membership is tracked inside the owner's board, not in a neutral location.

## Security rules

`FIRESTORE_RULES.txt` contains the production Firestore rules to be pasted into the Firebase Console. Key constraints to be aware of when writing client code:

- `users/{userId}/boards/{boardId}/activity/{activityId}` — **`allow write: if false`**. Only Cloud Functions can write activity. Client-side calls to this path will be rejected in production.
- `notifications/{userId}/messages/{notificationId}` — `allow create: if request.auth != null`. Any authenticated user can create notifications (needed for client-side invite flow). Cloud Functions also write here when deployed.

Activity writes (`users/{userId}/boards/{boardId}/activity`) are allowed by the board owner (client) and by Cloud Functions. To update rules: edit `FIRESTORE_RULES.txt`, then paste into Firebase Console → Firestore → Rules → Publish.

## Cloud Functions

`functions/notificationEmail.js` exports two Firestore-triggered functions:

- **`sendNotificationEmail`** — fires on `notifications/{userId}/messages/{messageId}` creation. Reads user settings, decides whether to email, and sends via SendGrid.
- **`validateUserSettings`** — fires on `users/{userId}/settings/notifications` writes. Removes unknown keys and logs validation errors.

Email templates (`buildInviteEmail`, `buildActivityEmail`) contain hardcoded `https://tu-dominio.com` placeholder URLs that must be updated before going to production.

## Deployment

Static site deploys automatically via GitHub push to `main` → GitHub Pages serves the root. No CI/CD pipeline exists.

For a full production deployment checklist see `DEPLOYMENT_GUIDE.md`. Firestore rules must be applied manually via the Firebase Console from `FIRESTORE_RULES.txt`.
