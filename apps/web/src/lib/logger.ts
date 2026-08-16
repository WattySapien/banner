import log from "loglevel";

log.setLevel(import.meta.env.DEV ? "debug" : "silent", false);

export const logger = log;
