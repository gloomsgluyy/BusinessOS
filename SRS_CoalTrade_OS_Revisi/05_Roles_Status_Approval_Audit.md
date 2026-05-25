# Roles, Status, Approval, and Audit SRS

## 1. Role Ownership Matrix

| Process / Section | Sales / Traffic | Source Team | Quality Team | CEO / System Rule |
|---|---|---|---|---|
| Forecast Sales / Offer Profile | Input and own | View supplier/source related | View if quality related | CEO approval before FCO generation |
| Forecast Sales Deal | Create, maintain, convert | View | View | Deal triggers shipment creation |
| Commercial Header | Input and own | View | View | Must link to shipment |
| Source Confirmation | Request and monitor | Input and own | View/validate if quality related | Source not ready requires reason/date |
| Domestic Source Scope | Receives sourcing result | Sourcing only | View | Final domestic TB/BG is Sales/Traffic |
| Source Change | Can request | Input new source/evidence | Re-check quality impact | CEO approval required |
| QC/PSI | View and monitor | Provide source info | Input and own | Warning blocks closing |
| COA POL / COA POD | View/use for docs/payment | View | Input/verify and own | Missing COA alerts dashboard |
| SI per Shipment | Create/issue/revise | Receive if supplier related | View if quality affected | H-10 and CEO approval rules |
| Final MV/TB/BG | Input and own | View | View | Change creates Barge Change Log |
| POL/POD Timeline | Input and own | View/source remarks | View | Status based on milestone |
| Document Checklist | Upload shipment docs | Upload source docs | Upload quality docs | Aging auto calculated |
| Payment Tracking | Monitor/update docs/payment status | View | View | Overdue alert |
| Rough P&L | No access to restricted values unless allowed | View limited source cost if allowed | View quality impact | CEO/management restricted |
| Shipment Closing | Request/complete | View | Quality must be final | Block if incomplete |

## 2. Permission Principles

### PER-001 Owner Can Edit

Role owner dapat create/update data di module miliknya.

### PER-002 Related Roles Can View

Role lain dapat view data yang dibutuhkan untuk workflow, tetapi tidak selalu edit.

### PER-003 Management Can Approve

CEO/Management memiliki approval action untuk requirement yang butuh approval.

### PER-004 Critical Action Requires Audit

Critical update wajib menghasilkan audit trail.

## 3. Status Flow

### 3.1 Forecast Sales / Offer Status

1. Draft
2. Submitted to CEO
3. CEO Review
4. Revision Requested
5. Approved
6. Rejected
7. FCO Sent
8. Waiting Buyer Feedback
9. Negotiation / Pending
10. Deal
11. Failed
12. Converted to Shipment

Rules:

- Draft dapat incomplete.
- Submitted to CEO wajib mandatory fields complete.
- Approved membuka FCO generation/download.
- FCO Sent mencatat sent by dan sent at.
- Deal dapat create Shipment.
- Converted to Shipment harus menyimpan Shipment ID.
- Failed harus punya reason.
- Failed harus mengirim alert ke CEO/management.
- Price, quantity, supplier, selected supplier, sales term, dan laycan revision harus masuk revision log.

### 3.2 Source Status

1. Waiting Source Confirmation
2. Legal Review
3. Cargo Checking
4. Cargo Ready
5. Partial Ready
6. Not Ready
7. Source Submitted

Rules:

- Partial Ready dan Not Ready wajib reason dan estimated readiness date.
- Legal Review dapat memblokir source active.

### 3.3 Quality Status

1. Waiting QC
2. QC Completed
3. Waiting PSI
4. PSI Completed
5. Waiting COA POL
6. COA POL Received
7. Waiting COA POD
8. COA POD Received
9. Passed
10. Warning
11. Claim Potential

Rules:

- Warning/Claim Potential harus reviewed.
- Closing blocked jika mandatory quality missing atau warning unresolved.

### 3.4 Shipment Status

1. Draft Shipment
2. Waiting Source Confirmation
3. Waiting Quality Check
4. Waiting Nomination
5. Ready for Loading
6. Loading
7. BL Issued
8. Docs Processing
9. In Transit
10. Arrived at POD
11. Discharging
12. Waiting COA POD
13. Waiting Payment
14. Paid
15. Closed
16. Issue / Hold
17. Cancelled

Rules:

- Side status Issue/Hold/Cancelled wajib reason dan evidence.
- Status dapat berubah otomatis dari milestone jika data tersedia.
- Closed hanya melalui closing validation.

## 4. Approval Center

### 4.1 Purpose

Approval Center mengumpulkan approval yang sebelumnya rawan lewat chat/manual.

### 4.2 Approval Types

1. FCO approval
2. Offer profile approval
3. FCO revision approval if required
4. Early SI approval
5. SI revision approval
6. SI cancellation approval
7. Source change approval
8. Optional barge change approval
9. High-risk issue acknowledgment

### 4.3 Approval Fields

- approval ID,
- approval type,
- linked module,
- linked entity ID,
- requester,
- requested date,
- reason,
- evidence,
- status Waiting/Approved/Rejected/Acknowledged,
- approver,
- approved/rejected date,
- comments,
- audit reference.

### 4.4 Approval Rules

#### APR-001 Forecast Sales and FCO

FCO generation/download is blocked until Forecast Sales offer profile is Approved. Rejected offer profile cannot generate FCO. Revision Requested requires trader update and resubmission.

#### APR-002 Early SI

If SI issue date is earlier than H-10 from first laycan, approval is required.

#### APR-003 SI Revision

Every SI revision requires revision reason, evidence, and CEO approval/acknowledgment.

#### APR-004 Source Change

New source cannot become active before CEO approval and new source contract approved/active.

#### APR-005 Rejection

Rejected approval must block related action and keep request history.

## 5. Audit Trail

### 5.1 Purpose

Audit trail memastikan perubahan data penting dapat dilacak.

### 5.2 Audit Fields

- audit ID,
- entity type,
- entity ID,
- module,
- action,
- field name,
- old value,
- new value,
- changed by,
- changed at,
- reason,
- evidence reference,
- approval reference if any.

### 5.3 Critical Events

Audit required for:

- Forecast Sales status change,
- Forecast Sales price/quantity/laycan/supplier candidate change,
- FCO generation,
- FCO sent to buyer,
- FCO revision/cancellation,
- convert Forecast Sales to shipment,
- source change request,
- source active version change,
- barge/MV/TB/BG nomination change,
- SI generation,
- SI revision,
- SI cancellation,
- shipment status to Issue/Hold/Cancelled/Closed,
- document delete/replace,
- quality warning review,
- payment status change,
- P&L restricted value change.

## 6. Closing Checklist

### 6.1 Closing Fields

- final quantity,
- BL quantity,
- POD quantity,
- loss/gain cargo,
- all mandatory docs complete,
- quality status final,
- payment status clear or exception reason,
- SI status final,
- source/barge/SI revisions closed,
- open issues closed or reasoned,
- closing requested by,
- closing approved/confirmed by if needed,
- closed at.

### 6.2 Closing Blocker Rules

Shipment cannot be Closed if:

1. mandatory document status is Pending/Received but not Completed,
2. required upload missing,
3. final quantity missing,
4. mandatory quality missing,
5. quality warning unresolved,
6. payment status unresolved,
7. SI approval pending,
8. source change approval pending,
9. barge change status pending,
10. Issue/Hold/Cancelled reason missing.

### 6.3 Closing Output

Output after successful close:

- shipment status Closed,
- closed date,
- closing summary,
- final P&L snapshot,
- document completion snapshot,
- quality snapshot,
- payment snapshot.
