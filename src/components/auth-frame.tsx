export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg px-4 py-16 text-fg">
      <div className="mx-auto w-full max-w-md rounded-[28px] border border-border bg-surface p-6 sm:p-8">
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        <p className="mb-6 mt-2 text-[14px] text-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
