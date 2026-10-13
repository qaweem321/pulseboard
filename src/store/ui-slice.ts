import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Role } from "@/lib/roles";
import type { Range } from "@/lib/validation";

export type StatusFilter = "all" | "up" | "down" | "paused";

export type UiState = {
  user: { name: string; email: string; role: Role | null } | null;
  range: Range;
  statusFilter: StatusFilter;
  search: string;
};

export const initialUiState: UiState = { user: null, range: "24h", statusFilter: "all", search: "" };

export const uiSlice = createSlice({
  name: "ui",
  initialState: initialUiState,
  reducers: {
    setRange: (state, action: PayloadAction<Range>) => {
      state.range = action.payload;
    },
    setStatusFilter: (state, action: PayloadAction<StatusFilter>) => {
      state.statusFilter = action.payload;
    },
    setSearch: (state, action: PayloadAction<string>) => {
      state.search = action.payload;
    },
  },
});

export const { setRange, setStatusFilter, setSearch } = uiSlice.actions;
