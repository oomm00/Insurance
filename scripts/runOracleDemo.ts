import 'dotenv/config';
import { ethers } from 'ethers';
import path from 'path';

const RPC = process.env.RPC_URL || 'http://localhost:8545';
const PK = process.env.PRIVATE_KEY || '';
const MOCK = process.env.MOCK_ORACLE_ADDRESS || '';
const INTERVAL = Number(process.env.ORACLE_INTERVAL_SEC || '10');

if (!MOCK) {
  console.error('MOCK_ORACLE_ADDRESS not set in .env');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = PK ? new ethers.Wallet(PK, provider) : provider;

async function main() {
  const abiPath = path.join(__dirname, '..', 'frontend', 'src', 'abi', 'MockOracle.abi.json');
  const abi = require(abiPath);
  const oracle = new ethers.Contract(MOCK, abi, wallet as any);

  let id = Number(process.argv[2] || '0');
  if (id === 0) id = 1;

  console.log('Starting mock oracle demo: will trigger policy', id, 'every', INTERVAL, 's');
  while (true) {
    try {
      const tx = await oracle.fulfillTrigger(id);
      console.log('Sent fulfillTrigger tx:', tx.hash);
      await tx.wait();
      console.log('Confirmed');
    } catch (e: any) {
      console.error('Error triggering:', e.message || e);
    }
    await new Promise((r) => setTimeout(r, INTERVAL * 1000));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
