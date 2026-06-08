import { Service } from "node-windows";
import { serviceConfig } from "./config";

// Run with: npm run service:uninstall
// Requires an elevated (Administrator) shell.

function main(): void {
  const svc = new Service({
    name: serviceConfig.name,
    script: serviceConfig.script,
  });

  svc.on("uninstall", () => {
    console.log(`✔ Service "${serviceConfig.name}" uninstalled.`);
    process.exit(0);
  });
  svc.on("alreadyuninstalled", () => {
    console.log(`Service "${serviceConfig.name}" was not installed.`);
    process.exit(0);
  });
  svc.on("error", (err: unknown) => {
    console.error("Service error:", err);
    process.exit(1);
  });

  svc.uninstall();
}

main();
