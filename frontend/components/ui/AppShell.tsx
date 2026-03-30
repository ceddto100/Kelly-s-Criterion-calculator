import React from 'react';

export function AppShell({
  sidebar,
  topbar,
  main,
  aside,
}: {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  main: React.ReactNode;
  aside: React.ReactNode;
}) {
  return (
    <div className="cc-shell">
      <aside className="cc-sidebar">{sidebar}</aside>
      <div className="cc-main-column">
        <header className="cc-topbar">{topbar}</header>
        <main className="cc-content">{main}</main>
      </div>
      <aside className="cc-context">{aside}</aside>
    </div>
  );
}

export function Card({ title, subtitle, actions, children }: { title?: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="cc-card">
      {(title || subtitle || actions) && (
        <div className="cc-card-header">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function MetricCard({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="cc-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {delta && <small>{delta}</small>}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="cc-empty-state">
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  );
}
