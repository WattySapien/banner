export function log(message: string, source = "server") {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [${source}] ${message}`);
}

export function logEvent(event: string, fields: Record<string, unknown>, source = "server") {
  log(JSON.stringify({ event, ...fields }), source);
}
