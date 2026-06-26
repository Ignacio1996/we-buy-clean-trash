'use client';

import { useRouter } from 'next/navigation';
import { RowDeleteMenu } from '@/components/admin/RowDeleteMenu';

/**
 * Three-dots row menu for a run in the list — test-data cleanup without opening
 * the run first. Its Delete item opens a confirm modal, calls the DELETE
 * endpoint, then refreshes the list.
 */
export function DeleteRunRowButton({ routeId, stops }: { routeId: string; stops: number }) {
  const router = useRouter();

  async function remove() {
    const res = await fetch(`/api/compost-routes/${routeId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data.error === 'string' ? data.error : 'delete_failed');
    }
    router.refresh();
  }

  return (
    <RowDeleteMenu
      menuLabel="Delete run"
      confirmTitle="Delete this run?"
      confirmBody={`This run and its ${stops} stop${
        stops === 1 ? '' : 's'
      } will be deleted, and the weight it added to diversion totals will be reversed. This can't be undone.`}
      confirmLabel="Delete run"
      onConfirm={remove}
    />
  );
}
