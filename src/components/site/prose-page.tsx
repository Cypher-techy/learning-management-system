export function ProsePage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">{title}</h1>
      {updated && <p className="mt-1 text-sm text-muted-foreground">Last updated: {updated}</p>}
      <div className="prose-lms mt-6">{children}</div>
    </div>
  );
}
