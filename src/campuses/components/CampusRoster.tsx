import React from "react";
import { type PersonInterface } from "@churchapps/helpers";
import { type CampusInterface } from "../../settings/components/CampusInterface";
import { ageFromBirthDate } from "../helpers/campusDemographics";

interface Props {
  campus?: CampusInterface;
  people: PersonInterface[];
}

const cell: React.CSSProperties = { borderBottom: "1px solid #ccc", padding: "5px 8px", verticalAlign: "top" };
const th: React.CSSProperties = { textAlign: "left", borderBottom: "2px solid #000", padding: "6px 8px" };

// Plain printable roster targeted by react-to-print (browser → Save as PDF).
// Rendered off-screen; kept dependency-free (no MUI) so print output is clean.
export const CampusRoster = React.forwardRef<HTMLDivElement, Props>(({ campus, people }, ref) => {
  const address = [campus?.address1, campus?.address2, campus?.city, campus?.state, campus?.zip, campus?.country].filter(Boolean).join(", ");
  return (
    <div ref={ref} style={{ padding: 24, fontFamily: "Arial, sans-serif", color: "#000" }}>
      <h1 style={{ marginBottom: 4, fontSize: 22 }}>{campus?.name} — Membership Roster</h1>
      {address && <div style={{ color: "#555", marginBottom: 12 }}>{address}</div>}
      <div style={{ marginBottom: 12, fontWeight: 700 }}>{people.length} {people.length === 1 ? "member" : "members"}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>{["Name", "Gender", "Age", "Membership", "Email", "Phone"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td style={cell}>{p.name?.display}</td>
              <td style={cell}>{p.gender || ""}</td>
              <td style={cell}>{ageFromBirthDate(p.birthDate as any) ?? ""}</td>
              <td style={cell}>{p.membershipStatus || ""}</td>
              <td style={cell}>{p.contactInfo?.email || ""}</td>
              <td style={cell}>{p.contactInfo?.mobilePhone || p.contactInfo?.homePhone || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
CampusRoster.displayName = "CampusRoster";
