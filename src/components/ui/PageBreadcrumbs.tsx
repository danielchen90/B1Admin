import React from "react";
import { Box, Container, useTheme } from "@mui/material";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";

interface PageBreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
}

// A full-width breadcrumb bar meant to sit flush ABOVE a PageHeader / PersonBanner hero
// (both break out to 100vw with the same primary gradient). It mirrors that breakout so the
// two read as one unified header, and paints the darkest gradient stop (primary.dark) so the
// white-on-dark Breadcrumbs stay legible. Drop it in as the FIRST element a deep page returns.
export const PageBreadcrumbs: React.FC<PageBreadcrumbsProps> = ({ items, showHome = true }) => {
  const theme = useTheme();
  return (
    <Box
      id="page-breadcrumbs"
      sx={{
        background: theme.palette.primary.dark,
        position: "relative",
        left: "50%",
        right: "50%",
        marginLeft: "-50vw",
        marginRight: "-50vw",
        width: "100vw"
      }}
    >
      <Container maxWidth="xl" sx={{ py: 1.25 }}>
        <Breadcrumbs items={items} showHome={showHome} />
      </Container>
    </Box>
  );
};
