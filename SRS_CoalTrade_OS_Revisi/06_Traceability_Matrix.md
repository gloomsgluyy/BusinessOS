# Traceability Matrix

Dokumen ini memastikan requirement dalam SRS memenuhi revisi dari:

- `CoalTrade_OS_System_Flow_Requirement.docx`
- `CoalTrade_OS_Module_Revision_Matrix.xlsx`
- `CoalTrade_OS_Module_Revision_Matrix_SIMPLE.xlsx`

## 1. End-to-End Flow Coverage

| Revision Requirement | Source Document Section | Covered By SRS |
|---|---|---|
| Sistem harus end-to-end, bukan flat Excel table | System Flow section 2, README workbook | `01_SRS_Master.md` CP-01, E2E flow; `03_Module_Requirements.md` Shipment Monitor |
| Market Price sebagai reference offer dan P&L | System Flow step 1, matrix Market Price | `02_Functional_Requirements.md` FR-MP-001 |
| Forecast Sales creates deal dan convert to shipment | System Flow step 2-3, roadmap phase 1 | `02_Functional_Requirements.md` FR-FS-001 to FR-FS-009 |
| Shipment ID dibuat setelah deal confirmed | System Flow step 3 | `02_Functional_Requirements.md` FR-FS-009 |
| Source confirmation by Source Team | System Flow step 4, Source Module Flow | `02_Functional_Requirements.md` FR-SRC-001 |
| Quality workflow by Quality Team | System Flow step 6, Quality Module Flow | `02_Functional_Requirements.md` FR-QLT-001 |
| SI generated per shipment | System Flow step 7, SI per Shipment | `02_Functional_Requirements.md` FR-SI-001 |
| Shipment execution by Sales/Traffic | System Flow step 8, role matrix | `03_Module_Requirements.md` Shipment Monitor |
| Payment/P&L linked to shipment | System Flow step 10-11 | `02_Functional_Requirements.md` FR-PAY, FR-FRT, FR-PL |
| Dashboard as control tower | System Flow step 12, Dashboard Alerts | `02_Functional_Requirements.md` FR-DSH-001 |

## 1A. Oral Revision 2026-05-23 Coverage

| Oral Revision Requirement | Covered By SRS |
|---|---|
| Projects renamed to Forecast Sales | `02_Functional_Requirements.md` FR-FS-001; `08_Forecast_Sales_FCO_Revision.md` |
| Trader creates monthly forecast/offer draft | `02_Functional_Requirements.md` FR-FS-002 |
| Draft can be saved incomplete | `02_Functional_Requirements.md` FR-FS-002; `08_Forecast_Sales_FCO_Revision.md` WF-FS-001 |
| Mandatory fields required before submit | `02_Functional_Requirements.md` FR-FS-002; `08_Forecast_Sales_FCO_Revision.md` BR-FS-001 |
| Market price reference in offer | `02_Functional_Requirements.md` FR-FS-002 |
| Historical selling price reference | `02_Functional_Requirements.md` FR-FS-002 |
| Warning if target selling price too low | `02_Functional_Requirements.md` FR-FS-002 |
| Supplier candidate from Source | `02_Functional_Requirements.md` FR-FS-003 |
| Candidate quality compared with requested spec | `02_Functional_Requirements.md` FR-FS-003 |
| Candidate below spec needs warning/acknowledgment | `08_Forecast_Sales_FCO_Revision.md` BR-FS-007 |
| Blending simulation embedded inside Forecast Sales | `02_Functional_Requirements.md` FR-FS-004 |
| Rough P&L generated automatically and restricted | `02_Functional_Requirements.md` FR-FS-005 |
| CEO approval before FCO | `02_Functional_Requirements.md` FR-FS-006 |
| FCO number auto generated and unique | `02_Functional_Requirements.md` FR-FS-007 |
| FCO PDF cannot download before approved | `02_Functional_Requirements.md` FR-FS-007; `08_Forecast_Sales_FCO_Revision.md` BR-FS-002 |
| FCO template based on provided sample | `02_Functional_Requirements.md` FR-FS-007; `08_Forecast_Sales_FCO_Revision.md` FCO Generator Requirement |
| Buyer feedback: pending/negotiation/deal/failed | `02_Functional_Requirements.md` FR-FS-008 |
| Failed reason required and CEO notified | `02_Functional_Requirements.md` FR-FS-008 |
| Deal carries data to Shipment Monitor | `02_Functional_Requirements.md` FR-FS-009 |
| Price and laycan revision log | `02_Functional_Requirements.md` FR-FS-011 |
| Forecast Sales dashboard metrics | `02_Functional_Requirements.md` FR-FS-010 |
| Shipment Monitor data completeness percentage | `02_Functional_Requirements.md` FR-SH-005; `08_Forecast_Sales_FCO_Revision.md` Shipment Data Completeness Requirement |

