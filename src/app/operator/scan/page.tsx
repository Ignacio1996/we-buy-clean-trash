import { requireRole } from '@/lib/auth/session';
import { SSOpHeader, SSOpShell } from '@/components/operator/SSOp';
import { ScanFallbackClient } from './ScanFallbackClient';

export default async function OperatorScanPage() {
  await requireRole('operator');

  return (
    <SSOpShell active="route" nav={false}>
      <SSOpHeader
        kicker="Manual scan"
        title={
          <>
            Scan
            <br />
            any bag.
          </>
        }
        sub="Log a pickup even when routing’s down."
        back="Back to route"
        backHref="/operator"
      />
      <ScanFallbackClient />
    </SSOpShell>
  );
}
