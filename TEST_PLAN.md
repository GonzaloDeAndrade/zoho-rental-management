# Test Plan

## Approach

Every test runs **against the live Zoho Creator application** through its normal web forms, the same way a user works with it. A Playwright script ([`automation/run-tests.mjs`](automation/run-tests.mjs)) drives a Chromium window signed in to the owner's Zoho account. For each test it:

1. opens the form (or an existing record in edit mode),
2. fills the fields through the UI (drop-downs, date fields, text),
3. records the **live preview** that the On User Input workflows calculate,
4. submits, and captures the app's answer: the success message, the Deluge alert text, or Creator's mandatory-field errors,
5. reads the resulting report rows or Dashboard values when the test needs them,
6. compares the observed result with the expected result and sets PASS / FAIL automatically.

An exception inside the automation itself (for example, an element not found) marks the test **NOT_EXECUTED** instead of PASS or FAIL. Results are written to `automation/out/results.json`, and [TEST_RESULTS.md](TEST_RESULTS.md) is generated from that file. Each test has a screenshot in `automation/out/`. The most relevant ones are copied to [`screenshots/`](screenshots/).

The integration tests work the same way, then check the other app in the same browser: CRM tests I01–I03 ([`crm-test.mjs`](automation/crm-test.mjs)), Books tests B01–B04 ([`books-test.mjs`](automation/books-test.mjs)), and the email and CRM → Creator tests L01–L03 ([`lost-test.mjs`](automation/lost-test.mjs)). The email in L01 goes to a reserved `example.com` address, which isn't delivered, so the check is the owner's copy.

**Reference date:** the tests ran on **27-Oct-2026** (the integration tests on 28-Oct-2026), and the date rules (R4b–R4d) are relative to that day. Running the same data on another date gives different, still correct, results for those rules.

## Test data

Every person, email, phone number and ID is fictional. Emails use the reserved `example.com` domain, and phones use the reserved `555-01xx` range. Source: [`test-data/seed-data.json`](test-data/seed-data.json), and the rental rows S01–S13 in the test script.

- 6 customers, 6 properties (one in *Maintenance*).
- 15 rentals created by the tests: 4 Completed (one through early check-out), 2 Active, 5 Reserved, 4 Cancelled (RNT-0014 from I01–I03 and RNT-0015 from L01–L02 are the extra two).

## Test cases

