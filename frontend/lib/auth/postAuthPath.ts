import type { AuthUser } from "@/types/user";

// Where a session lands right after logging in — and where an
// already-authenticated visitor to /login is bounced to. Admins go
// straight to the admin panel; everyone else to their dashboard.
//
// Role is the ONLY signal used here (never the display name, phone, or
// email — "Admin" as a name means nothing). The backend re-checks
// users.role='admin' on every admin request regardless.
export function postAuthPath(user: Pick<AuthUser, "role"> | null | undefined): string {
  return user?.role === "admin" ? "/admin" : "/dashboard";
}
