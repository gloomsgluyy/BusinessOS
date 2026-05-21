# Software Requirements Specification
# Business OS / CoalTradeOS - Production Finalization

Version: 1.0  
Date: 2026-05-21  
Repository: 11GAWE  
Target quality level: Production grade  
Primary audience: Product owner, engineering team, AI agents, QA, deployment owner

---

## 1. Purpose

This SRS defines the final requirements needed to move Business OS / CoalTradeOS from the current advanced pre-production state into a production-grade release.

It consolidates:

- Formal handover context from `Handover_Document.pdf` dated 2026-05-06.
- Existing project documentation and implementation notes.
- Current codebase state observed in the local workspace.
- Remaining gaps from migration verification, security review, RBAC, AI features, and UI finalization.

The document is intended to become the single reference for finalization work. Older requirement documents remain useful background, but this SRS should be treated as the final execution contract unless explicitly superseded.

---

## 2. Product Scope

Business OS / CoalTradeOS is an internal web platform for coal trading operations. It supports executive monitoring, sales operations, shipment tracking, market price intelligence, quality control, partner management, project workflows, financial forecasting, AI assistance, and operational risk analysis.

### 2.1 Core Business Goals

- Provide one trusted operational database for business activity.
- Track sales, shipments, sourcing, quality, market prices, outstanding payments, and projects.
- Enforce role-based access across 27 organizational roles.
- Support production-ready AI assistance for business decision support.
- Support auditability, security, and operational accountability.
- Prepare the application for stable VPS/Node.js deployment.

### 2.2 Final Architecture Decision

The final architecture is Database-First.

- PostgreSQL/Neon is the primary source of truth.
- Prisma is the canonical data access layer.
- Google Sheets is optional export/backup only.
- Automatic Sheets-first sync is not part of the production baseline.
- Any re-enabled Sheets export must be guarded by `ENABLE_SHEETS_SYNC=true` and a maintenance bearer token.

---

## 3. Source Documents And Status

| Source | Status | Notes |
| --- | --- | --- |
| `Handover_Document.pdf` | Primary handover source | Declares production-ready product direction and upcoming features. |
| `DATABASE_FIRST_MIGRATION.md` | Accepted architecture | Confirms DB-first mode and optional Sheets export. |
| `MIGRATION_GUIDE.md`, `START_HERE.md`, `START_MIGRATION.md` | Historical data migration guide | Scripts exist, but current local verification does not pass. |
| `INSTRUKSI_PENDING_SHIPMENT_DAN_PAGINATION.md` | Implementation instruction | Status reason and pagination are partially implemented. |
| `AI_RISK_ANALYSIS_INSTRUCTION.md`, `ai_agent_prompt_risk_analysis.md` | AI risk feature plan | Core risk-analysis API exists; mitigation and external data hardening remain. |
| `RBAC_Documentation.md`, `RBAC_IMPLEMENTATION_GUIDE.md` | RBAC reference | Enum roles and core role management are implemented; must be regression-tested. |
| `sast_security_report.md` | Security baseline | Several high/medium issues are already patched; final production audit still required. |

---

## 4. Current Local Status Snapshot

Observed on 2026-05-21.

### 4.1 Branch And Repository State

- Active branch: `testing`.
- Latest local `testing` commit: `472137a Upgrade AI decision helper reports`.
- `hubbi/main` points to the same latest commit.
- Local `main`, `origin/main`, and `origin/testing` are behind or divergent from the local active branch.
- Worktree contains untracked PDF files. They must not be deleted or overwritten without owner approval.

### 4.2 Data Migration Verification

Running `node scripts/verify-migration.js` currently fails:

| Entity | Current Count |
| --- | ---: |
| Partner | 276 |
| ShipmentDetail | 1145 |
| DailyDelivery | 164 |
| QualityResult | 0 |
| Total migrated | 1309 |

Current migration issues:

- Total migrated records below historical target of 2,157.
- QualityResult is empty while 33 shipments contain GAR data.
- 818 ShipmentDetail records are incomplete.
- 164 DailyDelivery records are incomplete.
- 8 buyers are not present in Partner table.
- Some GAR values are outside typical coal range.

