import React from "react";
import { Card, CardContent, Grid, Stack, Typography, Chip, Link, Button } from "@mui/material";
import { LocationOn as LocationOnIcon, Language as WebIcon, Schedule as TzIcon, Edit as EditIcon } from "@mui/icons-material";
import { UserHelper, Permissions } from "@churchapps/apphelper";
import { type CampusInterface } from "../../settings/components/CampusInterface";
import { CampusMap } from "./CampusMap";

interface Props {
  campus?: CampusInterface;
  memberCount?: number;
  onEdit?: () => void;
}

// Detail-page hero: campus name in the header, full address, quick facts, and a
// single-pin map of the location (satisfies the "detailed view of that location").
export const CampusBanner: React.FC<Props> = ({ campus, memberCount, onEdit }) => {
  if (!campus?.id) return null;
  const address = [campus.address1, campus.address2, campus.city, campus.state, campus.zip, campus.country].filter(Boolean).join(", ");
  const canEdit = UserHelper.checkAccess(Permissions.membershipApi.settings.edit);
  return (
    <Card sx={{ mt: 2, mb: 2 }}>
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <LocationOnIcon color="primary" />
              <Typography variant="h4">{campus.name}</Typography>
              {canEdit && onEdit && (
                <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={onEdit} data-testid="campus-edit-button">Edit</Button>
              )}
            </Stack>
            <Typography variant="body1" color="text.secondary">{address || "No address on file"}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
              {typeof memberCount === "number" && <Chip color="primary" label={`${memberCount} members`} />}
              {campus.timezone && <Chip variant="outlined" icon={<TzIcon />} label={campus.timezone} />}
              {campus.website && <Chip variant="outlined" icon={<WebIcon />} label={<Link href={campus.website} target="_blank" rel="noopener" underline="hover">Website</Link>} />}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <CampusMap campuses={[campus]} height={200} />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
