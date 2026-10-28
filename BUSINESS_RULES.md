# Business Rules

All rules run **server-side in Deluge** when a record is saved (the *On Validate* form workflow). A user can't bypass them from the browser, so they protect data even if the form changes later. The form also shows a live preview of the calculation while the user types (*On User Input*). That preview is for usability only. The saved values always come from the server-side calculation.

Source files:

| Workflow | Event | Source |
|---|---|---|
| Rental - Field setup | On load (add/edit) | [`app/src/RentalManagement.template.ds`](app/src/RentalManagement.template.ds) |
| Rental - Property selected / Start date changed / End date changed | On user input | same file |
| **Rental - Validate and calculate** | On validate (add/edit) | [`app/src/deluge/rental_validate.dg`](app/src/deluge/rental_validate.dg) |
| Rental - Reference and property status | On success (add/edit) | [`rental_success.dg`](app/src/deluge/rental_success.dg), then [`crm_sync.dg`](app/src/deluge/crm_sync.dg), [`books_invoice.dg`](app/src/deluge/books_invoice.dg), [`booking_email.dg`](app/src/deluge/booking_email.dg) |
| Rental Deal Closed Lost (Zoho CRM function) | CRM workflow rule *Rental deal lost* | [`app/crm/deal_closed_lost.dg`](app/crm/deal_closed_lost.dg) |
| Property - Validate | On validate (add/edit) | [`app/src/deluge/property_validate.dg`](app/src/deluge/property_validate.dg) |
| `RentalLogic.calculate(start, end, rate)` | Deluge function | template file, `functions` block |

**No duplicate logic.** The duration/price formula exists once, in `RentalLogic.calculate`. The three live-preview workflows and the server-side validation all call it.

## Calculation

| ID | Rule |
|---|---|
| C1 | **Daily Rate** is copied from the selected property when the rental is created, or when the property is changed while the rental is still *Reserved*. Otherwise the saved rate is kept (price snapshot). |
| C2 | **Number of Days** = days between Start Date and End Date. The end date is the check-out day: 05-Nov → 12-Nov = 7 days. |
| C3 | **Total Cost** = Number of Days × Daily Rate, rounded to 2 decimals. |

## Validation

When one or more rules fail, the save is cancelled and every failing message is shown in one alert.

| ID | Rule | Message |
|---|---|---|
| R1 | Customer, Property, Start Date, End Date and Rental Status are required. Creator's mandatory flags enforce this first, and Deluge checks it again. | "Customer is required." etc. In the UI, Creator shows "This field is mandatory." |
| R2 | The customer and property must exist. | "The selected customer does not exist." / "The selected property does not exist." |
| R3a | End Date must be later than Start Date (0-day rentals are invalid). | "End date must be later than the start date." |
| R3b | A rental can be at most 365 days. | "A rental cannot be longer than 365 days." |
| R5 | A property in **Maintenance** can't take new Reserved/Active bookings. | "Property {name} is under maintenance and cannot be booked." |
| R6 | **No overlapping bookings** for the same property (see below). | "Booking overlap: {property} is already booked from {start} to {end} ({reference}, {status})." |

### Overlap rule (R6)

Each rental occupies the half-open range **[Start Date, End Date)**. A new or edited rental conflicts with an existing rental of the same property when:

```
new.Start < existing.End  AND  new.End > existing.Start
```

- **Cancelled** rentals never block dates. Reserved, Active and Completed rentals do.
- A rental may **start on the day another one ends** (same-day turnover). Test S09 verifies this.
- When a rental is edited, the record is excluded from its own check.

## Rental statuses

```
            ┌──────────► Cancelled (final)
            │
 Reserved ──┴──► Active ──► Completed (final)
```

| ID | Rule | Message |
|---|---|---|
| R4a | A new rental can't be created as *Cancelled*. | "A new rental cannot be created as Cancelled." |
| R4b | A new *Reserved* rental can't start in the past. Past rentals are recorded directly as *Active* or *Completed*. | "A reservation cannot start in the past…" |
| R4c | *Active* requires that the start date has been reached (Start Date ≤ today). | "A rental can only be Active once its start date (…) has been reached." |
| R4d | *Completed* requires that the end date has been reached (End Date ≤ today). For an early check-out, set the end date to today first. The cost is then recalculated. | "A rental can only be Completed on or after its end date…" |
| R4e | Allowed changes: Reserved → Active / Cancelled; Active → Completed. Completed and Cancelled are final. | "Invalid status change: {old} to {new}…" |
| R4f | Completed and Cancelled rentals are **locked**: only Notes can change. | "{status} rentals are locked. Only the notes can be edited." |
| R4g | An Active rental can't change its customer, property or start date. The end date can still change (extension or early check-out). | "The customer, property and start date of an active rental cannot be changed." |

R4c and R4d apply when a rental is created or its status changes. They compare against the current date in the application's time zone (America/Argentina/Buenos_Aires).

