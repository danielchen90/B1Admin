import { useQuery } from "@tanstack/react-query";
import { type AuxiliaryInterface } from "../auxiliaries/AuxiliaryInterface";

// Shared loader for the church-wide auxiliary list (mirrors useCampuses). One
// cached fetch shared by the Auxiliaries pages, the campus Groups tab chip, and
// the group edit form's auxiliary selector.
export const useAuxiliaries = (): AuxiliaryInterface[] => {
  const query = useQuery<AuxiliaryInterface[]>({ queryKey: ["/auxiliaries", "MembershipApi"], placeholderData: [] });
  return query.data || [];
};
