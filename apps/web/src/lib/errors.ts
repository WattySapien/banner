export function isUnauthorizedError(error: any): boolean {
  return (
    error?.status === 401 ||
    error?.message?.toLowerCase().includes('unauthorized') ||
    error?.statusText?.toLowerCase().includes('unauthorized') ||
    error?.message?.includes('No active session')
  );
}
