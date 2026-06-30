import { useQuery } from "@tanstack/react-query";
import { type OrdinationTypeInterface } from "../settings/components/OrdinationTypeInterface";

// Shared loader for the church-wide ordination vocabulary. Mirrors useCampuses:
// a stable React Query key means every caller (the settings admin screen, the
// issue/edit dialogs, the person credential panel) shares one cached fetch.
// Keyed on /all (NOT /active) because the admin screen must also list inactive
// types so they can be re-activated.
export const useOrdinationTypes = (): OrdinationTypeInterface[] => {
  const query = useQuery<OrdinationTypeInterface[]>({ queryKey: ["/ordinationTypes/all", "MembershipApi"], placeholderData: [] });
  return query.data || [];
};