Production release must not rely on this local migrated dataset until the migration outcome is reconciled and approved.

---

## 5. Production Grade Definition

The application is production grade only when all P0 requirements are complete and verified.

### 5.1 P0 Release Gates

- `npm run build` succeeds without TypeScript or Next.js build errors.
- Prisma client generation succeeds.
- Database migrations/schema are aligned with production Neon database.
- Authentication and RBAC are enforced on all protected pages and mutating API routes.
- No known critical or high security issues remain open.
- Historical data migration is either verified successfully or formally waived with an approved migration count report.
- Core modules pass manual smoke QA.
- Deployment runbook exists and can start the app with PM2.
- Secrets are provided only through environment variables and are rotated if ever exposed.

### 5.2 P1 Release Gates

- All primary list pages have usable pagination or bounded rendering.
- AI decision reports show source attribution and data-quality confidence.
- Shipment risk analysis includes mitigation recommendation.
- Dashboard and Shipment Monitor UX match the final agreed operating model.
- Error and empty states are clear for non-technical users.

### 5.3 P2 Release Gates

- Advanced automation features, such as full Weather API, News API urgency analysis, and legal deadline reminders, are completed or feature-flagged.
- Performance telemetry and backup/restore drills are documented.
- Unused legacy code and docs are archived.

---

## 6. Users And Roles

The system must support the `UserRole` enum in Prisma with 27 roles.

Major role groups:

- Executive: CEO, DIRUT, ASS_DIRUT, COO.
- Commercial and trading: CMO, TRADERS roles, JUNIOR_TRADER, ADMIN_MARKETING.
- Traffic and logistics: TRAFFIC_HEAD, TRAFFIC_TEAM_1 to TRAFFIC_TEAM_4.
- Operation: ADMIN_OPERATION.
- Sourcing: CPPO, SPV_SOURCING, SOURCING_OFFICER_1 to SOURCING_OFFICER_4.
- Quality: QQ_MANAGER, QC_MANAGER, QC_ADMIN_1, QC_ADMIN_2.
- General: STAFF.

### 6.1 RBAC Requirements

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| RBAC-001 | All routes must require an authenticated session unless explicitly public. | P0 | Unauthorized access returns redirect or 401. |
| RBAC-002 | Mutating API routes must verify role permissions server-side. | P0 | Write attempts by unauthorized roles return 403. |
| RBAC-003 | CEO role management must not allow a CEO to downgrade their own role. | P0 | API and UI both prevent self-role mutation. |
| RBAC-004 | UI navigation must hide inaccessible modules based on role. | P0 | Sidebar only shows allowed modules for the logged-in user. |
| RBAC-005 | Executive dashboard remains restricted to executive roles. | P0 | Non-executive users are redirected or denied. |
| RBAC-006 | Ownership-sensitive records must prevent IDOR. | P1 | PUT/DELETE checks ownership or allowed module roles. |

---

## 7. Functional Requirements

### 7.1 Authentication And Session

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| AUTH-001 | Users authenticate through NextAuth credentials provider. | P0 | Valid credentials create a JWT session. |
| AUTH-002 | Passwords are hashed with bcrypt. | P0 | No plaintext password is stored. |
| AUTH-003 | `NEXTAUTH_SECRET` is mandatory in all environments. | P0 | App fails fast if missing. |
| AUTH-004 | No auto-creation of CEO users is allowed in runtime login flow. | P0 | Initial CEO creation happens only through seed/admin process. |

### 7.2 Executive Dashboard

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| DASH-001 | Dashboard shows executive operational and financial summary. | P0 | Executive roles can view core metrics. |
| DASH-002 | Dashboard shows CEO activity log. | P0 | CEO can see user activity and attendance-related logs. |
| DASH-003 | Dashboard financial cards remain hidden from unauthorized roles. | P0 | Non-executive users cannot access sensitive financial data. |
| DASH-004 | Shipment dashboard tables must follow final UX decision: operational buckets or Local/Export split. | P1 | Product owner approves one layout; old contradictory layout docs are resolved. |
| DASH-005 | Dashboard load must not depend on full unbounded client-side data pulls. | P1 | Fast mode or pagination/bounding prevents UI stalls on large data. |

