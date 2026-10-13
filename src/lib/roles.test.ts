import { hasRole, highestRole } from "./roles";

test("highestRole picks the strongest Pulseboard role and ignores the rest", () => {
  expect(highestRole(["offline_access", "viewer", "editor"])).toBe("editor");
  expect(highestRole(["admin"])).toBe("admin");
  expect(highestRole(["uma_authorization"])).toBeNull();
});

test("roles include the ones below them", () => {
  expect(hasRole("admin", "editor")).toBe(true);
  expect(hasRole("editor", "editor")).toBe(true);
  expect(hasRole("viewer", "editor")).toBe(false);
  expect(hasRole(null, "viewer")).toBe(false);
});
