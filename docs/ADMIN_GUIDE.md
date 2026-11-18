# Admin guide

Admins see an **Admin** entry in the menu. The same permissions are enforced in the database, so the buttons are
convenience, not security.

## Day-to-day
| I want to… | Where |
|---|---|
| Mark a booking confirmed, add a reference | Admin → Bookings (or **Edit** on the activity / stay / transport card) |
| Change a time, meeting point or map link | Admin → Itinerary → pick the day → edit the activity. Everyone is notified of changes to status, time, location and meeting point |
| Add / remove / reorder activities | Admin → Itinerary → day → **Add**, bin icon, arrows |
| Add a day | Admin → Itinerary → **Add day** (date pre-filled with the day after the last one) |
| Post an announcement | Feed → Announcements → **New announcement** (everyone is notified; you can see who has read it) |
| Ask the group to decide something | Feed → Polls → **New poll** (single or multiple choice, optional closing time; close it any time) |
| Add a checklist item or deadline | Admin → Checklist |
| Add or fix a destination-guide tip | Admin → Destination guide → **Add** or the pencil. Links are one per line as `Label | https://…`; "Show on itinerary days" puts it in that day's Good to know strip |
| See who is behind on prep | Admin → People & access (percentage, expand for item-level detail) |
| Correct someone's expense | Expenses → History → open it → **Correct** (the audit trail keeps the old values) |
| Change the default THB→INR rate | Admin → Trip settings (past expenses keep the rate they were saved with) |

## Accounts
- **Add a traveller:** Admin → People & access → **Add traveller**. A random password is shown once: copy it and
  share it privately. They can change it in Profile.
- **Forgot password:** there is no email reset (accounts have no inbox). Use **Reset password** on their card.
- **Promote / demote / remove:** on their card. You cannot demote or remove yourself, so a trip always has an admin.
  Removing someone ends their access immediately; their expenses and history remain.

## Rules of thumb
- Only set **Confirmed** when something is actually booked. Use *Suggested*, *Pending* or *Needs verification* otherwise.
- Leave unknown times and prices empty. The app shows "to be confirmed" rather than inventing a value.
- Private documents ("Only me") and personal expenses cannot be seen or edited by you. That is intentional.
- Deleting a day deletes its activities. Deleted items are soft-deleted in the database (recoverable by SQL).

## Adding the real five travellers (first-time setup)
1. Edit `scripts/users.json` with real names and usernames (first entry is the admin).
2. `export` the service-role key in your own terminal, then `npm run provision`.
3. Hand each person their username and one-time password privately; ask them to change it on first login.