### 7.3 Shipment Monitor

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| SHIP-001 | MV/Barge shipment records support full CRUD for authorized traffic/operation roles. | P0 | Create, update, soft delete, and list work from UI and API. |
| SHIP-002 | On-going pending or waiting shipments must store a manual `statusReason`. | P0 | Reason persists after refresh and is visible in list and detail. |
| SHIP-003 | Missing on-going pending reason must trigger validation or default operational readiness reason. | P0 | API and UI enforce reason rules. |
| SHIP-004 | Shipment list must support search, status filter, year/date filter, sort, and pagination/bounded render. | P0 | Large dataset remains usable. |
| SHIP-005 | Risk analysis can be triggered by authorized roles. | P0 | `/api/shipments/[id]/risk-analysis` stores score, level, report, timestamp. |
| SHIP-006 | Risk analysis report must include source attribution, data quality, decision, and mitigation plan. | P1 | Detail modal displays structured report, not only raw score. |
| SHIP-007 | Demurrage data must be captured from Operational Info or manual fields. | P1 | Demurrage rate, source, currency, and updated timestamp persist. |
| SHIP-008 | Daily Delivery and Route Optimizer legacy tabs must match final handover decision. | P0 | If removed, they are hidden/archived from production UI; if retained, handover must be updated. |
| SHIP-009 | Shipment detail must support risk, timeline, overview, and operational context views. | P1 | Detail modal shows each view without layout overflow. |

### 7.4 Sales, P&L, And Outstanding Payment

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| SALES-001 | Sales Monitor supports sales deal CRUD and status tracking. | P0 | Authorized users can create/update deals. |
| SALES-002 | Sales Orders support approval workflow and image/document references where applicable. | P0 | Sales order records persist and audit logs are created. |
| PL-001 | P&L Forecast uses modal-based UI and DB-first writes. | P0 | Forecast CRUD works without Sheets dependency. |
| PL-002 | P&L calculations must remain deterministic. | P0 | Gross profit per MT and total gross profit are calculated consistently. |
| PAY-001 | Outstanding Payment supports full CRUD and status tracking. | P0 | Authorized roles can manage payment records. |
| PAY-002 | Outstanding Payment list must support pagination/bounded render. | P1 | Large records do not freeze the page. |

### 7.5 Projects

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| PROJ-001 | Projects support CRUD, approval workflow, and executive review. | P0 | Approval states persist and are visible on dashboard. |
| PROJ-002 | Project documents are stored in the database and linked to ProjectItem. | P0 | Upload/download/delete work for authorized users. |
| PROJ-003 | Template Project feature must provide reusable project checklists. | P1 | User can create project from template and see generated checklist. |
| PROJ-004 | AI Urgent Project Analysis must rank urgency using project context and external/news context when configured. | P2 | Report stores urgency score, level, reason, timestamp. |

### 7.6 Directory And Partners

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| DIR-001 | Directory stores buyer, vendor, supplier, and partner master data. | P0 | CRUD works and role restrictions apply. |
| DIR-002 | Partner due diligence AI report persists score, level, report, timestamp. | P1 | Detail UI displays report with source/data quality. |
| DIR-003 | Legal document deadline alert must warn before expiry. | P2 | Configurable reminder days trigger visible warning. |
| DIR-004 | Partner bootstrap from shipment/deal data must not create duplicate noisy partners. | P1 | Normalization rules are documented and tested. |

