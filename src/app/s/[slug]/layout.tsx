export default function PublicSchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-full bg-white text-zinc-950">{children}</div>;
}
