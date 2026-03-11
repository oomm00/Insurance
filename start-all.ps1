# Stop any existing node processes using port 8545
$processes = Get-NetTCPConnection -LocalPort 8545 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($processes) {
    Stop-Process -Id $processes -Force
}

Write-Host "Starting Hardhat node..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd'; npx hardhat node" -WindowStyle Normal

Write-Host "Waiting for node to start..."
Start-Sleep -Seconds 5

Write-Host "Compiling contracts..."
npx hardhat compile

Write-Host "Deploying contracts..."
npx hardhat run scripts/localDeploy.ts --network localhost | Tee-Object -Variable deployOutput

# Extract addresses from deploy output
$policyAddress = ($deployOutput | Select-String "Policy: (0x\w+)").Matches.Groups[1].Value
$treasuryAddress = ($deployOutput | Select-String "Treasury: (0x\w+)").Matches.Groups[1].Value
$mockOracleAddress = ($deployOutput | Select-String "MockOracle: (0x\w+)").Matches.Groups[1].Value

Write-Host "Updating .env files with contract addresses..."

# Update backend/.env
$backendEnv = Get-Content backend/.env -Raw
$backendEnv = $backendEnv -replace "POLICY_ADDRESS=.*", "POLICY_ADDRESS=$policyAddress"
$backendEnv = $backendEnv -replace "TREASURY_ADDRESS=.*", "TREASURY_ADDRESS=$treasuryAddress"
$backendEnv = $backendEnv -replace "MOCK_ORACLE_ADDRESS=.*", "MOCK_ORACLE_ADDRESS=$mockOracleAddress"
Set-Content backend/.env $backendEnv

# Update frontend/.env
$frontendEnv = Get-Content frontend/.env -Raw
$frontendEnv = $frontendEnv -replace "VITE_POLICY_ADDRESS=.*", "VITE_POLICY_ADDRESS=$policyAddress"
$frontendEnv = $frontendEnv -replace "VITE_TREASURY_ADDRESS=.*", "VITE_TREASURY_ADDRESS=$treasuryAddress"
$frontendEnv = $frontendEnv -replace "VITE_MOCK_ORACLE_ADDRESS=.*", "VITE_MOCK_ORACLE_ADDRESS=$mockOracleAddress"
Set-Content frontend/.env $frontendEnv

Write-Host "Copying ABIs to frontend..."
npx hardhat run scripts/exportAbi.ts

Write-Host "Starting backend..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd/backend'; npm run dev" -WindowStyle Normal

Write-Host "Starting frontend..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd/frontend'; npm run dev" -WindowStyle Normal

Write-Host "Setup complete! The dApp is now running:"
Write-Host "- Hardhat node: http://localhost:8545"
Write-Host "- Backend API: http://localhost:3001"
Write-Host "- Frontend: http://localhost:5173"