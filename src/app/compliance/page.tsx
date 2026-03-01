import React, { Suspense } from "react";
import ComplianceClient from "./client";

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ComplianceClient />
        </Suspense>
    );
}

