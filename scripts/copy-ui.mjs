import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist/src/ui", { recursive: true, force: true });
await mkdir("dist/src/ui", { recursive: true });
await cp("src/ui", "dist/src/ui", { recursive: true });
