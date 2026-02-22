import { readFileSync, rmSync } from "node:fs";
import { getFilesToPack, createTarArchive } from "./node_modules/alpic/dist/lib/archive.js";
import { uploadToPresignedUrl } from "./node_modules/alpic/dist/lib/upload.js";
import { api } from "./node_modules/alpic/dist/api.js";

const envId = "env_s0qz0aqg1thw8tlvhmuxd";

console.log("Packing files...");
const files = getFilesToPack(".");
console.log(`Packed ${files.length} files`);
const { tmpDir, archivePath } = await createTarArchive(files, ".");
const buffer = readFileSync(archivePath);
console.log(`Archive: ${archivePath} (${buffer.byteLength} bytes)`);

console.log("Requesting upload URL...");
const { uploadUrl, token } = await api.deployments.uploadArtifact.v1();

console.log("Uploading...");
await uploadToPresignedUrl(uploadUrl, buffer);
console.log("Uploaded. Token:", token);

console.log("Starting deploy...");
const deploy = await api.environments.deploy.v1({
  environmentId: envId,
  token,
});
console.log("Deploy ID:", deploy.id, "Status:", deploy.status);

// Poll for completion
let status = deploy.status;
while (status === "ongoing") {
  await new Promise(r => setTimeout(r, 10000));
  const d = await api.deployments.get.v1({ deploymentId: deploy.id });
  status = d.status;
  console.log("Status:", status);
}
console.log("Final status:", status);

// Cleanup
rmSync(tmpDir, { recursive: true, force: true });
