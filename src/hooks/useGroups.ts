import { useQuery } from "@tanstack/react-query";
import { type GroupInterface } from "@churchapps/helpers";

// Shared loader for the church-wide (Membership) group list (mirrors useCampuses
// / useAuxiliaries). One cached fetch shared by every caller — the campaign
// Audience tab's group selector, attendance setup, etc. — instead of each
// component hitting /groups on mount.
export const useGroups = (): GroupInterface[] => {
  const query = useQuery<GroupInterface[]>({ queryKey: ["/groups", "MembershipApi"], placeholderData: [] });
  return query.data || [];
};
