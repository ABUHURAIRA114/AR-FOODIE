export async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/csrf/", { credentials: "include" });
  const data = await res.json();
  return data.csrfToken;
}
export async function checkAuth(): Promise<{ is_staff: boolean; is_user: boolean; username?: string }> {
  const res = await fetch("/api/me/", { credentials: "include" });
  return res.json();
}

export async function checkUserAuth(): Promise<{ is_user: boolean; username?: string }> {
  const res = await fetch("/api/user-me/", { credentials: "include" });
  return res.json();
}

async function readJsonResponse(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export async function registerRequest(username: string, password: string) {
  const csrfToken = await getCsrfToken();
  const res = await fetch("/api/user-register/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
    body: JSON.stringify({ username, password }),
  });

  const data = await readJsonResponse(res);
  if (!res.ok) throw new Error(data.error || "User Register failed");
  return data;
}

export async function loginRequest(username: string, password: string) {
  const csrfToken = await getCsrfToken();
  const res = await fetch("/api/user-login/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
    body: JSON.stringify({ username, password }),
  });

  const data = await readJsonResponse(res);
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
}


export async function logoutRequest() {
  const csrfToken = await getCsrfToken();
  await fetch("/api/user-logout/", {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRFToken": csrfToken },
  });
}
