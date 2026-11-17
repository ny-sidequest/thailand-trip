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

## Phase 6: Social  (migration 0008)
1. Feed tab: member posts text; admin sees it live. Member posts a photo (caption optional); it appears with the image.
2. React with 👍 🔥 etc. on the post from both accounts; counts update live; tapping again removes your reaction.
3. Comment on a post from the second account; the post's author gets a notification ("commented on a post").
4. A comment on an itinerary activity also shows in the feed; reactions work on the activity page too.
5. Admin deletes a post; member can delete only their own.
6. Polls: admin creates a single-choice poll (3 options) and a multiple-choice poll with a closing time.
7. Member votes, changes their vote (single choice keeps exactly one), clears a vote; results and voter avatars update live.
8. Member cannot create/close polls (no buttons). Admin closes a poll: voting stops, winner marked.
9. Announcements: admin posts an "Important" one; member is notified and sees an unread dot + tab badge.
10. Member taps Mark as read; dot clears; admin sees "Read by N of 5" and who is still pending.
11. Home dashboard shows the latest announcements with unread state; "Mark as read" works there too.
12. Admin pins an announcement: it moves to the top; admin can edit and delete it.

## Later phases
Phase 7 (admin) and Phase 8 (security/PWA/offline) checks are appended as those phases are built.
