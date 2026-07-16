import { storageRoot } from "../../storage/paths.js";
import { startServer } from "../../web/server.js";
import { readOption } from "../args.js";

export async function webCommand(args: string[]): Promise<void> {
  const root = storageRoot(readOption(args, "--home"));
  const port = Number(readOption(args, "--port") ?? "4873");
  await startServer(root, port);
}
