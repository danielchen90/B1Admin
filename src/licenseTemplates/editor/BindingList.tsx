// BindingList.tsx — scaffold (full implementation lands in 05-05 Task 3).
import React from "react";
import { Box } from "@mui/material";

interface Props {
  onAdd: (binding: string) => void;
}

export const BindingList: React.FC<Props> = () => <Box sx={{ p: 2 }} />;
