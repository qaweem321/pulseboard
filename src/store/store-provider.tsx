"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore } from "./store";
import type { UiState } from "./ui-slice";

export function StoreProvider({ user, children }: { user: UiState["user"]; children: React.ReactNode }) {
  const [store] = useState(() => makeStore({ user }));
  return <Provider store={store}>{children}</Provider>;
}
