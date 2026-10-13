import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { hasRole, type Role } from "@/lib/roles";
import { api } from "./api";
import { initialUiState, uiSlice, type UiState } from "./ui-slice";

const rootReducer = combineReducers({ ui: uiSlice.reducer, [api.reducerPath]: api.reducer });

// One store per request on the server and per page load in the browser (never a module singleton,
// which would leak one user's data into another's render).
export function makeStore(ui: Partial<UiState> = {}) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: { ui: { ...initialUiState, ...ui } },
    middleware: (getDefault) => getDefault().concat(api.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

export function useCan(required: Role): boolean {
  return useAppSelector((state) => hasRole(state.ui.user?.role ?? null, required));
}
