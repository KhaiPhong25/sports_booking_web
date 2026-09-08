import { createServer, Server } from "node:http";
import { WorkerRuntime } from "./runtime";

export function startHealthServer(
  runtime: WorkerRuntime,
  port: number,
): Server {
  return createServer((_request, response) => {
    const ready = runtime.isReady();
    response.statusCode = ready ? 200 : 503;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ status: ready ? "ready" : "unavailable" }));
  }).listen(port, "0.0.0.0");
}
