# Implementation Plan: Historical Data Migration (Excel to Production DB)

This plan outlines the steps to migrate 2,157+ rows of historical data from the client's Excel files into the Production Neon Database. We will replace current dummy data with verified historical records and ensure all essential columns are mapped correctly.

> [!IMPORTANT]
> ## User Review Required
> **Data Replacement Strategy**: We will perform a "Clean & Load" for shipment-related tables to ensure no duplicate dummy data remains, while keeping the schema backwards compatible. 
> **Partner Normalization**: I will implement a "Smart Lookup" logic that maps various string names (e.g., "PT. MME", "MME", "Manambang") to a single normalized Partner entity.

## Proposed Mapping & Unification

### 1. Shipment Entities (Unification of Headers)
We will unify headers from multiple sheets into a single logical structure.

| Excel Column (Various Sheets) | Unified Logical Field | Prisma Target |
| :--- | :--- | :--- |
| MV/Barge Nomination, Nomination, Barge Nomination | `vesselName` | `ShipmentDetail.vesselName` / `DailyDelivery.mvBargeNomination` |
| Buyer, Project / Buyer, Project Name | `partnerBuyer` | `Partner` (linked via ID) |
| Supplier, IUP OP, Source, MSE/BPG | `partnerSupplier` | `Partner` / `SourceSupplier` |
| BL Quantity, Qty (MT), BL Quantity (MT) | `quantity` | `ShipmentDetail.blQuantity` |
| BL DATE, BL Date | `shipmentDate` | `ShipmentDetail.blDate` |
| Actual GCV, Actual GAR, GAR (ARB), ACTUAL GCV (GAR&GAD) | `qualityGar` | `QualityResult.gar` / `ShipmentDetail.resultGar` |

### 2. Table-by-Table Strategy

#### [MODIFY] [schema.prisma](file:///c:/Users/Glooms/Downloads/11GAWE/prisma/schema.prisma)
- Add missing operational fields to `ShipmentDetail` (e.g., more specific document tracking flags found in the headers).
- Add `partnerId` to `ShipmentDetail` and `DailyDelivery` for full relational mapping.

#### [NEW] [migrate-historical-data.ts](file:///c:/Users/Glooms/Downloads/11GAWE/scripts/migrate-historical-data.ts)
A high-performance script using `xlsx` and `PrismaClient` to:
- **Exhaustive Scan**: Read all sheets in `10.Daily Delivery Report` and `00. MV_Barge&Source`.
- **Entity Extraction**: Populating `Partner` with unique Buyers and Suppliers.
- **Data Cleaning**:
  - Normalizing Excel dates and numeric types.
  - Using a fuzzy/alias map for header variations.
- **Batch Load**: Transactionally loading `ShipmentDetail`, `DailyDelivery`, and `QualityResult`.

## Migration Steps

**Phase 1: Header Mapping & Validation**
- Map exact column positions for each historical year (variations exist between 2021 and 2026).
- Create a configuration object `COL_MAPS[year][sheet]`.

**Phase 2: Partner & Source Initialization**
- Extract unique names from "Buyer" and "Supplier" columns.
- Seed the `Partner` and `SourceSupplier` tables first to get foreign keys.

**Phase 3: Incremental Transactional Load**
- Load `ShipmentDetail` for all years.
- Load `DailyDelivery` specifically from the `10. Daily Delivery` file.
- Load `QualityResult` from the specs found in `ShipmentDetail` sheets.

**Phase 4: Financial Data Synchronization**
- Populate `OutstandingPayment` and `PLForecast` from the financial columns.

> [!WARNING]
> ## Open Questions
> **1. Data Overwrite**: Should I delete existing dummy records in `ShipmentDetail` / `DailyDelivery` or just append to them? *(Deletion of dummy data is recommended for a clean start).*
> **2. Date Detection**: Should I assume DD/MM/YYYY as the primary Excel date format?
> **3. Validation**: If a row is found but critical data (like Buyer or Date) is missing, should we skip it or import as "Incomplete"?

## Verification Plan

### Automated Tests
- `node check-db-integrity.js`: Verify that all 2,157 rows are present.
- `npx prisma list`: List and verify counts of `Partner` and `ShipmentDetail`.

### Manual Verification
- Check the Shipment Monitor UI to see if real cargo data is displayed.
- Check Partners & Directory to ensure the client list matches Excel.
- Verify Outstanding Payment page for financial accuracy.
