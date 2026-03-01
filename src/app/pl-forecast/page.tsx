import React, { Suspense } from "react";
import PlClient from "./client";

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PlClient />
        </Suspense>
    );
}

