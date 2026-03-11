import fs from "fs";
import path from "path";

const CONTRACTS = ["Policy", "Treasury", "MockOracle"];

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const root = process.cwd();
  const artifactsRoot = path.join(root, "artifacts", "contracts");
  const outDir = path.join(root, "artifacts", "abi");
  ensureDir(outDir);
  // Mirror to frontend if present
  const feAbiDir = path.join(root, "frontend", "src", "abi");
  ensureDir(feAbiDir);

  for (const name of CONTRACTS) {
    const artifactPath = path.join(artifactsRoot, `${name}.sol`, `${name}.json`);
    if (!fs.existsSync(artifactPath)) {
      console.warn(`Missing artifact for ${name}: ${artifactPath}`);
      continue;
    }
    const content = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abi = content.abi ?? [];
    const outPath = path.join(outDir, `${name}.abi.json`);
    fs.writeFileSync(outPath, JSON.stringify(abi, null, 2), "utf8");
    console.log(`Exported ABI: ${outPath}`);

    // Copy into frontend
    const fePath = path.join(feAbiDir, `${name}.abi.json`);
    fs.writeFileSync(fePath, JSON.stringify(abi, null, 2), "utf8");
    console.log(`Copied ABI to frontend: ${fePath}`);
  }
}

main();
