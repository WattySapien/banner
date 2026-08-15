export async function apiRequest(
  endpoint: string,
  method: string = "GET",
  data?: unknown,
) {
  const response = await fetch(endpoint, {
    method,
    credentials: "include",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw Object.assign(new Error(error.message ?? "API request failed"), {
      status: response.status,
      details: error,
    });
  }

  if (response.status === 204) return null;
  return response.json();
}
