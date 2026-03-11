# Stop any existing Hardhat node processes
Get-Process | Where-Object { $_.ProcessName -eq "node" -and $_.CommandLine -like "*hardhat node*" } | Stop-Process

# Start local Hardhat node (in a new window)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd'; npx hardhat node"

# Wait for node to start
Start-Sleep -Seconds 5

# Compile contracts
Write-Host "Compiling contracts..."
npx hardhat compile

# Deploy contracts
Write-Host "Deploying contracts..."
npx hardhat run scripts/localDeploy.ts --network localhost

# Copy ABIs
Write-Host "Copying ABIs to frontend..."
npx hardhat run scripts/copyAbi.ts

# Install frontend dependencies and start
Write-Host "Setting up frontend..."
cd frontend
npm install
npm run dev