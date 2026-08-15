import postgres from "postgres";

let runtimeClient: ReturnType<typeof postgres> | undefined;

export function getDatabase() {
  if (runtimeClient) return runtimeClient;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  runtimeClient = postgres(url, {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return runtimeClient;
}

export async function closeDatabase() {
  if (!runtimeClient) return;
  await runtimeClient.end({ timeout: 5 });
  runtimeClient = undefined;
}
