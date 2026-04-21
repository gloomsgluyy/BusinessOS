import React, { Suspense } from "react";
import DirectoryPageClient from "./client";
import { DirectorySkeleton } from "./directory-skeleton";

export default function Page() {
    return (
        <Suspense fallback={<DirectorySkeleton />}>
            <DirectoryPageClient />
        </Suspense>
    );
}

