import { createApp } from "./app.js";
import { config } from "./config.js";
import { log } from "./logger.js";
import { storage as postgresStorage } from "./storage.js";

if(!process.env.DATABASE_URL&&config.isProduction)throw new Error("DATABASE_URL is required in production");
const storage=process.env.DATABASE_URL?postgresStorage:new (await import("./storage.sqlite.js")).SQLiteStorage();
const app=createApp(storage);
const server=app.listen(config.port,config.host,()=>{log(`Ardenvia Bank API running at http://${config.host}:${config.port}`);log(`${storage.kind} storage is active`,"storage");});
server.on("error",(error)=>{log(error.message,"fatal");process.exitCode=1;});
