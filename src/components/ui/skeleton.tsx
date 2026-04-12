import { cn } from "@/lib/utils";
import { DISABLE_SKELETON_LOADERS } from "@/lib/feature-flags";

function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    if (DISABLE_SKELETON_LOADERS) return null;

    return (
        <div
            className={cn("animate-pulse rounded-md bg-muted/50", className)}
            {...props}
        />
    );
}

export { Skeleton };
