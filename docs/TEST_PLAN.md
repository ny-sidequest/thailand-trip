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

## Phase 7: Admin  (migration 0009; edge function admin-users must be deployed)
1. Admin sees **Admin** in the menu; the member does not, and typing /admin as the member bounces to Home.
2. Admin → Trip settings: change the tagline and the default rate; Home hero and the Add-expense default rate follow.
3. Admin → People → Add traveller (test username). A one-time password appears. Sign in as that user in a third window.
4. Reset that user's password: the old one stops working, the new one works. Make them admin, then member again. Remove them: they lose access at once.
5. Admin cannot demote or remove themselves (error shown).
6. People shows each member's checklist %; expand a member to see which items they have/have not ticked.
7. Itinerary → Add day; open it; Add an activity (title, type, time, map link); it appears on the member's Itinerary live.
8. Move activities up/down: the order changes for the member live. Edit a time: member is notified.
9. Delete the test day: it disappears with its activities.
10. Bookings → Stays / Transport / Activities: add, edit status (member gets a feed entry + notification), delete.
11. Link an activity booking to an itinerary activity: it shows on that activity's page.
12. Checklist → add an item with a deadline in a new category; the member sees it unticked with a due badge; remove it.
13. Needs attention on the Admin home lists pending/needs-verification items and links to them.
14. As the member, try the admin pages' actions via the app: no buttons; direct database writes are refused (covered by DB tests).

## Phase 8: Hardening, offline, PWA  (migration 0010; redeploy admin-users)
1. Record a payment from Suggested settlements (Phase 5 step 10) still works; removing it works; replaying it never double-records.
2. Add a THB expense with an absurd rate (e.g. 100): refused with a clear message showing the allowed range.
3. Upload a document, switch it to "Only me": the other member can no longer open it. Upload a receipt and open it as the other member.
4. Tick and untick a checklist item as one member: the other member's group-progress bars update live (no item details shown).
5. Offline: open the Itinerary once online, then switch the phone to airplane mode and reopen the installed app: the itinerary and any
   activity open from the saved copy with an offline banner; other sections say they need a connection.
6. Sign out, then go offline: the saved itinerary copy is gone (cleared on sign-out).
7. Install to the home screen (iOS: Share → Add to Home Screen; Android: Install app); it opens full-screen with the icon.
8. Auth → Providers → Email: "Secure password change" is ON; run `node scripts/rotate-emails.mjs`; everyone can still sign in with their username.
9. Mobile: Home, Itinerary, Expenses, Feed fit the screen without zooming or sideways scrolling.
