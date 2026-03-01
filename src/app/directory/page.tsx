import React, { Suspense } from "react";
import DirectoryPageClient from "./client";

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DirectoryPageClient />
        </Suspense>
    );
}

