import fs from 'fs';
import path from 'path';

async function copyArtifacts() {
  // Create frontend/src/abi directory if it doesn't exist
  const abiDir = path.join(__dirname, '../frontend/src/abi');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  // List of contracts to copy
  const contracts = ['Policy', 'Treasury', 'MockOracle'];

  for (const contract of contracts) {
    const artifactPath = path.join(__dirname, `../artifacts/contracts/${contract}.sol/${contract}.json`);
    const targetPath = path.join(abiDir, `${contract}.abi.json`);

    try {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      fs.writeFileSync(targetPath, JSON.stringify(artifact.abi, null, 2));
      console.log(`Copied ABI for ${contract}`);
    } catch (err) {
      console.error(`Error copying ABI for ${contract}:`, err);
    }
  }
}

copyArtifacts().catch(console.error);