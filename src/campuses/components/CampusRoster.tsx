import React from "react";
import { type PersonInterface } from "@churchapps/helpers";
import { type CampusInterface } from "../../settings/components/CampusInterface";
import { ageFromBirthDate } from "../helpers/campusDemographics";
import { type OrdinationInfo, splitCampusPeople, ordinationTitle } from "../helpers/campusOrdinations";

interface Props {
  campus?: CampusInterface;
  people: PersonInterface[];
  ordByPerson: Map<string, OrdinationInfo>;
}

const cell: React.CSSProperties = { borderBottom: "1px solid #ccc", padding: "5px 8px", verticalAlign: "top" };
const th: React.CSSProperties = { textAlign: "left", borderBottom: "2px solid #000", padding: "6px 8px" };
const COLS = ["Ordination", "Name", "Gender", "Age", "Membership", "Email", "Phone"];

const Section: React.FC<{ title: string; people: PersonInterface[]; ordByPerson: Map<string, OrdinationInfo> }> = ({ title, people, ordByPerson }) => {
  if (people.length === 0) return null;
  return (
    <>
      <h2 style={{ fontSize: 15, marginTop: 18, marginBottom: 6, borderBottom: "2px solid #000", paddingBottom: 4 }}>{title} ({people.length})</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>{COLS.map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td style={{ ...cell, fontWeight: 600 }}>{ordinationTitle(p, ordByPerson)}</td>
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
    </>
  );
};

// Plain printable roster targeted by react-to-print (browser → Save as PDF).
// Ordained leaders are listed first as their own section, then the rest.
export const CampusRoster = React.forwardRef<HTMLDivElement, Props>(({ campus, people, ordByPerson }, ref) => {
  const address = [campus?.address1, campus?.address2, campus?.city, campus?.state, campus?.zip, campus?.country].filter(Boolean).join(", ");
  const { leaders, members } = splitCampusPeople(people, ordByPerson);
  return (
    <div ref={ref} style={{ padding: 24, fontFamily: "Arial, sans-serif", color: "#000" }}>
      <h1 style={{ marginBottom: 4, fontSize: 22 }}>{campus?.name} — Membership Roster</h1>
      {address && <div style={{ color: "#555", marginBottom: 8 }}>{address}</div>}
      <div style={{ marginBottom: 4, fontWeight: 700 }}>
        {people.length} {people.length === 1 ? "member" : "members"} · {leaders.length} ordained {leaders.length === 1 ? "leader" : "leaders"}
      </div>
      <Section title="Ordained Leaders" people={leaders} ordByPerson={ordByPerson} />
      <Section title="Members" people={members} ordByPerson={ordByPerson} />
    </div>
  );
});
CampusRoster.displayName = "CampusRoster";
