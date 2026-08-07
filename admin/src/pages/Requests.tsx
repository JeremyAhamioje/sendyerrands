import { useState } from 'react';

import { PageHeader } from '@/components/Layout';
import { Card, EmptyState, ErrorState, Loading, Pill } from '@/components/ui';
import { dateTime, fullName, humanise, naira, relative } from '@/lib/format';
import { useRequests } from '@/lib/hooks';

const TABS = [
  { key: 'OPEN', label: 'Open' },
  { key: 'AWARDED', label: 'Awarded' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'ALL', label: 'All' },
];

export function Requests() {
  const [tab, setTab] = useState('OPEN');
  const { data, isLoading, isError, error, refetch } = useRequests(tab);

  return (
    <>
      <PageHeader
        title="Requests"
        subtitle="Marketplace requests customers posted for vendors to bid on."
      />

      <div className="p-8">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
                tab === t.key ? 'bg-pink-600 text-white' : 'bg-white text-body hover:bg-surface'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <Card>
            <Loading />
          </Card>
        ) : isError ? (
          <Card>
            <ErrorState error={error} onRetry={() => refetch()} />
          </Card>
        ) : !data || data.length === 0 ? (
          <Card>
            <EmptyState
              title="No requests here"
              hint={tab === 'OPEN' ? 'Nothing is currently open for bidding.' : undefined}
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {data.map((r) => {
              const closed = new Date(r.closesAt).getTime() < Date.now();
              const best = r.bids.reduce<number | null>(
                (low, b) => (low === null || b.priceKobo < low ? b.priceKobo : low),
                null
              );

              return (
                <Card key={r.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-bold text-ink">{r.title}</h3>
                        <Pill
                          tone={
                            r.status === 'OPEN'
                              ? 'bg-success/10 text-success'
                              : r.status === 'AWARDED'
                                ? 'bg-info/10 text-info'
                                : 'bg-muted/15 text-body'
                          }
                          label={humanise(r.status)}
                        />
                        {r.status === 'OPEN' && closed ? (
                          <Pill tone="bg-warning/10 text-warning" label="Window closed" />
                        ) : null}
                      </div>
                      {r.description ? (
                        <p className="mt-1 max-w-2xl text-[13px] text-body">{r.description}</p>
                      ) : null}
                      <p className="mt-1.5 text-[12px] text-muted">
                        {fullName(r.customer)} · {r.customer?.phone ?? '—'} · posted{' '}
                        {relative(r.createdAt)} · closes {dateTime(r.closesAt)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                        Budget
                      </p>
                      <p className="num text-lg font-bold text-ink">
                        {r.budgetKobo ? naira(r.budgetKobo) : 'Open'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-hairline pt-3">
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                      {r.bids.length} {r.bids.length === 1 ? 'bid' : 'bids'}
                    </p>

                    {r.bids.length === 0 ? (
                      <p className="text-[13px] text-muted">No vendor has bid yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {r.bids.map((b) => (
                          <li
                            key={b.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-ink">
                                {b.vendor?.name ?? 'Unknown vendor'}
                                {best !== null && b.priceKobo === best ? (
                                  <span className="ml-2 text-[11px] font-bold text-success">
                                    LOWEST
                                  </span>
                                ) : null}
                              </p>
                              {b.note ? (
                                <p className="truncate text-[12px] text-muted">{b.note}</p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-[12px] text-muted">{b.etaMinutes} min</span>
                              <span className="num text-[13px] font-bold text-ink">
                                {naira(b.priceKobo)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
