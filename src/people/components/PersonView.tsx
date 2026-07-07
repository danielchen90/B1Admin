import React, { memo, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AssociatedForms } from ".";
import { type PersonInterface } from "@churchapps/helpers";
import { PersonHelper, Loading, DisplayBox, DateHelper, Locale, PersonAvatar, ApiHelper } from "@churchapps/apphelper";
import { Box, Grid, Icon, Stack, Table, TableBody, TableRow, TableCell, Chip } from "@mui/material";
import { Edit as EditIcon } from "@mui/icons-material";
import { AppIconButton } from "../../components/ui/AppIconButton";
import { formattedPhoneNumber } from "./PersonEdit";
import { useLicensePhoto } from "./photo/useLicensePhoto";
import { type PhotoCropTransform } from "./photo/LicensePhotoInterfaces";

// Render the stored license crop (a normalized 0..1 sub-rect of the member photo) inside a
// fixed circular box via background scale+translate — the store-once way to reflect the crop
// at display time without a second image file (PHO-04). Returns null when there is no usable
// crop (no photo, no saved crop, or the crop covers the whole frame) so we fall back to the
// plain PersonAvatar. Rotation is intentionally NOT applied to the circular avatar (it is a
// license-card concern); pan + zoom are what the user frames here.
const croppedAvatarStyle = (photoUrl: string | undefined, crop: PhotoCropTransform | null): Record<string, string> | null => {
  if (!photoUrl || !crop) return null;
  const cw = crop.cropWidth || 1;
  const ch = crop.cropHeight || 1;
  if (cw >= 0.999 && ch >= 0.999) return null; // full-frame crop → nothing to reflect
  const posX = cw >= 1 ? 0 : (crop.cropX / (1 - cw)) * 100;
  const posY = ch >= 1 ? 0 : (crop.cropY / (1 - ch)) * 100;
  return {
    backgroundImage: `url(${photoUrl})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${(1 / cw) * 100}% ${(1 / ch) * 100}%`,
    backgroundPosition: `${posX}% ${posY}%`
  };
};

interface Props {
  id?: string;
  person: PersonInterface;
  editFunction: () => void;
  updatedFunction: () => void;
  showForms?: boolean;
  headerActions?: React.ReactNode;
}

