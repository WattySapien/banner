import type { Handler, HandlerResponse } from "@netlify/functions";
import serverless from "serverless-http";
import { createApp } from "../../src/app.js";

const expressHandler = serverless(createApp());

function isHandlerResponse(value: object): value is HandlerResponse {
  return "statusCode" in value && typeof value.statusCode === "number";
}

export const handler: Handler = async (event, context) => {
  const response = await expressHandler(event, context);
  if (!isHandlerResponse(response)) throw new Error("The API Function returned an invalid Netlify response");
  return response;
};
