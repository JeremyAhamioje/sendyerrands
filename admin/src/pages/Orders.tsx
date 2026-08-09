import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/Layout';
import { OrderDrawer } from '@/components/OrderDrawer';
import { Card, EmptyState, ErrorState, Loading, StatusPill, inputClass } from '@/components/ui';
import { dateTime, fullName, humanise, naira } from '@/lib/format';
import { useOrders } from '@/lib/hooks';
import type { OrderStatus, OrderType } from '@/lib/types';

const STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PLACED',
  'VENDOR_ACCEPTED',
  'RIDER_ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

const TYPES: OrderType[] = ['FOOD', 'PACKAGE', 'ERRAND', 'MARKETPLACE'];

export function Orders() {
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');

  // Deep link from the dashboard: /orders?open=<id>
  const [params, setParams] = useSearchParams();
  const openId = params.get('open');

  const { data, isLoading, isError, error, refetch } = useOrders({ status, type, q });

  const closeDrawer = () => {
    params.delete('open');
    setParams(params, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Assign riders, override a stuck status, or refund to the customer's wallet."
      />

      <div className="p-4 sm:p-8">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-muted">
              Search reference
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="SND-8841"
              className={`${inputClass} w-56`}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-muted">
              Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`${inputClass} w-48`}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanise(s)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-muted">
              Type
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={`${inputClass} w-44`}
            >
              <option value="">All types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanise(t)}
                </option>
              ))}
            </select>
          </label>

          {status || type || q ? (
            <button
              onClick={() => {
                setStatus('');
                setType('');
                setQ('');
              }}
              className="h-10 text-[13px] font-semibold text-pink-600 hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>

        <Card>
          {isLoading ? (
            <Loading />
          ) : isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : !data || data.length === 0 ? (
            <EmptyState title="No orders match" hint="Try clearing the filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[12px] uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Reference</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Vendor</th>
                  <th className="px-5 py-3 font-semibold">Rider</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Total</th>
                  <th className="px-5 py-3 text-right font-semibold">Placed</th>
                </tr>
              </thead>
              <tbody>
                {data.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setParams({ open: o.id }, { replace: true })}
                    className="cursor-pointer border-b border-hairline last:border-0 hover:bg-surface"
                  >
                    <td className="px-5 py-3 font-semibold text-pink-600">{o.reference}</td>
                    <td className="px-5 py-3 text-body">{humanise(o.type)}</td>
                    <td className="px-5 py-3 text-body">{fullName(o.customer)}</td>
                    <td className="px-5 py-3 text-body">{o.vendor?.name ?? '—'}</td>
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
                    <td className="px-5 py-3 text-right text-muted">{dateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </Card>

        {data && data.length >= 100 ? (
          <p className="mt-3 text-[12px] text-muted">
            Showing the 100 most recent. Narrow the filters to see older orders.
          </p>
        ) : null}
      </div>

      <OrderDrawer orderId={openId} onClose={closeDrawer} />
    </>
  );
}
