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

async function uploadAvatarTo(endpoint: string, file: File, onProgress?: (progress: number) => void) {
  const optimized = await optimizeAvatar(file);
  const upload = () => new Promise<Response>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", endpoint);
    request.withCredentials = true;
    request.setRequestHeader("Content-Type", optimized.type);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)); };
    request.onload = () => resolve(new Response(request.responseText, { status: request.status, headers: { "Content-Type": request.getResponseHeader("Content-Type") ?? "application/json" } }));
    request.onerror = () => reject(new Error("Profile image upload failed"));
    request.send(optimized);
  });
  let response = await upload();
  if (response.status === 503) {
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    response = await upload();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw Object.assign(new Error(error.message ?? "Profile image upload failed"), {
      status: response.status,
      details: error,
    });
  }

  return response.json();
}

async function optimizeAvatar(file: File): Promise<Blob> {
  // Keep avatar uploads small enough for slow networks and low-memory phones.
  // A 512px WebP is more than sufficient for the 16–64px UI avatar sizes.
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) { bitmap.close(); return file; }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const optimized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.78));
    return optimized && optimized.size < file.size ? optimized : file;
  } catch {
    return file;
  }
}

export function uploadAvatar(file: File, onProgress?: (progress: number) => void) {
  return uploadAvatarTo("/api/settings/avatar", file, onProgress);
}

export function uploadAdminAvatar(userId: string, file: File, onProgress?: (progress: number) => void) {
  return uploadAvatarTo(`/api/admin/users/${encodeURIComponent(userId)}/avatar`, file, onProgress);
}
