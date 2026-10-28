# Automation scripts

These Playwright (Node.js) scripts drive the **live** Zoho Creator app in a real Chromium window. They never handle credentials. You sign in yourself in the window that `browser.mjs` opens, and the other scripts attach to that window through the Chrome DevTools Protocol (port 9333).

```
npm install            # installs playwright 1.48.2
npx playwright install chromium   # if no Chromium build is cached yet
node browser.mjs       # keep running; sign in to Zoho in the window
```

| Script | Purpose |
|---|---|
| `browser.mjs` | Opens the shared, signed-in browser window (English locale, persistent profile in `.browser-profile/`, git-ignored) |
| `import-ds.mjs <file.ds>` | Creator → Import from file. Uploads the `.ds` and prints the importer's line-level errors, if any |
| `seed-master.mjs` | Adds the customers and properties from `../test-data/seed-data.json` through the live forms |
| `run-tests.mjs` | Runs the test plan (it also creates the sample rentals) and writes `out/results.json` |
| `verify-poststate.mjs` | Checks the outcome of edits E04/E05/E07 in the live reports (see TEST_RESULTS notes) |
| `tidy-notes.mjs` | Replaces test-oriented notes on three rentals with realistic text |
| `write-results.mjs` | Generates `../TEST_RESULTS.md` and copies the evidence screenshots |
| `screenshots.mjs` | Captures the showcase screenshots into `../screenshots/` |
| `crm-test.mjs` | Zoho CRM tests I01–I03: creates a rental, checks its Deal in CRM, cancels it and checks the stage. Writes `out/crm-results.json` |
| `books-test.mjs` | Zoho Books tests B01–B04: re-saves rentals, checks invoice numbers in Creator and the invoice list in Books |
| `lost-test.mjs create` / `lose` | L01–L03: creates a booking (confirmation email), then marks its Deal Closed Lost in CRM and checks that Creator cancels it |
| `crm-fn-save.mjs` | Pastes `app/crm/deal_closed_lost.dg` into the open CRM function editor and saves it |
| `crm-backfill.mjs` | One-off: re-saves existing rentals unchanged so they are synced to CRM |
| `ide-apply.mjs`, `ide-script.mjs` | Replace a component's code in Creator's Application IDE and save it (used to add the CRM sync to the live app) |
| `tab.mjs`, `act.mjs` | Work in a separate "automation" tab, leaving your own tabs alone |
| `lib.mjs`, `zc.mjs` | Shared helpers: attach to the browser; fill Creator fields (text, date, select2 drop-downs); submit and read the app's response |
| `inspect.mjs`, `click.mjs`, `dump.mjs`, `form-dom.mjs`, `status.mjs`, `goto.mjs` | Small inspection utilities used while building the automation |

The owner and app link names (`gonzadeandrade1/rental-management`) are hard-coded in `zc.mjs` and `import-ds.mjs`. Change them to use another account.
