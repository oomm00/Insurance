import path from "path";
import dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition-ethers";

// Load .env relative to project root (this file's directory), not CWD
dotenv.config({ path: path.resolve(__dirname, ".env") });

const PRIVATE_KEY_RAW = process.env.PRIVATE_KEY || "";
const RPC_URL = process.env.RPC_URL || "";

function isValidPrivateKeyHex(value: string): boolean {
  // Must be 0x followed by 64 hex chars (32 bytes)
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

const accounts = isValidPrivateKeyHex(PRIVATE_KEY_RAW) ? [PRIVATE_KEY_RAW] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: RPC_URL,
      accounts,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};

export default config;
