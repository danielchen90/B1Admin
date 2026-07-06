// Payment + bulk-grant API client for the leadership report (Phase 08). Thin wrappers over
// ApiHelper.post against MembershipApi. updatePayment persists the Paid/Exempt checkbox toggles
// with the ORD-07 optimistic-concurrency version; grantLicenses bulk-grants active licenses to
// the currently-visible credential ids and reports how many were granted vs skipped.
import { ApiHelper } from "@churchapps/apphelper";
import { PersonOrdinationInterface } from "../../people/components/PersonOrdinationInterface";

export const updatePayment = (id: string, version: number, changes: { paid?: boolean; exempt?: boolean }): Promise<PersonOrdinationInterface> =>
  ApiHelper.post("/personOrdinations/" + id + "/payment", { ...changes, version }, "MembershipApi");

export interface GrantResult { granted: number; skipped: { id: string; reason: string }[]; }
export const grantLicenses = (ids: string[], grantedDate: string, expirationDate: string): Promise<GrantResult> =>
  ApiHelper.post("/personOrdinations/batch/grant", { ids, grantedDate, expirationDate }, "MembershipApi");
