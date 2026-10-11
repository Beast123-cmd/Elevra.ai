/**
 * Navigation for the shared app shell. Pure data plus two helpers, so the menu per role and the "which item is
 * active" rule can be tested without a browser. Icons are attached by name in AppShell.
 */
export type ShellRole = "admin" | "faculty" | "student";

export type IconName =
  | "overview" | "workload" | "interventions" | "notifications" | "queue" | "attendance" | "segments"
  | "dataHealth" | "method" | "evidence" | "chat" | "users" | "demo" | "home" | "plan" | "certifications"
  | "hackathons" | "events" | "interview" | "inbox";

export interface NavItem { href: string; label: string; icon: IconName; exact?: boolean }
export interface NavGroup { label: string | null; items: NavItem[] }

const INSIGHTS: NavItem[] = [
  { href: "/insights/data-health", label: "Data Health", icon: "dataHealth" },
  { href: "/insights/method", label: "Method & Trust", icon: "method" },
];

export const NAV: Record<ShellRole, NavGroup[]> = {
  admin: [
    { label: null, items: [{ href: "/admin", label: "Overview", icon: "overview", exact: true }] },
    {
      label: "Act",
      items: [
        { href: "/admin/workload", label: "Response & workload", icon: "workload" },
        { href: "/admin/interventions", label: "Interventions", icon: "interventions" },
        { href: "/admin/notifications", label: "Notifications", icon: "notifications" },
      ],
    },
    {
      label: "Students",
      items: [
        { href: "/faculty", label: "Action Queue", icon: "queue" },
        { href: "/faculty/attendance", label: "Attendance", icon: "attendance" },
        { href: "/insights/segments", label: "Segments", icon: "segments" },
      ],
    },
    { label: "Data & trust", items: [...INSIGHTS, { href: "/admin/evidence", label: "Evidence", icon: "evidence" }] },
    {
      label: "Tools",
      items: [
        { href: "/admin/chat", label: "Ask your data", icon: "chat" },
        { href: "/admin/users", label: "Users", icon: "users" },
        { href: "/demo", label: "Guided demo", icon: "demo" },
      ],
    },
  ],
  faculty: [
    {
      label: null,
      items: [
        { href: "/faculty", label: "My students", icon: "queue" },
        { href: "/faculty/attendance", label: "Attendance", icon: "attendance" },
        { href: "/insights/segments", label: "Segments", icon: "segments" },
      ],
    },
    { label: "Data & trust", items: INSIGHTS },
    { label: "Help", items: [{ href: "/demo", label: "Guided demo", icon: "demo" }] },
  ],
  student: [
    {
      label: null,
      items: [
        { href: "/student", label: "Home", icon: "home", exact: true },
        { href: "/student/improve", label: "My plan", icon: "plan" },
        { href: "/student/certifications", label: "Certifications", icon: "certifications" },
        { href: "/student/hackathons", label: "Hackathons", icon: "hackathons" },
        { href: "/student/annual-events", label: "Annual events", icon: "events" },
        { href: "/student/interview", label: "Mock interview", icon: "interview" },
        { href: "/student/notifications", label: "Inbox", icon: "inbox" },
      ],
    },
  ],
};

/**
 * Whether a menu item is the current page. "/faculty" must not light up on "/faculty/attendance", but it should on a
 * student's page ("/faculty/student/123"), which is reached from the queue.
 */
export function isActive(path: string, item: NavItem): boolean {
  if (item.exact) return path === item.href;
  if (item.href === "/faculty") return path === "/faculty" || path.startsWith("/faculty/student");
  return path === item.href || path.startsWith(`${item.href}/`);
}

/** The menu to show before the signed-in role is known: guessed from the URL, so the first paint is right. */
export function roleFromPath(path: string): ShellRole {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/student")) return "student";
  return "faculty";
}

/** The label of the current page, for the top bar on small screens. */
export function currentLabel(path: string, role: ShellRole): string | null {
  for (const group of NAV[role]) for (const item of group.items) if (isActive(path, item)) return item.label;
  return null;
}