| ID | Area | Scenario | Expected result |
|---|---|---|---|
| S01–S03 | Valid rental + calculation | Create past rentals directly as *Completed* | Saved; days and total correct in the report; `RNT-####` generated |
| S04, S05, S12 | Valid rental + calculation | Create current rentals as *Active* | Saved; values correct |
| S06 | Valid rental + calculation | Standard future reservation (7 days × $120) | Saved; $840.00 |
| S07 | Boundary: calculation | 1-day rental (minimum) | Saved; 1 × $70 = $70.00 |
| S08, S10 | Valid rental | Future reservations | Saved |
| S09 | Overlap boundary | Starts on the check-out day of S04 (same property) | Saved: same-day turnover is allowed |
| C01 | Property status sync | After S04 is Active | Harbor View = Rented; unaffected property stays Available |
| N01 | Required fields | Empty form | Rejected; mandatory fields flagged |
| N02 | Required fields | Property missing | Rejected |
| N03 | Invalid date range | End before start | Rejected with R3a message; preview 0 days |
| N04 | Boundary: dates | End = start (0 days) | Rejected with R3a message |
| N05 | Boundary: dates | 366 days | Rejected with R3b message |
| S13 | Boundary: dates | 365 days | Saved; 365 × $210 = $76,650.00 |
| N06 | Overlap | Partial overlap with S06 | Rejected; message names RNT-0006 and its dates |
| N07 | Overlap | New range encloses S06 | Rejected |
| N08 | Overlap | Identical dates to S09 | Rejected |
| N09 | Overlap | Same dates as S10 while it is Reserved | Rejected |
| N10 | Statuses | Book a property in Maintenance | Rejected with R5 message |
| N11 | Statuses | New Reserved rental starting in the past | Rejected (R4b) |
| N12 | Statuses | New Active rental with a future start | Rejected (R4c) |
| N13 | Statuses | New Completed rental with a future end | Rejected (R4d) |
| N14 | Statuses | New rental created as Cancelled | Rejected (R4a) |
| E01 | Transitions | Completed → Active | Rejected (R4e) |
| E02 | Transitions | Reserved → Active before start date | Rejected (R4c) |
| E03 | Transitions | Edit dates of a Completed rental | Rejected (R4f) |
| E04 | Transitions | Reserved → Cancelled | Saved |
| S11 | Overlap | Re-book the dates released by cancelled S10 | Saved |
| E05 | Transitions | Cancel the 365-day booking | Saved |
| E06 | Transitions | Active → Completed before end date | Rejected (R4d) |
| E07 | Transitions + calculation | Early check-out: end date → today, Active → Completed | Saved; recalculated 1 × $210; property back to Available |
| E08 | Transitions | Edit only the Notes of Cancelled rentals | Saved (Notes stay editable on locked records) |
| P01 | Property validation | Daily rate 0 | Rejected (A5) |
| P02 | Property validation | Set Maintenance while an Active rental exists | Rejected (A3) |
| P03 | Property validation | Set Rented manually | Rejected (A4) |
| R01 | Calculation: rate snapshot | Raise a property's rate | Existing rental keeps the old rate and total |
| U01 | Uniqueness | Duplicate customer email | Rejected |
| U02 | Field validation | Invalid email format | Rejected |
| L01 | References | Customer lookup content | Only existing customers can be selected |
| L02 | References | Non-existent customer ID passed in the form URL | Not accepted; rental not saved |
| K01 | Dashboard KPIs | Compare tiles with the expected values from the final data | Active 2, Upcoming 5, Available Properties 3, Customers 6, Realized $1,925.00, Booked $3,950.00 |
| I01 | Zoho CRM sync | Create a rental (Sophie Laurent, Downtown Studio 5A, 01–04 Feb 2027) | Saved; *CRM Deal ID* filled automatically |
| I02 | Zoho CRM sync | Open that Deal in Zoho CRM | Deal `RNT-0014 - Downtown Studio 5A`, $210, Negotiation/Review, linked to Sophie Laurent |
| I03 | Zoho CRM sync | Change the rental to Cancelled | Same Deal ID; Deal stage becomes Closed Lost |
| B01 | Zoho Books | Save each Completed rental | Each gets an *Invoice No.* from Zoho Books |
| B02 | Zoho Books | Save an invoiced rental again | Same invoice number (no second invoice) |
| B03 | Zoho Books | Save a Reserved rental (RNT-0006) | No invoice |
| B04 | Zoho Books | Open Books → Invoices | Every invoice number is listed, with the rental's amount |
| L01 | Booking email | New booking: Daniel Okafor, Downtown Studio 5A, 01–05 Mar 2027 | Saved; confirmation email sent, copy received in the owner's inbox |
| L02 | CRM → Creator | Change that rental's Deal to Closed Lost in CRM | The rental becomes Cancelled in Creator |
| L03 | CRM → Creator | Open the Deal | Note "Rental RNT-0015 was cancelled in Zoho Creator…" |

### Expected KPI values (K01)

They're derived by hand from the final data set:

- Completed: S01 $600 + S02 $665 + S03 $450 + S05 after early check-out $210 = **$1,925.00**
- Reserved + Active: S04 $1,050 + S12 $665 + S06 $840 + S07 $70 + S08 $665 + S09 $450 + S11 $210 = **$3,950.00**
- Cancelled S10 and S13 are excluded.
- Available properties: Seaside Loft, Downtown Studio, Garden House = **3**. Harbor View and Pine Grove are Rented, Lakeside is in Maintenance.

## Not covered

- **API-level tests.** No Zoho OAuth client was set up for this project, so R2 (non-existent lookup IDs) was exercised only through the UI (L01, L02). The rule itself is in the On Validate script and would also protect API inserts.
- **Concurrency.** Two users booking the same dates at the same second weren't tested.
- **CRM failure path (I5).** A CRM outage wasn't simulated. The `try/catch` is in the code, but its behaviour wasn't observed.
- **Mobile layout.** The tests used the desktop web layout only.
