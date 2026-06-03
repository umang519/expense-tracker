// Thin fetch wrapper for client components.
// Redirects to /login on 401 so an expired session is handled everywhere automatically.
export async function clientFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    window.location.replace("/login");
    throw new Error("Session expired");
  }
  return res;
}