### 7.7 Market Price

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| MARKET-001 | Market Price tracks ICI 1-5, Newcastle, HBA, HBA I/II/III, and HPB values. | P0 | All required fields support create/read and display. |
| MARKET-002 | Market scraping endpoint requires auth, role permission, rate limit, and positive value validation. | P0 | Unauthorized users cannot trigger scraping. |
| MARKET-003 | Global background scraper runs only for authenticated users with market edit permission. | P1 | App boot schedules scraping without page-specific lifecycle dependency. |
| MARKET-004 | Price data must include source or proof information. | P1 | UI/API expose source field. |
| MARKET-005 | Market Price Comparison must compare market prices with historical sale/purchase data. | P2 | Traders can compare index against internal deal history. |
| MARKET-006 | LLM-generated market data must be clearly labeled or replaced by real source APIs before production-critical use. | P1 | No unverified AI price is presented as authoritative market data. |

### 7.8 AI Chat, Agent, MOM, And Decision Support

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| AI-001 | AI Chat endpoint requires auth, role access, rate limit, model allowlist, and input length limits. | P0 | Public/anonymous calls are rejected. |
| AI-002 | AI prompts must include anti-injection rules and avoid exposing internal secrets. | P0 | System prompt and sanitization are present. |
| AI-003 | AI Agent Excel Context answers from workbook metadata and samples. | P1 | Agent states missing data instead of hallucinating. |
| AI-004 | Meeting transcription converts uploaded audio/video into MOM and extracted tasks. | P1 | Upload, transcribe, summarize, and task extraction succeed for allowed files. |
| AI-005 | AI decision helper reports include structured decision, source attribution, data quality, and next action. | P1 | Report renderer can display these fields consistently. |

### 7.9 Google Sheets Export

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| SHEETS-001 | Google Sheets is disabled by default in production baseline. | P0 | `ENABLE_SHEETS_SYNC` absent/false skips push. |
| SHEETS-002 | Manual export requires bearer token and `ENABLE_SHEETS_SYNC=true`. | P0 | Missing/invalid token returns 403. |
| SHEETS-003 | Export failures must not block DB-first business operations. | P1 | CRUD operations remain successful if optional export fails. |

---

## 8. Data Requirements

### 8.1 Canonical Database

The Prisma schema is the canonical model definition. Production must include at minimum:

- User, Account, Session, VerificationToken.
- AuditLog.
- TaskItem.
- SalesOrder, SalesDeal, PLForecast.
- ShipmentDetail, TimelineMilestone.
- DailyDelivery only if retained as a production module or historical archive.
- SourceSupplier, QualityResult, MarketPrice.
- OutstandingPayment.
- MeetingItem, MeetingMedia, ChatHistory.
- ProjectItem, ProjectDocument.
- Partner.
- BlendingSimulation.

### 8.2 Historical Migration

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| DATA-001 | Historical Excel migration must have an approved target manifest. | P0 | Expected source sheets, row ranges, and target counts are documented. |
| DATA-002 | Migration script must import all required historical ShipmentDetail rows. | P0 | Verification meets approved count. |
| DATA-003 | DailyDelivery must be reconciled with handover decision. | P0 | Either archived/removed or verified as production data. |
| DATA-004 | QualityResult must be generated for shipments with valid GAR data. | P0 | QualityResult count matches approved GAR linkage rule. |
| DATA-005 | Partner normalization must prevent duplicate buyer/vendor aliases. | P0 | Known aliases are mapped and verifier reports no critical missing buyers. |
| DATA-006 | GAR values outside coal range must be flagged and corrected or approved as source anomalies. | P1 | QA report lists anomalies and disposition. |

### 8.3 Migration Release Decision

The previous documented target is 2,157+ records. If the real final Excel source no longer contains that many valid rows, the target may be updated only with an approved migration manifest and QA sign-off.

---

## 9. API Requirements

### 9.1 API Contract

All business API routes under `/api/memory/*` must:

- Require authenticated session.
- Enforce write permissions for POST/PUT/DELETE.
- Use DB-first reads and writes.
- Soft delete records where the model supports `isDeleted`.
- Write audit logs for mutating operations where applicable.
- Return consistent JSON responses.
- Support pagination for list endpoints when `page` or `pageSize` is provided.

### 9.2 Pagination Contract

When pagination is requested, API responses should include:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

