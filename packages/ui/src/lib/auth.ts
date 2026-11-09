/** Authentification du mode web (le bureau n'en a pas besoin). */
async function post(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Hamac": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { email?: string; error?: string };
  if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
  return json;
}

export const auth = {
  async me(): Promise<string | null> {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    return ((await res.json()) as { email: string }).email;
  },
  async config(): Promise<{ signup: "invite" | "open" | "closed"; firstUser: boolean }> {
    return (await fetch("/api/auth/config")).json();
  },
  login: (email: string, password: string) => post("/api/auth/login", { email, password }),
  signup: (email: string, password: string, invite?: string) => post("/api/auth/signup", { email, password, invite }),
  logout: () => post("/api/auth/logout"),
  changePassword: (current: string, next: string) => post("/api/auth/password", { current, next }),
};
