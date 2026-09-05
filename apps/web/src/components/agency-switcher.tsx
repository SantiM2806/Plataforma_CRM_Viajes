'use client';

import { setActiveAgency } from '@/lib/auth/actions';
import type { AgencyRef } from '@/lib/auth/session';

export function AgencySwitcher({
  agencies,
  activeId,
}: {
  agencies: AgencyRef[];
  activeId: string | null;
}) {
  if (agencies.length === 0) return null;

  return (
    <form action={setActiveAgency}>
      <select
        name="agencyId"
        defaultValue={activeId ?? ''}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        disabled={agencies.length < 2}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
      >
        {agencies.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.initials})
          </option>
        ))}
      </select>
    </form>
  );
}
