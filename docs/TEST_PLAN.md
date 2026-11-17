# Manual test plan (live environment)

Use two windows: **admin** in a normal window, a **member** in a private window. App: local dev server
(http://localhost:5173/) or the GitHub Pages site once deployed.
Before testing, confirm every migration up to the latest one has been applied (see PROJECT_STATUS.md).

## Phase 4: Travel Wallet  (migration 0006)
1. Admin: Wallet → Upload. Upload a PDF as "Whole group".
2. Open it: preview loads; **Open** and **Download** both work (signed links).
3. Upload an image: previews inline.
4. Upload a file as **Only me** ("Private test").
5. Member: sees the group PDF and the image, but NOT "Private test".
6. Member: uploads their own "Only me" file; admin cannot see it (even as admin).
7. Member opens the admin's group PDF: no Edit / Delete buttons.
8. Admin: open the group PDF → **New version**, upload another file; list shows v2, version history lists both.
9. Stays and Transport tabs show seeded bookings with status badges and Open in Maps.
10. Admin: Edit Pak-Up Hostel, add a test confirmation; member sees it live. Revert afterwards.
11. On a stay/transport card tap Add document: upload is pre-linked and appears on that card.
12. Admin uploads a group document: member gets a notification + feed entry. An "Only me" upload creates neither.
13. Admin edits an activity's time or meeting point (not status): member gets "... was updated".

## Phase 5: Expenses  (migration 0007)
1. Admin: Expenses → Add. THB dinner 1,200, paid by admin, split equally across everyone. Rate shows; INR amount live.
2. Member gets a notification with their share; the expense appears for them without refresh.
3. Member: add an INR expense of 500, paid by the member, split between member and admin only.
4. Overview: balance, per-person table and suggested settlements add up (hand-check one).
5. Uneven split by Amounts that does not total: form refuses and shows the difference.
6. Percent split e.g. 50/30/20 works and shows exact shares.
7. Member adds a **Personal** expense: admin cannot see it anywhere; balances unchanged.
8. Attach a receipt photo; open it from the expense detail.
9. Admin opens the member's expense → Correct → change amount; audit trail shows old and new.
10. Tap **Record** on a suggested settlement; balances update live for both. Re-submitting rapidly does not double-record.
11. Undo (remove) a recorded payment; balances revert.
12. Deleting an expense removes it from balances and keeps it in the audit trail.

## Later phases
Phase 6 (social), Phase 7 (admin), Phase 8 (security/PWA/offline) checks are appended as those phases are built.
