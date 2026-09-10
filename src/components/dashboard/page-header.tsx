export function PageHeader({ title }: { title: string }) {
  return (
    <h1 className="text-[1.375rem] leading-tight font-semibold tracking-tight md:text-2xl">
      {title}
    </h1>
  );
}
