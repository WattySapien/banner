import postgres from "postgres";

let runtimeClient: ReturnType<typeof postgres> | undefined;
const DATABASE_OPERATION_TIMEOUT_MS=12_000;

export function resolveRuntimeDatabaseUrl(configuredUrl:string,nodeEnv=process.env.NODE_ENV){
  // Keep the configured Supabase pooler endpoint in every environment. The
  // transaction pooler (6543) is reachable over IPv4 locally, while changing
  // it to the direct database port (5432) can force an unreachable IPv6 host.
  void nodeEnv;
  return configuredUrl;
}

export function getDatabase() {
  if (runtimeClient) return runtimeClient;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  runtimeClient = postgres(resolveRuntimeDatabaseUrl(url), {
    max: 3,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 300,
    connection: {
      statement_timeout: 10_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 10_000,
    },
  });
  return runtimeClient;
}

export async function resetDatabase() {
  const client=runtimeClient;
  runtimeClient=undefined;
  if(client)await client.end({timeout:0}).catch(()=>undefined);
}

export async function withDatabaseDeadline<T>(operation:()=>Promise<T>,timeoutMs=DATABASE_OPERATION_TIMEOUT_MS):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  const timeout=new Promise<never>((_resolve,reject)=>{
    timer=setTimeout(()=>reject(Object.assign(new Error("Database operation timed out"),{code:"DATABASE_OPERATION_TIMEOUT"})),timeoutMs);
  });
  try{
    return await Promise.race([operation(),timeout]);
  }catch(error){
    if(error&&typeof error==="object"&&"code" in error&&error.code==="DATABASE_OPERATION_TIMEOUT")await resetDatabase();
    throw error;
  }finally{
    if(timer)clearTimeout(timer);
  }
}

export async function closeDatabase() {
  const client=runtimeClient;
  runtimeClient = undefined;
  if(client)await client.end({ timeout: 5 });
}
