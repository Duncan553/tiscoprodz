import { isAdmin } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { Dashboard } from "@/components/admin/Dashboard";

/**
 * /admin — the only page behind the password.
 *
 * The check happens on the SERVER, before anything renders. A client-side
 * "if (!loggedIn) redirect" ships the dashboard markup to everyone and hides it
 * with JavaScript, which is not a gate. Here, a visitor without a valid session
 * cookie receives the login form and nothing else.
 *
 * The API routes check again (requireAdmin in every one). This page controls what
 * is VISIBLE; those checks control what can HAPPEN, and they are the real
 * boundary — never trust that a request came from your own UI.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage() {
  if (!(await isAdmin())) return <LoginForm />;
  return <Dashboard />;
}
