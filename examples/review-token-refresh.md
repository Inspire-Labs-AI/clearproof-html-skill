---
title: Review — refresh sessions inside a grace window
tldr: The refresh never reaches the client, so users still get logged out; plus an unbounded retry loop. Do not merge yet.
verdict: changes
branch: feature/token-refresh
---
The branch lets a session that expired less than 30 seconds ago renew itself instead of failing. It also adds `POST /logout`.

## What the change is for {say="Before reading any code: what is this change supposed to do?"}
- **Goal:** a token that just expired should not log the user out mid-request.
- **Approach:** `getSession` now checks expiry. Inside a 30-second grace window it calls a new `refreshSession`. After the window it deletes the session.
- **Side change:** a logout route and the `deleteSession` store method that both features need.

## Shape of the change {say="Four files. The request enters the server, asks the session module, which now calls the new refresh module. Both write to the store."}
```changemap
server.js -> session.js: getSession()
session.js -> refresh.js: refreshSession()
session.js -> store.js: deleteSession()
refresh.js -> store.js: putSession()
server.js -> store.js: deleteSession()
```

## How a request flows now {span=full}
```flow
(Request with token) -> {Session found?}
{Session found?} -> (401): no
{Session found?} -> {Expired?}: yes
{Expired?} -> *Return session: no
{Expired?} -> {Inside 30 s grace?}: yes
{Inside 30 s grace?} -> [Delete session]: no | Past the grace window, the server deletes the session.
[Delete session] -> (401)
{Inside 30 s grace?} -> *refreshSession: yes | Inside the window, refresh writes a new session...
*refreshSession --> [(Store: new random token)]: putSession | ...under a new random token that nobody ever learns.
```

## 1 · Expiry check in getSession
The order of the checks is right: hard expiry first, then the grace refresh. One detail: only the hard-expiry path deletes the old session; a refresh never does.

```diff H2
+11: Hard expiry. Past the grace window the code deletes the session and the user must log in again.
+15: Inside the grace window. The refreshed session replaces `session` for this request only.
```

## 2 · The refresh itself — the main problem {span=full}
```diff H1
+12: The code stores the new session under `randomUUID()` and never returns that token. The client keeps sending the old token.
+10-17: If `putSession` keeps failing, this loop never ends and the request hangs. There is no attempt limit.
```

```callout risk Why users are still logged out
The client never learns the new token. Each request in the grace window creates another orphan session. After 30 seconds the old token hits the hard-expiry path and logs the user out — the exact case this change set out to fix.
```

Fix: return the new token and send it back (for example in a `Set-Authorization` header), delete the old session, and cap the retries.

## 3 · Logout and the store
Logout reuses `getSession`, so logging out in the grace window first creates a refreshed session that is never deleted. [[H4]] adds the `deleteSession` method; it is a plain `Map.delete` and needs no review.

```diff H3
+14: Deletes only the token the client sent. Sessions created by refresh stay in the store.
```

## Risks
```risks
high | src/auth/refresh.js:12 | Refreshed token never reaches the client; users are still logged out after 30 s
med | src/auth/refresh.js:10-17 | Unbounded retry loop can hang a request forever
low | src/server.js:14 | Logout leaves rotated sessions behind
low | src/auth/session.js:15-17 | Old session is not deleted after a refresh, so the store grows
```

## Before you approve {span=full}
```checklist
- [ ] The new token reaches the client (response header or body) [[src/auth/refresh.js:7-20]]
- [ ] The old session is deleted after rotation
- [ ] The retry loop has a limit and surfaces the error
- [ ] A test covers: token expires, request inside 30 s, next request uses the new token
```

```quiz
? A token expired 10 seconds ago. The client sends it twice, one second apart. How many sessions exist afterwards?
- [ ] One — the refreshed session
- [x] Three — the old one plus two orphans
- [ ] Zero — the old one is deleted
> Each request refreshes again, because the client still holds the old token, and nothing deletes the old session.
```
