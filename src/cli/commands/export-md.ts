import { exportMarkdown } from "../../storage/markdown.js";
import { storageRoot } from "../../storage/paths.js";
import { readOption } from "../args.js";

export async function exportMdCommand(args: string[]): Promise<void> {
  const root = storageRoot(readOption(args, "--home"));
  const written = await exportMarkdown(root);
  for (const path of written) {
    process.stdout.write(`${path}\n`);
  }
}