## 2. Module Revision Matrix Coverage

| Existing Module | Required Change in Revision Matrix | Covered By SRS |
|---|---|---|
| Dashboard | Alert-based control tower | `03_Module_Requirements.md` section Dashboard |
| Partners & Directory | Master data dropdown for parties | `03_Module_Requirements.md` section Partners & Directory |
| Forecast Sales | Master forecast/offer/FCO card, link shipment | `02_Functional_Requirements.md` FR-FS-001 to FR-FS-011 |
| Sales Monitor | Funnel monitoring layer for Forecast Sales | `03_Module_Requirements.md` Sales Monitor |
| Market Price | Reference engine and price warning | `02_Functional_Requirements.md` FR-MP-001 |
| Shipment Monitor | Sub-tabs, workflow logic | `02_Functional_Requirements.md` FR-SH-001 |
| Source | Confirmation workflow, legal, cargo readiness | `02_Functional_Requirements.md` FR-SRC-001 |
| Quality | QC/PSI/COA comparison | `02_Functional_Requirements.md` FR-QLT-001, FR-QLT-002 |
| Blending Simulasi | Connect to Sales/Source/Quality | `03_Module_Requirements.md` section Blending Simulation |
| Transshipment / Freight | Link to shipment/P&L | `02_Functional_Requirements.md` FR-FRT-001 |
| Outstanding Payment | Link invoice/payment to shipment | `02_Functional_Requirements.md` FR-PAY-001 |
| P&L | Pull data from modules | `02_Functional_Requirements.md` FR-PL-001 |
| Expenses | Related shipment/Forecast Sales | `03_Module_Requirements.md` section Expenses |
| Tasks | Link to shipment/Forecast Sales/issue | `03_Module_Requirements.md` section Tasks |
| Meeting | Link to Forecast Sales/shipment, action tasks | `03_Module_Requirements.md` section Meeting |
| AI Excel Agent | Supporting import/compare, not main flow | `03_Module_Requirements.md` section AI Excel Agent |

## 3. Added Submodules Coverage

| Added Submodule | Revision Requirement | Covered By SRS |
|---|---|---|
| Source Change Traceability | Old/new source, reason, evidence, CEO approval, active version | `02_Functional_Requirements.md` FR-SCT-001, BR-SCT-001 |
| Shipping Instruction Management | H-10 rule, PDF, version control, approval | `02_Functional_Requirements.md` FR-SI-001 to FR-SI-003 |
| Barge Change Log | Old/new TB/BG, reason, evidence, active version | `02_Functional_Requirements.md` FR-BCL-001 |
| Domestic Document Handover | SKAB, DSR, BL/CM, COA, full set docs, aging | `02_Functional_Requirements.md` FR-DDH-001; `04_Document_Management.md` |
| Document Checklist with Aging | Status, dates, owner, upload, aging | `02_Functional_Requirements.md` FR-DOC-001 |
| Quality Comparison | Contract vs QC/PSI/COA | `02_Functional_Requirements.md` FR-QLT-002 |
| Closing Checklist | Mandatory docs/final qty/quality/payment/issue | `05_Roles_Status_Approval_Audit.md` Closing Checklist |
| Approval Center | FCO, early SI, SI revision, source change | `05_Roles_Status_Approval_Audit.md` Approval Center |
| Audit Trail | User, time, old/new value | `05_Roles_Status_Approval_Audit.md` Audit Trail |

## 4. Document Input Matrix Coverage

