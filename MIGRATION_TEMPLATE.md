# DB-First Migration Template for API Routes

## Pattern to Follow (Already Applied to tasks/route.ts)

### Import Changes

```typescript
// REMOVE:
import { syncTasksFromSheet } from "@/app/actions/sheet-actions";
import {
  appendRow,
  upsertRow,
  deleteRow,
  findRowIndex,
} from "@/lib/google-sheets";

// ADD:
import { PushService } from "@/lib/push-to-sheets";

// ADD helper function:
async function triggerPush() {
  PushService.debouncedPush("MODEL_NAME").catch((err) =>
    console.error("Optional Sheet push failed:", err),
  );
}
```

### GET Handler

```typescript
// REMOVE: All syncFromSheet() logic
// REPLACE WITH: Direct DB query

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // DATABASE-FIRST: Read directly from database
  const items = await prisma.MODEL_NAME.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, items });
}
```

### POST Handler

```typescript
// REMOVE: All appendRow() calls
// ADD: await triggerPush() at the end

export async function POST(req: Request) {
    // ... validation code ...

    // DATABASE-FIRST: Write to database as primary source
    const item = await prisma.$transaction(async (tx) => {
        const newItem = await tx.MODEL_NAME.create({ data: {...} });
        await tx.auditLog.create({ data: {...} });
        return newItem;
    });

    // Optional push to Sheets for backup/export
    await triggerPush();

    return NextResponse.json({ success: true, item });
}
```

### PUT Handler

```typescript
// REMOVE: All upsertRow() calls
// ADD: await triggerPush() at the end

export async function PUT(req: Request) {
    // ... validation code ...

    // DATABASE-FIRST: Update database as primary source
    const item = await prisma.$transaction(async (tx) => {
        const updatedItem = await tx.MODEL_NAME.update({ where: {...}, data: {...} });
        await tx.auditLog.create({ data: {...} });
        return updatedItem;
    });

    // Optional push to Sheets for backup/export
    await triggerPush();

    return NextResponse.json({ success: true, item });
}
```

### DELETE Handler

```typescript
// REMOVE: All findRowIndex() and deleteRow() calls
// ADD: await triggerPush() at the end

export async function DELETE(req: Request) {
    // ... validation code ...

    // DATABASE-FIRST: Delete from database as primary source
    await prisma.$transaction(async (tx) => {
        await tx.MODEL_NAME.update({ where: { id }, data: { isDeleted: true } });
        await tx.auditLog.create({ data: {...} });
    });

    // Optional push to Sheets for backup/export
    await triggerPush();

    return NextResponse.json({ success: true });
}
```

## Model Name Mapping for triggerPush()

- `shipments/route.ts` → `"shipmentDetail"`
- `meetings/route.ts` → `"meetingItem"`
- `quality/route.ts` → `"qualityResult"`
- `market-prices/route.ts` → `"marketPrice"`
- `sources/route.ts` → `"sourceSupplier"`
- `purchases/route.ts` → `"purchaseRequest"`
- `sales-deals/route.ts` → `"salesDeal"`
