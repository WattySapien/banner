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

async function uploadAvatarTo(endpoint: string, file: File) {
  const response = await fetch(endpoint, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw Object.assign(new Error(error.message ?? "Profile image upload failed"), {
      status: response.status,
      details: error,
    });
  }

  return response.json();
}

export function uploadAvatar(file: File) {
  return uploadAvatarTo("/api/settings/avatar", file);
}

export function uploadAdminAvatar(userId: string, file: File) {
  return uploadAvatarTo(`/api/admin/users/${encodeURIComponent(userId)}/avatar`, file);
}
