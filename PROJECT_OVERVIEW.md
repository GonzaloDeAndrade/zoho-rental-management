# Project Overview

## Business scenario

*Coastline Stays* is a fictional company that rents out six holiday properties on the Atlantic coast of Buenos Aires province. Before this app, bookings lived in a spreadsheet, which caused three recurring problems:

1. **Double bookings.** Nothing stopped two reservations from overlapping on the same property.
2. **Pricing mistakes.** Staff multiplied days × rate by hand, and price changes were applied to old bookings.
3. **No overview.** Nobody could see at a glance what was rented, what was coming up, or how much revenue had been earned.

## Solution

A Zoho Creator application with three related forms (Customers, Properties, Rentals), Deluge business logic, seven reports and a KPI dashboard.

| Problem | How the app solves it |
|---|---|
| Double bookings | Server-side overlap check on every save, with same-day turnover allowed and cancelled bookings ignored |
| Pricing mistakes | Days and total are calculated automatically. The daily rate is copied from the property at booking time, so later price changes don't affect existing rentals |
| Invalid data | Mandatory and unique fields, date-range rules, a 365-day maximum, and lookups that only accept existing customers/properties |
| Unclear booking state | Explicit status lifecycle (Reserved → Active → Completed, or → Cancelled) with date-based guards. Completed and Cancelled records are locked |
| Property availability | Updated automatically from active rentals. Maintenance blocks new bookings |
| No overview | Dashboard with 6 live KPIs that link to the matching reports |
| Sales has no view of bookings | Every rental is synced to Zoho CRM as a Deal, with stage and amount kept up to date. A deal lost in CRM cancels the booking |
| Invoices typed by hand | A completed stay creates its Zoho Books invoice automatically |
| Guests unsure their booking went through | Confirmation email on every new booking |

## Implemented vs. planned

### Implemented and verified in the live app

The automated UI tests verified everything in this list. See [TEST_RESULTS.md](TEST_RESULTS.md).

- Application deployed by importing [`app/RentalManagement.ds`](app/RentalManagement.ds) into Zoho Creator.
- Forms: Customers, Properties, Rentals, with lookups, mandatory/unique fields, help texts and read-only calculated fields.
- Deluge: one shared calculation function, three live-preview workflows, two validation workflows and one post-save workflow (see [BUSINESS_RULES.md](BUSINESS_RULES.md)).
- Reports: All Properties, Available Properties, Customers, All Rentals, Active Rentals, Upcoming Rentals, Completed Rentals, with status colour-coding.
- Dashboard page with 6 KPI tiles (click-through to reports).
- Fictional sample data: 6 customers, 6 properties, 15 rentals in every status.
- Navigation menu: Dashboard / Rentals / Properties / Customers. (*App Preferences* is added by Creator automatically because the app uses a connection.)
- **Zoho CRM sync:** each rental becomes a Deal (with Account and Contact) and is updated on every save. All rentals are in CRM.
- **CRM → Creator:** a CRM workflow rule and Deluge function cancel the rental when its Deal is marked Closed Lost.
- **Zoho Books:** completed rentals are invoiced automatically (4 draft invoices, $1,925.00 in total).
- **Booking confirmation email** to the guest, with a copy to the owner.
- The integrations were added after the first deployment, through Creator's *Application IDE* and the CRM setup, on 28-Oct-2026.

### Planned improvements (not implemented)

- **Scheduled status updates:** a daily scheduled workflow that marks rentals Active on their start date and flags overdue check-outs.
- **Cancellation emails**, and recording payments in Books when the guest pays.
- **Charts** on the dashboard (revenue per month, occupancy per property).
- **Customer portal** where customers can see their own bookings.
- **REST API integration tests** using a Zoho OAuth client.

## Technical decisions

- **Source-controlled application.** The app is defined in a single `.ds` file, built from a readable template plus separate `.dg` Deluge files by [`app/build.mjs`](app/build.mjs). The whole application can be reviewed, versioned and re-imported from this repository.
- **Server-side validation first.** All rules run in *On Validate*. The *On User Input* workflows only give immediate feedback while the user types.
- **Single source of truth for pricing.** The `RentalLogic.calculate` function is the only place where days and totals are computed.
- **Integrations that can't break bookings.** The CRM and Books calls run after the rental is saved, inside `try/catch`. If CRM or Books is unreachable, the rental is still saved and the next save retries.
- **Idempotent integrations.** The CRM Deal ID and the Books invoice number are stored on the rental, so saving again updates the same Deal and never creates a second invoice.
- **Least-privilege connections.** The CRM → Creator connection only has `report.READ` and `report.UPDATE`.
- **Clear error messages.** Each rule has one specific message that tells the user what to fix, for example "To finish early, set the end date to today first."

## Tools used

- Zoho Creator 6 (forms, reports, pages, Deluge workflows and functions)
- Zoho CRM: Deals, Accounts, Contacts, Notes, a custom function and a workflow rule
- Zoho Books: contacts and invoices
- Playwright + Node.js to drive the live application for data entry, testing and screenshots
- Claude Code (AI assistant) to support implementation, testing and documentation
