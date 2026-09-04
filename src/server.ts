import { PORT, superdocLicenseKey } from "./config/env.js";
import { createApp } from "./app.js";
import { getHost } from "./hosts/sdk-host.js";

async function main() {
  superdocLicenseKey();
  const app = await createApp();
  await getHost().getClient();
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`morph listening on ${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
