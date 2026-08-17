import type { Handler, HandlerResponse } from "@netlify/functions";
import serverless from "serverless-http";
import { createApp } from "../../src/app.js";

// Mark images as binary at the adapter boundary. This makes serverless-http
// base64-encode the original response Buffer instead of first converting its
// bytes to UTF-8 text (which irreversibly corrupts PNG, JPEG, and WebP data).
const expressHandler = serverless(createApp(), { binary: ["image/*"] });

function isHandlerResponse(value: object): value is HandlerResponse {
  return "statusCode" in value && typeof value.statusCode === "number";
}

export const handler: Handler = async (event, context) => {
  const response = await expressHandler(event, context);
  if (!isHandlerResponse(response)) throw new Error("The API Function returned an invalid Netlify response");
  return response;
};
