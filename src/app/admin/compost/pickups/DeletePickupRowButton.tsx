'use client';

import { useRouter } from 'next/navigation';
import { RowDeleteMenu } from '@/components/admin/RowDeleteMenu';

/**
 * Three-dots row menu for a single recorded stop (a bin pickup or a site check).
 * Its Delete item opens a confirm modal, then hits the matching DELETE endpoint
 * and refreshes the list. Built for clearing stray/test submissions one at a time.
 */
export function DeletePickupRowButton({
  kind,
  id,
  weightLbs,
}: {
  kind: 'bin' | 'check';
  id: string;
  weightLbs: number;
}) {
  const router = useRouter();

  const body =
    kind === 'bin'
      ? weightLbs > 0
        ? `This also removes its ${weightLbs.toLocaleString()} lbs from diversion totals. This can't be undone.`
        : `This can't be undone.`
      : `This cart check will be removed. This can't be undone.`;

  async function remove() {
    const endpoint = kind === 'bin' ? `/api/bin-pickups/${id}` : `/api/site-checks/${id}`;
    const res = await fetch(endpoint, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data.error === 'string' ? data.error : 'delete_failed');
    }
    router.refresh();
  }

  return (
    <RowDeleteMenu
      menuLabel={kind === 'bin' ? 'Delete pickup' : 'Delete cart check'}
      confirmTitle={kind === 'bin' ? 'Delete this pickup?' : 'Delete this cart check?'}
      confirmBody={body}
      onConfirm={remove}
    />
  );
}
