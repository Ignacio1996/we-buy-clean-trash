import type { Timestamp } from 'firebase-admin/firestore';
import type { MaterialId } from './material';

export interface DepotDoc {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  geo: { lat: number; lng: number } | null;
  managerId: string | null;
  zoneIds: string[];
  /**
   * Material IDs this depot accepts for processing. Empty/missing on legacy docs
   * is treated as "accepts everything" by callers — see resolveAcceptedMaterials.
   */
  acceptedMaterials: MaterialId[];
  createdAt: Timestamp;
  /** Set when admin patches the depot (e.g. toggling accepted materials). Optional on legacy docs. */
  updatedAt?: Timestamp;
}

/**
 * Returns the accepted-materials set for a depot, falling back to all material IDs
 * for legacy docs that predate the field. Use this everywhere reads happen so the
 * semantics stay consistent.
 */
export function resolveAcceptedMaterials(
  depot: { acceptedMaterials?: unknown },
  allMaterialIds: readonly MaterialId[],
): MaterialId[] {
  const raw = depot.acceptedMaterials;
  if (!Array.isArray(raw) || raw.length === 0) return [...allMaterialIds];
  const allowed = new Set(allMaterialIds);
  const out = raw.filter((id): id is MaterialId => typeof id === 'string' && allowed.has(id as MaterialId));
  return out.length > 0 ? out : [...allMaterialIds];
}
