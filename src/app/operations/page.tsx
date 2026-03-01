import React, { Suspense } from "react";
import OpsClient from "./client";

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <OpsClient />
        </Suspense>
    );
}

