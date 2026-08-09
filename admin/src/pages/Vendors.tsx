import { Fragment, useState } from 'react';

import { PageHeader } from '@/components/Layout';
import { Button, Card, EmptyState, ErrorState, Loading, Modal, Pill } from '@/components/ui';
import {
  useDeleteProduct,
  useDeleteVendor,
  useUpdateVendor,
  useVendorProducts,
  useVendors,
} from '@/lib/hooks';
import { naira } from '@/lib/format';
import type { AdminProduct, Vendor } from '@/lib/types';

/** What a confirmation modal is currently asking about. */
type Pending =
  | { kind: 'product'; product: AdminProduct; vendorName: string }
  | { kind: 'vendor'; vendor: Vendor }
  | null;

export function Vendors() {
  const { data, isLoading, isError, error, refetch } = useVendors();
  const update = useUpdateVendor();
  const deleteProduct = useDeleteProduct();
  const deleteVendor = useDeleteVendor();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  // Whichever mutation last failed is the one worth showing.
  const failure = [update, deleteProduct, deleteVendor].find((m) => m.isError);

  function confirm() {
    if (!pending) return;

    const mutation = pending.kind === 'product' ? deleteProduct : deleteVendor;
    const id = pending.kind === 'product' ? pending.product.id : pending.vendor.id;

    mutation.mutate(id, {
      onSuccess: () => setPending(null),
      // Deliberately stays open on failure: the vendor delete is refused when
      // the vendor has orders, and that explanation belongs next to the button
      // that triggered it rather than behind a dismissed dialog.
    });
  }

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle="Verify a vendor, let it bid on marketplace requests, take it offline, or manage its listings."
      />

      <div className="p-4 sm:p-8">
        {failure ? (
          <p role="alert" className="mb-3 rounded-lg bg-error/10 px-3 py-2 text-[13px] text-error">
            {failure.error instanceof Error ? failure.error.message : 'That action failed.'}
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[12px] uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Vendor</th>
                  <th className="px-5 py-3 font-semibold">Area</th>
                  <th className="px-5 py-3 font-semibold">Rating</th>
                  <th className="px-5 py-3 text-center font-semibold">Verified</th>
                  <th className="px-5 py-3 text-center font-semibold">Can bid</th>
                  <th className="px-5 py-3 text-center font-semibold">Open</th>
                  <th className="px-5 py-3 text-right font-semibold">Listings</th>
                </tr>
              </thead>
              <tbody>
                {data.map((v) => {
                  const open = expanded === v.id;

                  return (
                    <Fragment key={v.id}>
                      <tr className="border-b border-hairline hover:bg-surface">
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
                        <td className="px-5 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-expanded={open}
                            onClick={() => setExpanded(open ? null : v.id)}
                          >
                            {v._count.products} {open ? '▲' : '▼'}
                          </Button>
                        </td>
                      </tr>

                      {open ? (
                        <tr className="border-b border-hairline">
                          <td colSpan={7} className="bg-surface px-5 py-4">
                            <Catalogue
                              vendor={v}
                              onDeleteProduct={(product) =>
                                setPending({ kind: 'product', product, vendorName: v.name })
                              }
                              onDeleteVendor={() => setPending({ kind: 'vendor', vendor: v })}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <ConfirmDelete
        pending={pending}
        busy={deleteProduct.isPending || deleteVendor.isPending}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      />
    </>
  );
}

/** The expanded panel under a vendor row: its listings, plus vendor-level deletion. */
function Catalogue({
  vendor,
  onDeleteProduct,
  onDeleteVendor,
}: {
  vendor: Vendor;
  onDeleteProduct: (product: AdminProduct) => void;
  onDeleteVendor: () => void;
}) {
  const { data, isLoading, isError, error, refetch } = useVendorProducts(vendor.id);
  const traded = vendor._count.orders > 0;

  return (
    <div>
      {isLoading ? (
        <Loading label="Loading listings…" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.products.length === 0 ? (
        <p className="py-2 text-[13px] text-muted">This vendor has no listings.</p>
      ) : (
        <ul className="mb-4 divide-y divide-hairline rounded-lg bg-white">
          {data.products.map((p) => (
            <li key={p.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{p.name}</p>
                <p className="truncate text-[12px] text-muted">
                  {[p.section, p.description].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>

              {!p.inStock ? <Pill tone="bg-muted/15 text-muted" label="Out of stock" /> : null}
              {p.isMarketplace ? <Pill tone="bg-pink-600/10 text-pink-600" label="Marketplace" /> : null}

              <span className="num w-24 text-right text-body">{naira(p.priceKobo)}</span>

              <Button variant="danger" size="sm" onClick={() => onDeleteProduct(p)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-hairline pt-3">
        <p className="text-[12px] text-muted">
          {traded
            ? `${vendor._count.orders} order(s) reference this vendor, so it cannot be deleted. ` +
              'Set it to unverified and closed to take it off the app.'
            : 'This vendor has never traded, so it can be removed entirely.'}
        </p>
        <Button variant="danger" size="sm" disabled={traded} onClick={onDeleteVendor}>
          Delete vendor
        </Button>
      </div>
    </div>
  );
}

function ConfirmDelete({
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: Pending;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isProduct = pending?.kind === 'product';

  return (
    <Modal
      open={pending !== null}
      title={isProduct ? 'Delete listing' : 'Delete vendor'}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {isProduct ? 'Delete listing' : 'Delete vendor'}
          </Button>
        </>
      }
    >
      {pending === null ? null : pending.kind === 'product' ? (
        <>
          <p className="text-body">
            Delete <strong className="text-ink">{pending.product.name}</strong> from{' '}
            {pending.vendorName}? Customers will stop seeing it immediately.
          </p>
          {pending.product._count.orderItems > 0 ? (
            <p className="mt-3 text-[13px] text-muted">
              {pending.product._count.orderItems} past order line(s) include this item. They keep the
              name and the price that was charged — only the link to the catalogue goes away.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-body">
          Delete <strong className="text-ink">{pending.vendor.name}</strong> and all{' '}
          {pending.vendor._count.products} of its listings? This cannot be undone.
        </p>
      )}
    </Modal>
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
