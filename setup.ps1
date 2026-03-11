# Start local Hardhat node (in a new window)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd'; npx hardhat node"

# Wait for node to start
Start-Sleep -Seconds 5

# Deploy contracts
npx hardhat run scripts/localDeploy.ts --network localhost

# Install frontend dependencies and start
cd frontend
npm install
npm run dev