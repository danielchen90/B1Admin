import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ManageChurch } from "./ManageChurch";
import { RolesPage } from "./RolesPage";
import { RolePage } from "./RolePage";
import { AuditLogPage } from "./AuditLogPage";
import { CampusesPage } from "./CampusesPage";
import { OrdinationTypesPage } from "./OrdinationTypesPage";
import { LicenseTemplatesPage } from "../licenseTemplates/LicenseTemplatesPage";
import { PrintCalibrationPage } from "../licenseTemplates/render/calibration/PrintCalibrationPage";
import { canWriteOrdinations } from "../helpers/OrdinationHelper";

export const Settings: React.FC = () => (
  <Routes>
    <Route path="/roles" element={<RolesPage />} />
    <Route path="/role/:roleId" element={<RolePage />} />
    <Route path="/audit-log" element={<AuditLogPage />} />
    <Route path="/campuses" element={<CampusesPage />} />
    <Route path="/ordination-types" element={<OrdinationTypesPage />} />
    <Route path="/license-templates" element={<LicenseTemplatesPage />} />
    {/* Print calibration is an OPERATIONAL action — gated by the same print/write
        capability the print flow uses (canWriteOrdinations), not the manage-vocabulary
        gate. Unauthorized users are bounced back to the settings home. */}
    <Route path="/print-calibration" element={canWriteOrdinations() ? <PrintCalibrationPage /> : <Navigate to="/settings" replace />} />
    <Route path="/webhooks" element={<Navigate to="/settings#developer" replace />} />
    <Route path="/developer" element={<Navigate to="/settings#developer" replace />} />
    <Route path="/" element={<ManageChurch />} />
  </Routes>
);
