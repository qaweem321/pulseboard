import { ThemeProvider } from "@mui/material/styles";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import type { Role } from "@/lib/roles";
import { makeStore } from "@/store/store";
import { theme } from "./theme";

// Renders with the real Redux store and MUI theme, as a user with the given role.
export function renderWithProviders(ui: React.ReactElement, { role = "editor" as Role | null } = {}) {
  const store = makeStore({ user: { name: "Ada Lovelace", email: "ada@example.com", role } });
  return {
    store,
    ...render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>{ui}</ThemeProvider>
      </Provider>,
    ),
  };
}