Legacy response keys such as `shipments`, `tasks`, `prices`, and `partners` may remain for compatibility, but new components should prefer a consistent data/meta structure.

---

## 10. Non-Functional Requirements

### 10.1 Performance

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| PERF-001 | Primary pages must be usable with large production datasets. | P0 | No page renders unbounded thousands of complex rows without pagination/virtualization. |
| PERF-002 | Dashboard must use fast/bounded data loading. | P1 | Initial view loads without long blocking sync. |
| PERF-003 | Background polling must avoid request storms. | P1 | App-level polling is throttled and visibility-aware. |
| PERF-004 | API list routes should respond within acceptable latency for normal production data. | P1 | Slow routes are indexed or paginated. |

### 10.2 Security

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| SEC-001 | No real secrets may be committed. | P0 | `.env` remains untracked and secrets are in deployment env manager. |
| SEC-002 | Any secret ever committed or exposed must be rotated before production. | P0 | Rotation checklist completed. |
| SEC-003 | File upload must validate file type, MIME, size, and final path. | P0 | Path traversal test fails safely. |
| SEC-004 | Transcription must read only from allowed upload directory. | P0 | LFI attempts return 400/403. |
| SEC-005 | WhatsApp send endpoint requires auth. | P0 | Anonymous POST returns 401. |
| SEC-006 | Twilio webhook validates signature. | P0 | Invalid signature returns 403. |
| SEC-007 | Maintenance export endpoint requires bearer token. | P0 | Missing/invalid token returns 403. |
| SEC-008 | AI endpoints are rate limited. | P1 | Excess requests return 429. |
| SEC-009 | Mutating endpoints prevent IDOR. | P1 | Unauthorized edit/delete of another user's restricted record returns 403. |

### 10.3 Reliability

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| REL-001 | Database connection errors must produce safe user-facing errors. | P0 | No sensitive stack traces in client responses. |
| REL-002 | Optional integrations must degrade gracefully. | P1 | Missing AI/weather/sheets keys do not crash core app. |
| REL-003 | Audit logs should not block critical CRUD if logging fails. | P1 | CRUD may continue with logged warning if audit insert fails. |
| REL-004 | PM2 deployment must restart cleanly after server reboot. | P1 | Runbook includes startup command and env requirements. |

### 10.4 Usability

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| UX-001 | Production UI must avoid overlapping text and table overflow. | P0 | Manual QA on desktop and mobile widths passes. |
| UX-002 | Loading and empty states must exist for primary modules. | P1 | Users see clear state during data fetch and no-data results. |
| UX-003 | Error states must be actionable. | P1 | Errors tell user what failed without exposing secrets. |
| UX-004 | Legacy or removed features must not appear as dead controls. | P0 | Daily Delivery/Route Optimizer decision is reflected in UI. |

---

## 11. External Integrations

| Integration | Production Requirement | Priority |
| --- | --- | --- |
| Groq API | Chat and transcription only when configured; auth and rate limits required. | P0 |
| OpenRouter | AI decision/risk analysis fallback or primary model if configured. | P1 |
| Weather API | Upcoming automated Risk Analysis weather data. Must degrade if missing. | P2 |
| News API | Upcoming Project Urgency and risk context. Must degrade if missing. | P2 |
| BMKG | Public Indonesian risk signal source where relevant. | P1 |
| Stormglass/Marine API | Marine context for shipment risk where configured. | P2 |
| Twilio | WhatsApp notification/webhook with signature validation. | P1 |
| Google Sheets | Optional export/backup only. | P1 |

---

## 12. Testing And Verification Plan

### 12.1 Required Automated Checks

Run before production release:

```bash
npm install
npx prisma generate
npm run build
node test-database-first.js
node scripts/verify-migration.js
```

If `node scripts/verify-migration.js` is intentionally waived, attach an approved replacement migration report.

### 12.2 Manual Smoke QA

Required smoke scenarios:

