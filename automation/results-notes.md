### First full run: what didn't pass, and why

The first full run (40 tests at that point) ended with **35 PASS, 1 FAIL, 4 NOT EXECUTED**. None of these were application defects. All of them came from the test script, and each was corrected and re-checked as follows:

| Test | First-run result | Cause | Resolution |
|---|---|---|---|
| E04, E05, E07 | NOT EXECUTED | After a successful **edit**, Creator redirects from the form to the report. The script was still reading the form and crashed ("Execution context was destroyed"). The edits themselves had been submitted. | The script now treats the redirect as success. These three edits change data and can't be repeated, so their **outcome was verified in the live All Rentals / All Properties reports** (`automation/verify-poststate.mjs`). The "Actual" column says so explicitly. |
| R01 | NOT EXECUTED, then FAIL | Same redirect issue. Then Creator's edit confirmation reads "Data updated **S**uccessfully!", and the script compared it case-sensitively. Both rate changes had in fact been saved. | Case-insensitive match. R01 was **re-executed in full**: rate 70 → 80, rental unchanged at $70, rate back to 70. |
| K01 | FAIL | The script read the word "Customers" from the navigation menu instead of the KPI tile, so the value it read was "Properties". The five other KPIs already matched. | The script now reads the last match on the page. K01 was **re-executed**: all six KPIs match. |

I01–I03 (Zoho CRM sync) were added on 28-Oct-2026 and passed on their first run. RNT-0014, the rental they create, ends Cancelled, so it doesn't change the KPIs in K01.

E08 was added after the main run. It records the notes clean-up on two Cancelled rentals, which confirms that Notes stay editable on locked records.

### Observations

- The Creator mandatory-field check runs in the browser before the Deluge *On Validate* script. For N01/N02 the user therefore sees Creator's standard message ("This field is mandatory…") rather than the Deluge R1 text. The R1 checks remain as a server-side safeguard.
- U01, U02 and L02 are rejected by Creator's built-in field validation (unique email, email format, invalid lookup value). Creator shows the generic "Invalid entries found" pop-up plus a message next to the field.
- R2 (non-existent customer/property ID) can't be reached through the UI, because the lookup only offers existing records (L01, L02). Testing it directly would need the REST API (see [TEST_PLAN.md](TEST_PLAN.md#not-covered)).

### Integration tests

- **I01–I03 (Zoho CRM):** create RNT-0014 and cancel it. It ends Cancelled, so the KPIs in K01 don't change.
- **B01–B04 (Zoho Books):** re-save the four Completed rentals unchanged. They received invoices INV-000001 to INV-000004 ($210, $450, $600, $665 = $1,925.00, the dashboard's Realized Revenue). The invoices are drafts.
- **L01 (booking email):** the customer addresses use the reserved `example.com` domain, which never receives mail. The check is the copy sent to the owner's inbox, which only the owner can confirm. L01 stays NOT EXECUTED until that confirmation.
- **L02–L03 (CRM → Creator):** use RNT-0015, the booking created in L01. Its Deal is moved to Closed Lost in the CRM edit form, the same way a salesperson would do it.
