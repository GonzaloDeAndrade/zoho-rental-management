# Demo Scripts

Two screen recordings with voice-over in English:

| Video | Length | Audience | Content |
|---|---|---|---|
| **1. Overview** | ≈ 90 s | Recruiters, hiring managers | What the app does, shown on live data |
| **2. Technical walkthrough** | ≈ 3–4 min | Technical interviewers | How it's built: Deluge, the integrations, tests |

Video 1 creates a real booking (Lucas Moreau, Seaside Loft 101, 12–15 Nov). Video 2 cancels it from Zoho CRM, live. That demonstrates the CRM → Creator sync and also returns the data to its documented state.

## Before recording

1. Browser in English, full screen (F11), zoom 100–110%. Close notifications.
2. Open three tabs:
   1. the app on the **Dashboard**: `https://creatorapp.zoho.com/gonzadeandrade1/rental-management`
   2. **Zoho CRM → Deals**, list view. It is sorted by *Created Time*, newest first, so a new deal appears at the top.
   3. **Zoho Books → Invoices**.
3. Recorder: **Loom** (free; adds a round webcam bubble and gives a shareable link) or **OBS Studio** (free). Record at 1080p. Webcam on, small, in a bottom corner.
4. Do one practice run without recording. A practice save creates a real rental. Cancel it afterwards: mark its Deal *Closed Lost* in CRM, or set the rental to *Cancelled*.

## Video 1: Overview (≈ 90 s)

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:08 | Webcam large or face only, then switch to the **Dashboard** | "Hi, I'm Gonzalo, a Zoho developer. This is a rental management system I built in Zoho Creator, connected to Zoho CRM and Zoho Books." |
| 0:08–0:16 | **Dashboard**, click the **Active Rentals** tile → pop-up → close | "The dashboard shows live KPIs, and each tile opens the matching report." |
| 0:16–0:33 | **Rentals → Rental**. Customer *Lucas Moreau*, property *Seaside Loft 101* (rate fills in: $120), Start **10-Nov-2026**, End **15-Nov-2026** → 5 days, $600 | "When I pick a property, its rate is copied in, and Deluge calculates the stay right away: five nights at 120 dollars is 600." |
| 0:33–0:45 | **Save Rental** → overlap alert naming RNT-0006 → OK | "But the property is already booked until the 12th. The validation blocks the double booking and tells me which reservation it conflicts with." |
| 0:45–0:53 | Start Date → **12-Nov-2026** (3 days, $360) → **Save Rental** → success | "Starting on the 12th, the checkout day of the previous guest, is valid, so it saves. The guest also gets a confirmation email." |
| 0:53–1:08 | **CRM tab** → F5. Top row: *RNT-00xx - Seaside Loft 101*, $360, Negotiation/Review, Lucas Moreau | "Every booking is synced to Zoho CRM as a deal, with the customer as account and contact, so sales sees the pipeline. It works both ways: if sales marks the deal as lost, the booking is cancelled in Creator automatically." |
| 1:08–1:22 | **Books tab**: the invoice list → click one invoice | "And when a stay is completed, the invoice is created in Zoho Books: nights times rate, linked to the booking. The four invoices add up exactly to the realized revenue on the dashboard." |
| 1:22–1:30 | Back to the app or to the webcam | "Everything is documented and tested end to end. The code and test results are on my GitHub. Thanks for watching." |

## Video 2: Technical walkthrough (≈ 3–4 min)

Show the GitHub repository (or VS Code) and the live apps side by side.

| # | On screen | Voice-over (key points) |
|---|---|---|
| 1 | README: the **architecture diagram** | "Three Zoho apps. Creator is the system of record for bookings. Deals go to CRM, invoices go to Books, and CRM can cancel bookings back in Creator." |
| 2 | `app/src/RentalManagement.template.ds` and `app/build.mjs` | "The whole application is source code. I build the Creator `.ds` file from a template plus separate Deluge files, so it's versioned and reviewable in Git." |
| 3 | `rental_validate.dg`: the overlap query (`Rentals[Property == … && Start_Date < input.End_Date && End_Date > input.Start_Date]`) | "All rules run server-side in On Validate. Overlap uses a half-open interval, so same-day turnover is allowed, and cancelled bookings are ignored. Status changes follow a fixed lifecycle, and final records are locked." |
| 4 | `crm_sync.dg` | "On Success, the rental is mirrored in CRM. The customer is matched by email, the deal ID is stored on the rental, so the next save updates the same deal. It's in a try-catch: if CRM is down, the booking is never lost." |
| 5 | `app/crm/deal_closed_lost.dg` + CRM **Setup → Workflow Rules → Rental deal lost** | "The other direction is a CRM workflow rule and a Deluge function. It finds the rental through the Creator API and cancels it. It only cancels reserved bookings, and it stops if the rental is already cancelled, so the two-way sync can't loop. The connection only has read and update permissions on reports." |
| 6 | **Live**: CRM tab → open Lucas's deal from video 1 → change Stage to **Closed Lost** → Save. Switch to Creator → **All Rentals**: the booking is now *Cancelled*. Back in CRM: the note on the deal | "Let me show it live. I mark this deal as lost… and in Creator the booking is already cancelled, and the deal has a note explaining what happened." |
| 7 | `books_invoice.dg` + Books invoice | "Completed stays are invoiced in Books once. The invoice number is stored on the rental, so it's never invoiced twice." |
| 8 | `TEST_RESULTS.md` + a screenshot from `screenshots/tests/` | "I tested it end to end with Playwright against the live apps: every rule, the edge cases, and the integrations, each with a screenshot as evidence." |

## After recording

If you recorded only Video 1, cancel Lucas's new booking: mark its Deal **Closed Lost** in CRM (the rental is cancelled automatically), or set it to *Cancelled* in *All Rentals*. Don't delete it: the sync doesn't handle deletes, so the Deal would stay in CRM.

## Alternative validation shots (for a second take)

- **Invalid date range:** Start 20-Nov-2026, End 18-Nov-2026 → "End date must be later than the start date."
- **Maintenance:** property *Lakeside House*, any future dates → "Property Lakeside House is under maintenance and cannot be booked."
- **Locked record:** open a Completed rental, change it to Active → "Invalid status change: Completed to Active…"
