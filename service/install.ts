import { existsSync } from "node:fs";
import { Service } from "node-windows";
import { serviceConfig } from "./config";

// Run with: npm run service:install
// Requires an elevated (Administrator) shell.

function main(): void {
  if (!existsSync(serviceConfig.script)) {
    console.error(
      `Build artifact not found: ${serviceConfig.script}\n` +
        `Run \`npm run build\` first so the service has something to launch.`,
    );
    process.exit(1);
  }

  const svc = new Service({
    name: serviceConfig.name,
    description: serviceConfig.description,
    script: serviceConfig.script,
    workingDirectory: serviceConfig.projectRoot,
    nodeOptions: ["--enable-source-maps"],
    env: [...serviceConfig.envExtras],
  });

  svc.on("install", () => {
    console.log(`✔ Service "${serviceConfig.name}" installed.`);
    console.log("  Starting it now…");
    svc.start();
  });
  svc.on("alreadyinstalled", () => {
    console.log(
      `Service "${serviceConfig.name}" is already installed. ` +
        `Uninstall first if you want to reinstall with new settings.`,
    );
    process.exit(0);
  });
  svc.on("start", () => {
    console.log(`✔ Service "${serviceConfig.name}" started.`);
    console.log(
      "  Manage it with: services.msc, or `net start ${serviceConfig.name}` / `net stop`.",
    );
    process.exit(0);
  });
  svc.on("error", (err: unknown) => {
    console.error("Service error:", err);
    process.exit(1);
  });

  svc.install();
}

main();