- Login as CEO, Traffic Head, Admin Operation, Trader, Sourcing, QC, Staff.
- Verify sidebar modules match role permissions.
- Dashboard loads for executive roles and denies non-executive roles.
- Create, edit, and delete a shipment as allowed role.
- Create on-going pending shipment and confirm `statusReason` persists.
- Run shipment risk analysis as allowed role.
- Try shipment mutation as unauthorized role and confirm 403/blocked UI.
- Create/update sales deal and P&L forecast.
- Create/update partner and project.
- Upload valid and invalid files.
- Trigger chat request as allowed and denied role.
- Trigger market scrape as allowed and denied role.
- Export to Sheets with valid and invalid maintenance token if export is enabled.

### 12.3 Security Regression Checks

- Anonymous `/api/chat` returns 401.
- Anonymous `/api/upload` returns 401.
- Anonymous `/api/transcribe` returns 401.
- Anonymous `/api/whatsapp/send` returns 401.
- Invalid Twilio signature returns 403.
- Invalid maintenance bearer token returns 403.
- Path traversal filename is rejected.
- Missing `NEXTAUTH_SECRET` fails startup/build early.

---

## 13. Deployment Requirements

### 13.1 Environment Variables

Required:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Optional:

- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_RISK_MODEL`
- `WEATHER_API_KEY`
- `NEWS_API_KEY`
- `STORMGLASS_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `ENABLE_SHEETS_SYNC`
- `GOOGLE_SHEETS_ID`
- `GOOGLE_SHEETS_CREDENTIALS`
- `MAINTENANCE_SYNC_SECRET`

### 13.2 Build And Start

Production build:

```bash
npm run build
```

Production start:

```bash
npm run start
```

PM2 example:

```bash
pm2 start npm --name business-os -- start
```

### 13.3 Backup And Recovery

Production must define:

- Neon/PostgreSQL backup schedule.
- Restore test procedure.
- Optional Google Sheets export procedure.
- Rollback plan for failed deployments.

---

## 14. Backlog And Priority Execution Plan

### P0 - Must Complete Before Production Grade

1. Reconcile branch strategy and decide final production branch.
2. Run and fix `npm run build`.
3. Reconcile historical migration counts or approve a formal migration waiver.
4. Fix QualityResult generation or approve archive strategy.
5. Resolve Daily Delivery and Route Optimizer production status.
6. Complete RBAC regression across API and UI.
7. Complete security regression from SAST report.
8. Rotate any exposed or historical secrets.
9. Finalize deployment env and PM2 runbook.

### P1 - Should Complete For Stable Production

1. Finish/verify pagination and bounded rendering on primary pages.
2. Improve AI risk analysis UI to show mitigation, sources, and data quality.
3. Finalize Dashboard shipment table layout.
4. Add partner alias cleanup and duplicate normalization report.
5. Harden market price source/proof handling.
6. Add QA checklist results to release notes.

### P2 - Post-Production Enhancements

1. Template Project.
2. Weather API automation.
3. News API project urgency.
4. Legal document deadline alerts.
5. Market Price Comparison.
6. AI Agent full Excel Context improvements.
7. Observability dashboard and scheduled backup drills.

---

## 15. Definition Of Done

Production finalization is done when:

- All P0 release gates pass.
- Open P1/P2 items are either complete or explicitly deferred.
- Product owner approves final module list.
- Migration report is approved.
- Security checklist is signed off.
- Deployment runbook is tested.
- Production environment starts cleanly.
- Smoke QA passes for representative roles.

---

## 16. Open Decisions

| Decision | Owner | Required Before |
| --- | --- | --- |
| Which branch is the release source: `testing`, `hubbi/main`, or another branch? | Product/Tech owner | P0 release |
| Is DailyDelivery removed, archived, or retained? | Product owner | P0 release |
| Is Route Optimizer removed, archived, or retained? | Product owner | P0 release |
| Is historical migration target still 2,157+ records? | Product/Data owner | P0 release |
| Are LLM-derived market prices acceptable for internal reference only, or must real market APIs be integrated first? | Product/Commercial owner | P1 release |
| Which AI provider is primary for production risk analysis? | Tech owner | P1 release |

