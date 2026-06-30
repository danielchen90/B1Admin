import { useQuery } from "@tanstack/react-query";
import { type LicenseTemplateInterface } from "../licenseTemplates/LicenseTemplateInterface";

// Shared cached loader for the church's license templates. Mirrors useOrdinationTypes:
// a stable React Query key means the list page (05-06) and any template picker share
// one cached fetch (placeholderData [] so consumers never see undefined).
//
// NOTE on the path: the apphelper MembershipApi base ALREADY ends in /membership, so
// the resource path here is BARE "/licenseTemplates" — adding a /membership prefix
// would double to .../membership/membership/... and 404. This is the cross-plan
// contract proven in Phase 3 (commit b113676d) and reaffirmed in 04-02; the literal
// "/membership/licenseTemplates" written in the plan is the doubled-prefix trap.
export const useLicenseTemplates = (): LicenseTemplateInterface[] => {
  const query = useQuery<LicenseTemplateInterface[]>({ queryKey: ["/licenseTemplates", "MembershipApi"], placeholderData: [] });
  return query.data || [];
};
