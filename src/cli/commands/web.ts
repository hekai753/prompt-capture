import { storageRoot } from "../../storage/paths.js";
import {
  startWebServerInBackground,
  stopWebServer,
  webServerStatus,
  writeWebServerState,
} from "../../web/daemon.js";
import { startServer } from "../../web/server.js";
import { hasFlag, readOption } from "../args.js";

export async function webCommand(args: string[]): Promise<void> {
  const root = storageRoot(readOption(args, "--home"));
  const port = Number(readOption(args, "--port") ?? "4873");
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${readOption(args, "--port") ?? "4873"}`);
  }
  const action = args.find((arg) => arg === "status" || arg === "stop" || arg === "start");

  if (action === "status") {
    const status = await webServerStatus(root);
    if (status.running) {
      process.stdout.write(`running ${status.state.url} pid=${status.state.pid} home=${status.state.home}\n`);
    } else {
      process.stdout.write(`stopped (${status.reason})\n`);
    }
    return;
  }

  if (action === "stop") {
    const status = await stopWebServer(root);
    process.stdout.write(`stopped ${status.state?.url ?? ""}\n`.trimEnd() + "\n");
    return;
  }

  if (hasFlag(args, "--background") || hasFlag(args, "-d")) {
    const state = await startWebServerInBackground(root, port);
    process.stdout.write(`prompt-capture web running in background: ${state.url}\npid=${state.pid}\nlog=${state.logPath}\n`);
    return;
  }

  await startServer(root, port);
  if (process.env.PROMPT_CAPTURE_WEB_DAEMON === "1") {
    await writeWebServerState(root, port);
  }
}
