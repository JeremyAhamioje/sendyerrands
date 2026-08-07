import { PageHeader } from '@/components/Layout';
import { Card, EmptyState, ErrorState, Loading, Pill } from '@/components/ui';
import { useUpdateVendor, useVendors } from '@/lib/hooks';
import type { Vendor } from '@/lib/types';

export function Vendors() {
  const { data, isLoading, isError, error, refetch } = useVendors();
  const update = useUpdateVendor();

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle="Verify a vendor, let it bid on marketplace requests, or take it offline."
      />

      <div className="p-8">
        {update.isError ? (
          <p role="alert" className="mb-3 rounded-lg bg-error/10 px-3 py-2 text-[13px] text-error">
            {update.error instanceof Error ? update.error.message : 'Could not update that vendor.'}
          </p>
        ) : null}

        <Card>
          {isLoading ? (
            <Loading />
          ) : isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : !data || data.length === 0 ? (
            <EmptyState title="No vendors yet" hint="Seed the database or onboard a vendor." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[12px] uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Vendor</th>
                  <th className="px-5 py-3 font-semibold">Area</th>
                  <th className="px-5 py-3 font-semibold">Rating</th>
                  <th className="px-5 py-3 text-center font-semibold">Verified</th>
                  <th className="px-5 py-3 text-center font-semibold">Can bid</th>
                  <th className="px-5 py-3 text-center font-semibold">Open</th>
                </tr>
              </thead>
              <tbody>
                {data.map((v) => (
                  <tr key={v.id} className="border-b border-hairline last:border-0 hover:bg-surface">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-ink">{v.name}</p>
                      <p className="text-[12px] text-muted">{v.tags.slice(0, 3).join(' · ')}</p>
                    </td>
                    <td className="px-5 py-3 text-body">{v.area ?? '—'}</td>
                    <td className="num px-5 py-3 text-body">{v.rating.toFixed(1)}</td>
                    <Toggle
                      vendor={v}
                      field="isVerified"
                      pending={update.isPending}
                      onToggle={(next) => update.mutate({ id: v.id, isVerified: next })}
                    />
                    <Toggle
                      vendor={v}
                      field="canBid"
                      pending={update.isPending}
                      onToggle={(next) => update.mutate({ id: v.id, canBid: next })}
                    />
                    <Toggle
                      vendor={v}
                      field="isOpen"
                      pending={update.isPending}
                      onToggle={(next) => update.mutate({ id: v.id, isOpen: next })}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

function Toggle({
  vendor,
  field,
  pending,
  onToggle,
}: {
  vendor: Vendor;
  field: 'isVerified' | 'canBid' | 'isOpen';
  pending: boolean;
  onToggle: (next: boolean) => void;
}) {
  const on = vendor[field];
  const label = field === 'isVerified' ? 'verified' : field === 'canBid' ? 'bidding' : 'open';

  return (
    <td className="px-5 py-3 text-center">
      <button
        onClick={() => onToggle(!on)}
        disabled={pending}
        aria-pressed={on}
        aria-label={`${on ? 'Disable' : 'Enable'} ${label} for ${vendor.name}`}
        className="disabled:opacity-50"
      >
        <Pill
          tone={on ? 'bg-success/10 text-success' : 'bg-muted/15 text-muted'}
          label={on ? 'Yes' : 'No'}
        />
      </button>
    </td>
  );
}
