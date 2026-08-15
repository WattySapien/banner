export function log(message: string, source = "server") {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [${source}] ${message}`);
}
