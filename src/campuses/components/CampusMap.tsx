import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Box, Typography } from "@mui/material";
import { LocationOff as LocationOffIcon } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { type CampusInterface } from "../../settings/components/CampusInterface";

// Leaflet's default marker images don't resolve through bundlers; load them from
// the Leaflet CDN (same origin policy as the OSM tiles this map already pulls).
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface Props {
  campuses: CampusInterface[];
  height?: number | string;
  interactive?: boolean; // pin click navigates to the campus detail page
}

const addressLine = (c: CampusInterface) => [c.address1, c.city, c.state, c.zip, c.country].filter(Boolean).join(", ");

// Keep the viewport framed to the current set of pins as they change.
const FitBounds: React.FC<{ points: [number, number][] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 13);
    else if (points.length > 1) map.fitBounds(points as any, { padding: [40, 40], maxZoom: 12 });
  }, [points, map]);
  return null;
};

export const CampusMap: React.FC<Props> = ({ campuses, height = 420, interactive = false }) => {
  const navigate = useNavigate();
  const located = useMemo(() => campuses.filter((c) => c.latitude != null && c.longitude != null), [campuses]);
  const points = useMemo(() => located.map((c) => [c.latitude as number, c.longitude as number] as [number, number]), [located]);

  if (located.length === 0) {
    return (
      <Box sx={{ height, width: "100%", borderRadius: 2, bgcolor: "action.hover", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, color: "text.secondary" }}>
        <LocationOffIcon />
        <Typography variant="body2">No mapped locations yet</Typography>
      </Box>
    );
  }

  return (
    <MapContainer center={points[0]} zoom={4} style={{ height, width: "100%", borderRadius: 8 }} scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds points={points} />
      {located.map((c) => (
        <Marker
          key={c.id}
          position={[c.latitude as number, c.longitude as number]}
          icon={markerIcon}
          eventHandlers={interactive ? { click: () => navigate(`/campuses/${c.id}`) } : undefined}>
          <Popup>
            <strong>{c.name}</strong>
            <br />
            {addressLine(c)}
            {interactive && (
              <>
                <br />
                <span style={{ color: "#1565c0", cursor: "pointer" }} onClick={() => navigate(`/campuses/${c.id}`)}>View campus →</span>
              </>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};
