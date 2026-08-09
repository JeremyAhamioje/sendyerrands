import { useState } from 'react';

import { PageHeader } from '@/components/Layout';
import { Button, Card, EmptyState, ErrorState, Loading, Pill } from '@/components/ui';
import { dateTime, fullName, humanise, naira, relative } from '@/lib/format';
import { useInviteVendors, useRequests, useVendors } from '@/lib/hooks';
import type { MarketplaceRequest } from '@/lib/types';

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

      <div className="p-4 sm:p-8">
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

                  {r.photoUrls && r.photoUrls.length > 0 ? (
                    <div className="mt-3 flex gap-2 border-t border-hairline pt-3">
                      {r.photoUrls.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          <img
                            src={url}
                            alt="Attached by the customer"
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  ) : null}

                  <Invites request={r} />
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Choose which vendors may quote on a request.
 *
 * Only verified vendors with `canBid` are offered: the API rejects the rest,
 * and offering a vendor ops cannot actually pick reads as a bug.
 */
function Invites({ request }: { request: MarketplaceRequest }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(request.invitedVendors.map((v) => v.id));

  const { data: vendors } = useVendors();
  const invite = useInviteVendors();

  const eligible = (vendors ?? []).filter((v) => v.canBid && v.isVerified);
  const editable = request.status === 'OPEN';

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Invited vendors
          </p>
          <p className="mt-1 text-[13px] text-body">
            {request.invitedVendors.length === 0
              ? 'Open to every vendor that can bid.'
              : request.invitedVendors.map((v) => v.name).join(', ')}
          </p>
        </div>

        {editable ? (
          <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? 'Close' : 'Choose vendors'}
          </Button>
        ) : null}
      </div>

      {open && editable ? (
        <div className="mt-3 rounded-lg bg-surface p-3">
          {eligible.length === 0 ? (
            <p className="text-[13px] text-muted">
              No vendor is both verified and allowed to bid. Enable “Can bid” on the Vendors page.
            </p>
          ) : (
            <>
              <ul className="mb-3 grid gap-1.5 sm:grid-cols-2">
                {eligible.map((v) => (
                  <li key={v.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-body">
                      <input
                        type="checkbox"
                        checked={selected.includes(v.id)}
                        onChange={() => toggle(v.id)}
                      />
                      {v.name}
                    </label>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  loading={invite.isPending}
                  onClick={() =>
                    invite.mutate(
                      { requestId: request.id, vendorIds: selected },
                      { onSuccess: () => setOpen(false) }
                    )
                  }
                >
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                  Clear (open to all)
                </Button>
              </div>

              {invite.isError ? (
                <p role="alert" className="mt-2 text-[13px] text-error">
                  {invite.error instanceof Error ? invite.error.message : 'Could not save that.'}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