export const PersonView = memo(({ person, editFunction, updatedFunction, showForms = true, headerActions }: Props) => {
  const [userEmail, setUserEmail] = useState<string>("");
  const navigate = useNavigate();
  const { crop, reload: reloadCrop } = useLicensePhoto(person?.id);

  useEffect(() => {
    if (person?.id) {
      ApiHelper.get("/userchurch/personid/" + person.id, "MembershipApi")
        .then((data: { email: string } | null) => {
          setUserEmail(data?.email || "");
        })
        .catch(() => setUserEmail(""));
    }
  }, [person?.id]);

  // Re-fetch the saved crop after a License Photo save (the parent reloads the person, bumping
  // photoUpdated) so the freshly framed avatar shows without a manual refresh.
  useEffect(() => {
    void reloadCrop();
  }, [person?.photoUpdated, reloadCrop]);

  const goToProfile = () => {
    if (person?.id) navigate("/people/" + person.id);
  };

  const leftAttributes = useMemo(() => {
    if (!person) return [];

    const attributes = [];
    const p = { ...person };

    if (p.gender && p.gender !== "Unspecified") {
      attributes.push(
        <div key="gender">
          <label>{Locale.label("person.gender")}</label> <b>{p.gender}</b>
        </div>
      );
    }
    if (p.birthDate) {
      attributes.push(
        <div key="age">
          <label>{Locale.label("person.age")}</label> <b>{PersonHelper.getAge(new Date(p.birthDate))}</b>
        </div>
      );
    }
    if (p.maritalStatus && p.maritalStatus !== "Single") {
      if (p.anniversary) {
        attributes.push(
          <div key="maritalStatus">
            <label>{Locale.label("person.maritalStatus")}:</label>{" "}
            <b>
              {p.maritalStatus} ({DateHelper.getShortDate(DateHelper.toDate(p.anniversary))})
            </b>
          </div>
        );
      } else {
        attributes.push(
          <div key="maritalStatus">
            <label>{Locale.label("person.maritalStatus")}:</label> <b>{p.maritalStatus}</b>
          </div>
        );
      }
    }
    if (p.membershipStatus) {
      attributes.push(
        <div key="membership">
          <label>{Locale.label("people.personView.memShip")}</label> <b>{p.membershipStatus}</b>
        </div>
      );
    }

    return attributes;
  }, [person]);

  const contactMethods = useMemo(() => {
    if (!person) return [];

    const methods = [];
    const p = { ...person };
    let homeLabel = Locale.label("people.personView.home");

    if (p.contactInfo.email) {
      methods.push(
        <TableRow key="email">
          <TableCell>
            <label>{homeLabel}</label>
          </TableCell>
          <TableCell>
            <Icon>mail</Icon>
          </TableCell>
          <TableCell>
            <a href={"mailto:" + p.contactInfo.email}>
              <b>{p.contactInfo.email}</b>
            </a>
          </TableCell>
        </TableRow>
      );
      homeLabel = "";
    }
    if (p.contactInfo.homePhone) {
      methods.push(
        <TableRow key="homePhone">
          <TableCell>
            <label>{homeLabel}</label>
          </TableCell>
          <TableCell>
            <Icon>call</Icon>
          </TableCell>
          <TableCell>
            <b>{formattedPhoneNumber(p.contactInfo.homePhone)}</b>
          </TableCell>
        </TableRow>
      );
      homeLabel = "";
    }

    if (p.contactInfo.address1) {
      const lines = [];
      lines.push(
        <div key="address1">
          <b>{p.contactInfo.address1}</b>
        </div>
      );
      if (p.contactInfo.address2) {
        lines.push(
          <div key="address2">
            <b>{p.contactInfo.address2}</b>
          </div>
        );
      }
      lines.push(
        <div key="contactInfo">
          {p.contactInfo.city}, {p.contactInfo.state} {p.contactInfo.zip}
        </div>
      );

      methods.push(
        <TableRow key="address">
          <TableCell>
            <label>{homeLabel}</label>
          </TableCell>
          <TableCell>
            <Icon>home_pin</Icon>
          </TableCell>
          <TableCell>{lines}</TableCell>
        </TableRow>
      );
    }
    if (p.contactInfo.mobilePhone) {
      methods.push(
        <TableRow key="mobilePHone">
          <TableCell>
            <label>{Locale.label("people.personView.mobile")}</label>
          </TableCell>
          <TableCell>
            <Icon>phone_iphone</Icon>
          </TableCell>
          <TableCell>
            <b>{formattedPhoneNumber(p.contactInfo.mobilePhone)}</b>
          </TableCell>
        </TableRow>
      );
    }
    if (p.contactInfo.workPhone) {
      methods.push(
        <TableRow key="workPhone">
          <TableCell>
            <label>{Locale.label("people.personView.work")}</label>
          </TableCell>
          <TableCell>
            <Icon>call</Icon>
          </TableCell>
          <TableCell>
            <b>{formattedPhoneNumber(p.contactInfo.workPhone)}</b>
          </TableCell>
        </TableRow>
      );
    }

    return methods;
  }, [person]);

  const personFields = useMemo(() => {
    if (!person) return <Loading />;

    const cropStyle = croppedAvatarStyle(PersonHelper.getPhotoUrl(person), crop);
    // Responsive size: a touch smaller on phones so the circle never overflows its column.
    const avatarBoxSx = { width: { xs: 96, sm: 120 }, height: { xs: 96, sm: 120 } } as const;
    const ringSx = { display: "inline-flex", border: "3px solid #fff", borderRadius: "50%", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" } as const;
    const avatar = cropStyle ? (
      <Box sx={ringSx}>
        <Box
          onClick={goToProfile}
          role="button"
          aria-label={(person?.name?.display || "Person") + " profile"}
          sx={{ ...avatarBoxSx, ...cropStyle, borderRadius: "50%", cursor: "pointer", "&:hover": { opacity: 0.85, transition: "opacity 0.2s ease-in-out" } }}
        />
      </Box>
    ) : (
      <Box sx={ringSx}>
        <PersonAvatar person={person} size="xxlarge" sx={avatarBoxSx} onClick={goToProfile} />
      </Box>
    );

    return (
      <Grid container spacing={3} alignItems="center">
        <Grid size={{ xs: 12, sm: 3 }} sx={{ display: "flex", justifyContent: { xs: "center", sm: "flex-start" } }}>
          {avatar}
        </Grid>
        <Grid size={{ xs: 12, sm: 9 }}>
          <h2 style={{ marginTop: 0 }}>{person?.name?.display}</h2>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              {leftAttributes}
              {userEmail && (
                <div key="hasLogin">
                  <Chip label={Locale.label("people.personView.hasLoginLabel").replace("{email}", userEmail)} size="small" color="primary" icon={<Icon>person</Icon>} />
                </div>
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Table className="contactTable">
                <TableBody>{contactMethods}</TableBody>
              </Table>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    );
  }, [person, leftAttributes, contactMethods, userEmail, crop, goToProfile]);

  return (
    <DisplayBox
      headerText={Locale.label("people.personView.persDet")}
      editContent={editFunction || headerActions ? (
        <Stack direction="row" spacing={1} alignItems="center">
          {headerActions}
          {editFunction && (
            <AppIconButton label={Locale.label("common.edit")} icon={<EditIcon />} tone="card" data-testid="edit-person-button" onClick={editFunction} />
          )}
        </Stack>
      ) : undefined}
      footerContent={showForms ? <AssociatedForms contentType="person" contentId={person?.id} formSubmissions={person?.formSubmissions} updatedFunction={updatedFunction} /> : undefined}>
      {personFields}
    </DisplayBox>
  );
});
