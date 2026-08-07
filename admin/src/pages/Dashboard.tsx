import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/Layout';
import { Card, ErrorState, Loading, StatusPill } from '@/components/ui';
import { dateTime, fullName, naira, relative } from '@/lib/format';
import { useDashboard, useOrders } from '@/lib/hooks';

/** Statuses that still need someone to do something. */
const LIVE_STATUSES = 'PLACED,VENDOR_ACCEPTED,RIDER_ASSIGNED,PICKED_UP,IN_TRANSIT';

export function Dashboard() {
  const stats = useDashboard();
  // The list endpoint takes a single status, so pull recent orders and filter here.
  const orders = useOrders({});

  const live = (orders.data ?? []).filter((o) => LIVE_STATUSES.includes(o.status)).slice(0, 8);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Today at a glance. Refreshes every 30 seconds." />

      <div className="p-8">
        {stats.isLoading ? (
          <Loading />
        ) : stats.isError ? (
          <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Orders today" value={stats.data!.ordersToday} />
            <Kpi label="GMV today" value={naira(stats.data!.gmvTodayKobo)} />
            <Kpi label="Live orders" value={stats.data!.liveOrders} tone="info" />
            <Kpi label="Riders online" value={stats.data!.activeRiders} tone="success" />
            <Kpi
              label="Awaiting verification"
              value={stats.data!.pendingVerifications}
              tone={stats.data!.pendingVerifications > 0 ? 'warning' : undefined}
              to="/riders"
            />
            <Kpi label="Open requests" value={stats.data!.openRequests} to="/requests" />
          </div>
        )}

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-ink">Live orders</h2>
            <Link to="/orders" className="text-[13px] font-semibold text-pink-600 hover:underline">
              All orders →
            </Link>
          </div>

          <Card>
            {orders.isLoading ? (
              <Loading />
            ) : orders.isError ? (
              <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
            ) : live.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">
                Nothing in flight right now.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-[12px] uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-semibold">Reference</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Rider</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Total</th>
                    <th className="px-5 py-3 text-right font-semibold">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {live.map((o) => (
                    <tr key={o.id} className="border-b border-hairline last:border-0 hover:bg-surface">
                      <td className="px-5 py-3">
                        <Link
                          to={`/orders?open=${o.id}`}
                          className="font-semibold text-pink-600 hover:underline"
                        >
                          {o.reference}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-body">{fullName(o.customer)}</td>
                      <td className="px-5 py-3 text-body">
                        {o.rider ? (
                          fullName(o.rider)
                        ) : (
                          <span className="font-semibold text-warning">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill status={o.status} />
                      </td>
                      <td className="num px-5 py-3 text-right font-semibold text-ink">
                        {naira(o.totalKobo)}
                      </td>
                      <td className="px-5 py-3 text-right text-muted" title={dateTime(o.createdAt)}>
                        {relative(o.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  tone,
  to,
}: {
  label: string;
  value: string | number;
  tone?: 'info' | 'success' | 'warning';
  to?: string;
}) {
  const toneClass =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'success'
        ? 'text-success'
        : tone === 'info'
          ? 'text-info'
          : 'text-ink';

  const body = (
    <Card className={`p-4 ${to ? 'transition hover:border-pink-200' : ''}`}>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`num mt-1.5 text-2xl font-bold ${toneClass}`}>{value}</p>
    </Card>
  );

  return to ? <Link to={to}>{body}</Link> : body;
}
