#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

// --- CONFIG ---
const projectDir = path.resolve(__dirname, "../"); // your project root
const plistName = "com.koko.copyai.plist";
const plistPath = path.join(os.homedir(), "Library/LaunchAgents", plistName);

// --- Helper to detect npm and node ---
let npmPath, nodePath;
try {
  // Try current environment first
  nodePath = execSync("which node", { encoding: "utf-8" }).trim();
  npmPath = execSync("which npm", { encoding: "utf-8" }).trim();
} catch {
  console.error("Cannot find npm or node. Make sure Node.js is installed.");
  process.exit(1);
}

// --- Check for NVM ---
const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), ".nvm");
const nvmNodePath = path.join(nvmDir, "versions/node", "v" + process.version.slice(1), "bin", "node");
const nvmNpmPath = path.join(nvmDir, "versions/node", "v" + process.version.slice(1), "bin", "npm");

if (fs.existsSync(nvmNodePath) && fs.existsSync(nvmNpmPath)) {
  nodePath = nvmNodePath;
  npmPath = nvmNpmPath;
}

// --- Plist content ---
const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.koko.copyai</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>export NVM_DIR="${nvmDir}"; [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"; cd "${projectDir}" && ${npmPath} start</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${projectDir}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${path.dirname(nodePath)}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>

    <key>StandardOutPath</key>
    <string>${path.join(projectDir, "log.txt")}</string>

    <key>StandardErrorPath</key>
    <string>${path.join(projectDir, "error.txt")}</string>
</dict>
</plist>
`;

// Write plist file
fs.writeFileSync(plistPath, plistContent, { encoding: "utf-8" });
console.log(`LaunchAgent plist created at ${plistPath}`);

// Reload plist
try { execSync(`launchctl unload ${plistPath}`, { stdio: "ignore" }); } catch {}
execSync(`launchctl load ${plistPath}`);
console.log("LaunchAgent loaded successfully.");
