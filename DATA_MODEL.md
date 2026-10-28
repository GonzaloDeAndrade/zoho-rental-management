# Data Model

Three Zoho Creator forms. `Rentals` links to `Customers` and `Properties` through lookup fields.

```
Customers 1 ──< Rentals >── 1 Properties
```

A customer can have many rentals, and so can a property. Each rental belongs to exactly one customer and one property.

The full definition, with field link names, types and layout, is in [`app/RentalManagement.ds`](app/RentalManagement.ds). That is the file imported into Zoho Creator.

## Customers (`Customers`)

| Field | Link name | Type | Rules |
|---|---|---|---|
| Customer Name | `Customer_Name` | Single line (100) | Mandatory |
| Email | `Email` | Email | Mandatory, **unique**, format validated by Creator |
| Phone | `Phone` | Phone (international) | Mandatory, format validated by Creator |
| Identification Reference | `ID_Reference` | Single line (30) | Mandatory, **unique**. Fictional values only, for example `CUS-ID-1001` |

## Properties (`Properties`)

| Field | Link name | Type | Rules |
|---|---|---|---|
| Property Name / Reference | `Property_Name` | Single line (100) | Mandatory, **unique** |
| Address | `Address` | Address (line 1, line 2, city, state, postal code, country) | Mandatory |
| Property Type | `Property_Type` | Drop-down: Apartment, House, Studio, Loft, Cabin | Mandatory |
| Daily Rental Rate | `Daily_Rate` | Currency (USD) | Mandatory, must be > 0 and ≤ 100,000 (Deluge) |
| Availability Status | `Availability_Status` | Drop-down: Available, Rented, Maintenance | Mandatory, default `Available`. `Rented` is managed by the rental workflow (see [BUSINESS_RULES.md](BUSINESS_RULES.md#property-availability)) |
| Description | `Description` | Multi line | Optional |

## Rentals (`Rentals`)

| Field | Link name | Type | Source |
|---|---|---|---|
| Rental No. | `Rental_No` | Auto number (starts at 1) | Creator |
| Rental Reference | `Rental_Reference` | Single line (20) | Generated after saving: `RNT-0001`, `RNT-0002`, … (read-only) |
| Customer | `Customer` | Lookup → `Customers` (shows Customer Name) | User, mandatory |
| Property | `Property` | Lookup → `Properties` (shows Property Name) | User, mandatory |
| Start Date | `Start_Date` | Date | User, mandatory (check-in day) |
| End Date | `End_Date` | Date | User, mandatory (check-out day) |
| Number of Days | `Number_of_Days` | Number | **Calculated** (read-only) |
| Daily Rate | `Daily_Rate` | Currency (USD) | **Copied** from the property (read-only) |
| Total Cost | `Total_Cost` | Currency (USD) | **Calculated** (read-only) |
| Rental Status | `Rental_Status` | Drop-down: Reserved, Active, Completed, Cancelled | User, mandatory, default `Reserved` |
| Notes | `Notes` | Multi line | Optional |
| CRM Deal ID | `CRM_Deal_ID` | Single line (30) | Filled by the CRM sync after saving (read-only; hidden until filled) |
| Invoice No. | `Books_Invoice_No` | Single line (30) | Zoho Books invoice number, filled when the rental is completed (read-only; hidden until filled) |

### Why these choices

- **Lookups instead of text fields.** The customer and property fields can only hold records that already exist. Names stay consistent, and reports can show related data.
- **Daily Rate lives on the rental as well as on the property.** The rental keeps a snapshot of the price at booking time, so changing a property's price later never rewrites past or confirmed rentals. Test R01 verifies this.
- **Number of Days and Total Cost are stored, not computed in reports.** They are recalculated on every save. Reports and KPI sums can then use them directly.
- **Auto number + formatted reference.** Creator's auto number guarantees a unique sequence. The `RNT-0001` text version is easier to read in reports and conversations.

## Zoho CRM and Zoho Books mapping

Each rental is mirrored in Zoho CRM, and completed rentals are invoiced in Zoho Books (see [BUSINESS_RULES.md](BUSINESS_RULES.md#zoho-crm-sync)):

| Creator | Zoho CRM |
|---|---|
| Customer (by name) | Account |
| Customer (by email) | Contact (linked to the Account) |
| Rental | Deal (linked to the Account and Contact); `Rentals.CRM_Deal_ID` holds its ID |
| Customer (by email) | Books contact |
| Completed rental | Books invoice (draft); `Rentals.Books_Invoice_No` holds its number |

## Reports

| Report | Form | Filter | Sort |
|---|---|---|---|
| All Properties | Properties | none | Property name ↑ |
| Available Properties | Properties | `Availability_Status == "Available"` | Daily rate ↑ |
| Customers | Customers | none | Customer name ↑ |
| All Rentals | Rentals | none | Start date ↓ |
| Active Rentals | Rentals | `Rental_Status == "Active"` | End date ↑ |
| Upcoming Rentals | Rentals | `Rental_Status == "Reserved"` | Start date ↑ |
| Completed Rentals | Rentals | `Rental_Status == "Completed"` | End date ↓ |

All Properties and All Rentals colour-code the status column.

## Page

**Dashboard**: six KPI tiles. Clicking a tile opens the matching report in a pop-up. [BUSINESS_RULES.md](BUSINESS_RULES.md#kpi-definitions) defines each KPI.
