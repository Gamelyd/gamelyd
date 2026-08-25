import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  children,
  width = "max-w-7xl",
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  width?: string;
}) {
  return (
    <section className="border-b border-surface-2 bg-bg">
      <div className={`mx-auto px-5 py-10 lg:py-12 ${width}`}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {kicker ? (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {kicker}
              </p>
            ) : null}
            <h1
              className={`font-display text-4xl leading-none text-white md:text-5xl ${kicker ? "mt-1" : ""}`}
            >
              {title}
            </h1>
            {description ? (
              <div className="mt-3 max-w-2xl text-body">{description}</div>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
