import assert from "node:assert/strict";
import { test } from "node:test";
import { currentLabel, isActive, NAV, roleFromPath, type ShellRole } from "./nav.ts";

const all = (role: ShellRole) => NAV[role].flatMap((g) => g.items);

test("exactly one menu item is active on each page an admin can open", () => {
  for (const path of ["/admin", "/admin/workload", "/faculty", "/faculty/attendance", "/faculty/student/40001", "/insights/segments", "/admin/users"]) {
    const active = all("admin").filter((i) => isActive(path, i));
    assert.equal(active.length, 1, `${path}: ${active.map((i) => i.label).join(", ")}`);
  }
});

test("Overview is not active on admin sub-pages, and the queue is active on a student's page", () => {
  const overview = all("admin").find((i) => i.href === "/admin")!;
  assert.equal(isActive("/admin/workload", overview), false);
  const queue = all("faculty").find((i) => i.href === "/faculty")!;
  assert.equal(isActive("/faculty/student/40001", queue), true);
  assert.equal(isActive("/faculty/attendance", queue), false);
});

test("a prefix is not a match: /student/hackathons does not light up a hypothetical /student/hack", () => {
  assert.equal(isActive("/student/hackathons", { href: "/student/hack", label: "x", icon: "home" }), false);
});

test("hrefs are unique within each role's menu and every role has a home", () => {
  for (const role of ["admin", "faculty", "student"] as ShellRole[]) {
    const hrefs = all(role).map((i) => i.href);
    assert.equal(new Set(hrefs).size, hrefs.length, role);
  }
  assert.equal(currentLabel("/admin", "admin"), "Overview");
  assert.equal(currentLabel("/faculty", "faculty"), "My students");
  assert.equal(currentLabel("/student", "student"), "Home");
});

test("the menu shown before sign-in data loads is guessed from the URL", () => {
  assert.equal(roleFromPath("/admin/evidence"), "admin");
  assert.equal(roleFromPath("/student/improve"), "student");
  assert.equal(roleFromPath("/faculty"), "faculty");
  assert.equal(roleFromPath("/insights/method"), "faculty");
});