| Document Type | Required Input Location | Covered By SRS |
|---|---|---|
| FCO / Full Corporate Offer | Forecast Sales | `04_Document_Management.md` FCO; `08_Forecast_Sales_FCO_Revision.md` |
| MoM / price confirmation / PO | Forecast Sales / Sales Monitor | `04_Document_Management.md` Commercial |
| Buyer contract | Forecast Sales / Shipment Commercial Reference | `04_Document_Management.md` Commercial |
| Supplier/source contract | Source | `04_Document_Management.md` Source / Legal |
| IUP OP / legal source docs | Source | `04_Document_Management.md` Source / Legal |
| RKAB / Kuota Export | Source | `04_Document_Management.md` Source / Legal |
| Cargo readiness evidence | Source | `04_Document_Management.md` Source Evidence |
| QC Result | Quality | `04_Document_Management.md` Quality |
| PSI Result | Quality | `04_Document_Management.md` Quality |
| COA POL | Quality | `04_Document_Management.md` COA |
| COA POD | Quality | `04_Document_Management.md` COA |
| SI | Shipment Monitor - SI Management | `04_Document_Management.md` SI |
| VesNom / Stowage Plan | Shipment Monitor - Checklist | `04_Document_Management.md` Export Shipment Docs |
| BL / CM | Shipment Monitor - Checklist | `04_Document_Management.md` Export/Domestic docs |
| PEB / LHV / Surveyor LS | Shipment Monitor - Checklist | `04_Document_Management.md` Export docs |
| SKAB-SK | Domestic Document Handover | `04_Document_Management.md` Domestic Document Handover |
| DSR Carbon | Domestic Document Handover | `04_Document_Management.md` Domestic Document Handover |
| POD Report / Weightbridge | Shipment Monitor | `04_Document_Management.md` POD Docs |
| Invoice / full set docs | Outstanding Payment + Shipment reference | `04_Document_Management.md` Payment Docs |
| Freight invoice / SPAL / PBM / PNBP | Transshipment / Freight | `04_Document_Management.md` Freight / Cost Docs |

## 5. Role Ownership Coverage

| Role Rule | Covered By SRS |
|---|---|
| Sales/Traffic owns commercial and shipment execution | `01_SRS_Master.md` User Roles; `05_Roles_Status_Approval_Audit.md` |
| Source Team owns source/legal/cargo readiness | `01_SRS_Master.md`; `02_Functional_Requirements.md` FR-SRC-001 |
| Domestic Source Team stops at sourcing | `02_Functional_Requirements.md` FR-SRC-002 |
| Quality Team owns QC/PSI/COA/comparison | `02_Functional_Requirements.md` FR-QLT |
| CEO approves FCO/early SI/SI revision/source change | `05_Roles_Status_Approval_Audit.md` Approval Center |
| Admin/Finance supports master/payment/expenses | `01_SRS_Master.md` Role section |

## 6. Rules Coverage

| Rule from Revision Docs | Covered By SRS |
|---|---|
| Deal confirmed creates shipment | FR-FS-009 |
| Domestic Source Team only sourcing | FR-SRC-002 |
| Barge change must create log | FR-BCL-001 |
| Source change must create traceability | FR-SCT-001 |
| SI normal only H-10 | BR-SI-001 |
| SI before H-10 needs CEO approval | BR-SI-001 and Approval Center |
| SI revision needs revision log | FR-SI-002 |
| Quality compare contract vs QC/PSI/COA | FR-QLT-002 |
| Documents need status/date/aging/upload | FR-DOC-001 |
| Shipment cannot close if mandatory data incomplete | Closing Checklist |
| Issue/Hold/Cancelled needs reason | Issue Log and Status Rules |
| P&L should pull data automatically | FR-PL-001 |

## 7. Roadmap Coverage

| Roadmap Item | SRS Location |
|---|---|
| Forecast Sales + FCO workflow | FR-FS-001 to FR-FS-011; `08_Forecast_Sales_FCO_Revision.md` |
| Connect Forecast Sales/Sales to Shipment | FR-FS-009 |
| Shipment Monitor sub-tabs | FR-SH-001 and Module Requirements |
| Barge Change Log | FR-BCL-001 |
| Document Checklist + Aging | FR-DOC-001 and Document Management |
| Role ownership | Roles matrix |
| SI Management H-10 | FR-SI and Approval Center |
| Source Change Traceability | FR-SCT |
| Quality comparison | FR-QLT |
| Domestic Document Handover | FR-DDH |
| Payment/Freight/P&L integration | FR-PAY, FR-FRT, FR-PL |
| Dashboard alerts | FR-DSH |
| Approval Center | Approval Center |
| AI Excel Agent | Module Requirements |

## 8. Coverage Conclusion

Seluruh major revision dari 3 dokumen sudah tercakup dalam SRS ini. Area yang harus dianggap paling prioritas:

1. Forecast Sales + FCO workflow replacing Projects.
2. Shipment Monitor sub-tab workflow.
3. Shipment data completeness score.
4. Document Checklist with Aging.
5. Barge Change Log.
6. SI Management per shipment with H-10 and revision history.
7. Source Change Traceability.
8. Quality Comparison.
9. Closing validation.
10. Dashboard alert-based control tower.
