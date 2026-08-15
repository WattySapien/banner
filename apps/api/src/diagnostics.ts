const errorStages = new WeakMap<object, string>();

export type ErrorDiagnostic = {
  status: number;
  code: string;
  message: string;
  stage: string;
};

const errorCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;

export async function atStage<T>(stage: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error && typeof error === "object") {
      if (!errorStages.has(error)) errorStages.set(error, stage);
      throw error;
    }
    const wrapped = new Error("A non-error value was thrown", { cause: error });
    errorStages.set(wrapped, stage);
    throw wrapped;
  }
}

export function classifyError(error: unknown): ErrorDiagnostic {
  const stage = error && typeof error === "object" ? errorStages.get(error) ?? "request.unhandled" : "request.unhandled";
  const code = errorCode(error);

  if (code === "23505") return { status: 409, code: "RECORD_CONFLICT", message: "A record with those details already exists", stage };
  if (code === "28P01") return { status: 503, code: "DATABASE_AUTH_FAILED", message: "Database authentication failed", stage };
  if (code === "42P01" || code === "42703") return { status: 503, code: "DATABASE_SCHEMA_MISSING", message: "Database schema is not initialized", stage };
  if (code === "CONNECT_TIMEOUT" || code === "ETIMEDOUT") return { status: 503, code: "DATABASE_TIMEOUT", message: "Database connection timed out", stage };
  if (code === "DATABASE_OPERATION_TIMEOUT" || code === "57014") return { status: 503, code: "DATABASE_OPERATION_TIMEOUT", message: "Database operation timed out", stage };
  if (code === "ENETUNREACH" || code === "ECONNREFUSED" || code === "ENOTFOUND") return { status: 503, code: "DATABASE_UNREACHABLE", message: "Database is unreachable", stage };
  if (code === "53300" || code === "57P03") return { status: 503, code: "DATABASE_UNAVAILABLE", message: "Database is temporarily unavailable", stage };

  if (error instanceof Error && "status" in error && typeof error.status === "number") {
    return { status: error.status, code: "REQUEST_REJECTED", message: error.message, stage };
  }

  return { status: 500, code: "INTERNAL_SERVER_ERROR", message: "Internal Server Error", stage };
}

export function errorType(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}
