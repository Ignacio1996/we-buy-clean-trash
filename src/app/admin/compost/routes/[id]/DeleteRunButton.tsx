'use client';

import { useRouter } from 'next/navigation';
import { RowDeleteMenu } from '@/components/admin/RowDeleteMenu';

/** Three-dots menu on the run detail page. Deletes a run + its pickups (test-data
 * cleanup) after a confirm modal, then redirects to the list. */
export function DeleteRunButton({ routeId, stops }: { routeId: string; stops: number }) {
  const router = useRouter();

  async function remove() {
    const res = await fetch(`/api/compost-routes/${routeId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data.error === 'string' ? data.error : 'delete_failed');
    }
    router.push('/admin/compost/routes');
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
