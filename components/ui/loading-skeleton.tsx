import { FC } from "react";
import { Card } from "./card";
import { Skeleton } from "./skeleton";

/**
 * Loading Skeletons for different content types
 *
 * Provides visual feedback while async content is loading.
 * Matches the layout of actual content for smooth transitions.
 */

export const BillCardSkeleton: FC = () => {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-5 w-full mb-1" />
          <Skeleton className="h-5 w-3/4" />
        </div>
        <Skeleton className="h-8 w-20 ml-4" />
      </div>
      <div className="flex gap-4 mb-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6" />
    </Card>
  );
};

export const RepresentativeCardSkeleton: FC = () => {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </Card>
  );
};

export const BriefCardSkeleton: FC = () => {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div className="flex-1">
          <Skeleton className="h-5 w-48 mb-1" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-4/5" />
    </Card>
  );
};

export const ListSkeleton: FC<{
  count?: number;
  type?: "bill" | "representative" | "brief";
}> = ({ count = 3, type = "bill" }) => {
  const SkeletonComponent =
    type === "representative" ? RepresentativeCardSkeleton :
    type === "brief" ? BriefCardSkeleton :
    BillCardSkeleton;

  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonComponent key={i} />
      ))}
    </div>
  );
};

export const PageLoadingSkeleton: FC<{ title?: string }> = ({ title = "Loading..." }) => {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4">
        <BillCardSkeleton />
        <BillCardSkeleton />
        <BillCardSkeleton />
      </div>
    </div>
  );
};
