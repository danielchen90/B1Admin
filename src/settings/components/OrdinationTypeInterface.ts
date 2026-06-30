// Church-wide ordination vocabulary row (Phase-2 ordinationTypes table). Unlike
// CampusInterface there is no published @churchapps/helpers base to extend yet —
// this is the local source of truth for the credential-type shape consumed by the
// settings admin screen and the issue/edit dialogs.
export interface OrdinationTypeInterface {
  id?: string;
  churchId?: string;
  name?: string;
  code?: string;
  sortOrder?: number;
  description?: string;
  active?: boolean;
  removed?: boolean;
}
