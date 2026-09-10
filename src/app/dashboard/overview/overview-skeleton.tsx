export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-6 w-40 rounded-md bg-muted" />
          <div className="flex gap-2">
            <div className="h-9 w-20 rounded-md bg-muted" />
            <div className="h-9 w-20 rounded-md bg-muted" />
          </div>
        </div>
        <div className="h-4 w-64 max-w-full rounded-md bg-muted" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-1 md:grid-cols-3 md:divide-x md:divide-border">
          {["upcoming", "leads", "conversion"].map((key) => (
            <div key={key} className="flex flex-col gap-2 p-4 md:p-5">
              <div className="h-4 w-36 rounded-md bg-muted" />
              <div className="h-8 w-16 rounded-md bg-muted" />
              <div className="h-3.5 w-44 rounded-md bg-muted" />
              <div className="h-3.5 w-24 rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
      <div className="h-5 w-56 rounded-md bg-muted" />
      <div className="h-5 w-32 rounded-md bg-muted" />
    </div>
  );
}