## Property availability

| ID | Rule |
|---|---|
| A1 | When a rental is saved, the property becomes **Rented** if it has at least one Active rental, and goes back to **Available** when it has none. |
| A2 | **Maintenance** is set manually and is never overwritten by A1. |
| A3 | A property with an Active rental can't be set to Available or Maintenance by hand. "This property has an active rental, so its status stays Rented until the rental is completed." |
| A4 | *Rented* can't be set by hand. "Rented is set automatically when a rental becomes Active. Choose Available or Maintenance." |
| A5 | Daily rate must be > 0 and ≤ 100,000. "Daily rental rate must be greater than zero." |

**Known limitation:** statuses don't change by themselves as dates pass. No scheduled job turns Reserved into Active on the start date. A user does it by editing the rental, and the date rules R4c/R4d stop premature changes. A daily scheduled workflow is listed as a planned improvement in [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md#planned-improvements).

## Zoho CRM sync

Runs at the end of the *On Success* workflow, so only rentals that passed every validation reach CRM. It uses Creator's built-in Zoho CRM connection (`zoho.crm.searchRecords / createRecord / updateRecord`).

| ID | Rule |
|---|---|
| I1 | Every saved rental has one **Deal** in Zoho CRM. The Deal ID is stored in the rental's read-only *CRM Deal ID* field, so later saves update the same Deal instead of creating a new one. |
| I2 | The customer is matched to a CRM **Account** by name and a **Contact** by email. Missing ones are created (the name is split into first and last name). The Deal is linked to both. |
| I3 | Deal fields: *Deal Name* = `RNT-0001 - <property>`, *Amount* = Total Cost, *Closing Date* = Start Date, *Description* = property, dates and status. |
| I4 | *Stage* follows the rental status: Reserved → **Negotiation/Review**, Active or Completed → **Closed Won**, Cancelled → **Closed Lost**. |
| I5 | A CRM failure never blocks the rental. The error is logged (`info`) and the next save of that rental tries again. |

### From CRM back to Creator

| ID | Rule |
|---|---|
| I6 | When a salesperson changes a rental Deal's stage to **Closed Lost**, the CRM workflow rule *Rental deal lost* calls the function *Rental Deal Closed Lost*. The function finds the rental by its CRM Deal ID through the Creator API and sets it to **Cancelled**, so the property dates are free again. |
| I7 | Only **Reserved** rentals are cancelled this way. Creator's status rules (R4) also apply to API updates. For an Active or Completed rental, the function leaves the rental unchanged and writes a note on the Deal explaining why. |
| I8 | **No loops.** When Creator cancels a rental, the sync sets the Deal to Closed Lost. The CRM function then sees the rental is already Cancelled and stops. When CRM cancels a rental, Creator's sync writes the stage that the Deal already has, so the CRM rule doesn't fire again. |
| I9 | Every cancellation coming from CRM is recorded twice: a note on the Deal, and a line added to the rental's Notes. |

The rentals that existed before the integration were synced once by re-saving them unchanged ([`automation/crm-backfill.mjs`](automation/crm-backfill.mjs)).

## Zoho Books invoice

| ID | Rule |
|---|---|
| B1 | When a rental is saved with status **Completed** and has no invoice yet, an invoice is created in Zoho Books. The invoice number is stored in the rental's read-only *Invoice No.* field, so a rental is never invoiced twice. |
| B2 | The customer is matched to a Books **contact** by email and created if missing. |
| B3 | Invoice: date = check-out date, reference = rental reference (`RNT-0001`), one line = property, *nights × daily rate*, with the stay dates. It is created as a **draft**, so the office can review it before sending. |
| B4 | Only completed stays are invoiced, so the invoices total the dashboard's *Realized Revenue*. |
| B5 | A Books failure never blocks the rental. The error is logged and the next save tries again. |

## Booking confirmation email

| ID | Rule |
|---|---|
| M1 | A new rental saved as **Reserved** sends a confirmation email to the customer (reference, property, check-in/out, nights × rate, total), with a copy to the owner. |
| M2 | Edits don't send the email again. A rental counts as new on the save that generates its reference. |

## KPI definitions

The Dashboard page computes these values live with Creator's aggregate functions (`thisapp.<Form>.<Field>.count/sum` with criteria):

| KPI | Definition |
|---|---|
| **Active Rentals** | Number of rentals with status = Active |
| **Upcoming Rentals** | Number of rentals with status = Reserved |
| **Available Properties** | Number of properties with Availability Status = Available. Excludes Rented and Maintenance |
| **Customers** | Total number of customer records |
| **Realized Revenue (USD)** | Sum of Total Cost of rentals with status = Completed |
| **Booked Revenue (USD)** | Sum of Total Cost of rentals with status = Reserved or Active (confirmed revenue not yet completed) |

Cancelled rentals count toward no KPI.
