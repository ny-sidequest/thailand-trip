# Loading the real trip documents

Private documents (tickets, hotel confirmations, insurance) live in `travel_docs/` at the repo root.
**That folder is git-ignored and must never be committed**: the GitHub repo is public and these files contain
booking references, PINs, policy numbers and traveller names.

`travel_docs/_manifest.json` (also git-ignored) holds the facts extracted from those PDFs. The script
`scripts/apply-travel-docs.mjs` loads them into the live app.

```bash
node scripts/apply-travel-docs.mjs --check      # offline: validate the manifest and that every file exists
node scripts/apply-travel-docs.mjs --dry-run    # sign in, read, list what WOULD change; writes nothing
node scripts/apply-travel-docs.mjs              # apply (asks you to type YES first)
node scripts/apply-travel-docs.mjs --tick all   # also tick every "Travel documents" checklist item for you
```

- You sign in with your own username/password at the prompt (hidden, never stored). It acts with your admin
  permissions only; no service-role key is involved.
- What it does: fills in the four stays and both flights (confirmation numbers, addresses, check-in windows, map
  links, terms), corrects/extends the itinerary (Day 1 departure, Day 11 flight time and reminders), adds two checklist
  items from the airline notice, uploads the six PDFs to the private wallet (visible to the group) linked to their
  bookings, and ticks the checklist items the documents actually prove (`--tick evidenced`, the default) for **you only**:
  each traveller ticks their own.
- Safe to re-run: existing documents and items are skipped; updates are idempotent. If the itinerary was edited so a match
  is no longer unique, that step reports `✗` and nothing else is affected.
- Members get notifications for the changes (a one-off burst).
