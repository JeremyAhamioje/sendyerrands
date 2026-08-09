import { NavLink, Outlet } from 'react-router-dom';

import logo from '@/assets/logo.png';

import { useAuth } from '@/lib/auth';
import { useDashboard } from '@/lib/hooks';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/orders', label: 'Orders' },
  { to: '/riders', label: 'Riders' },
  { to: '/requests', label: 'Requests' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/applications', label: 'Applications' },
] as const;

export function Layout() {
  const { admin, signOut } = useAuth();
  // Only used for the queue badge; the dashboard page owns the real polling.
  const { data: stats } = useDashboard();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-none flex-col border-r border-hairline bg-white">
        <div className="flex items-center gap-2.5 px-5 py-5">
          {/*
            The logo sits on brand pink, not on the white sidebar.

            logo.png is a near-white line drawing — 95% of its visible pixels
            have luminance above 240, on a 63%-transparent background. Placed
            directly on white it renders perfectly and is invisible, which reads
            as a broken image rather than a contrast problem. Pink is the
            background it was drawn for.

            Imported rather than served from /public so Vite fingerprints it: an
            ops tool left open all day should not keep a stale logo after a
            rebrand.
          */}
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-pink-600 p-1">
            <img src={logo} alt="Sendy" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-ink">Sendy</p>
            <p className="text-[11px] leading-tight text-muted">Operations</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const badge = item.to === '/riders' ? stats?.pendingVerifications : undefined;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isActive ? 'bg-pink-50 text-pink-600' : 'text-body hover:bg-surface'
                  }`
                }
              >
                {item.label}
                {badge ? (
                  <span className="rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-hairline px-5 py-4">
          <p className="truncate text-[13px] font-semibold text-ink">{admin?.name}</p>
          <p className="truncate text-[11px] text-muted">{admin?.email}</p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-pink-600">
            {admin?.role.toLowerCase()}
          </p>
          <button
            onClick={signOut}
            className="mt-3 text-[13px] font-semibold text-body hover:text-error"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="border-b border-hairline bg-white px-8 py-5">
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
    </header>
  );
}
