export function CategoryHeading({
  title,
  purpose,
}: {
  title: string;
  purpose: string;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-1">
      <h2 className="scroll-mt-20 text-pretty text-lg font-medium tracking-tight">
        {title}
      </h2>
      <p className="text-pretty text-sm text-zinc-400">{purpose}</p>
    </div>
  );
}
