// Raw Phase-2 personOrdinations row (no joins). Mirrors the server model exactly:
// `version` drives ORD-07 optimistic concurrency, `status` is the ORD-05 lifecycle
// state, `campusId` is the ORD-? scope. activeFlag is DB-generated/read-only and is
// intentionally OMITTED — it is never surfaced to the client.
export interface PersonOrdinationInterface {
  id?: string;
  churchId?: string;
  personId?: string;
  ordinationTypeId?: string;
  campusId?: string;
  status?: string;
  credentialNumber?: string;
  grantedDate?: string | null;
  expirationDate?: string | null;
  notes?: string;
  version?: number;
}
