$env:FF_TERRITORY_ABUSE_PENALTY_ENABLED="true"
$env:FF_TERRITORY_ABUSE_PENALTY_ZERO_REWARD_ENABLED="true"
$env:FF_TERRITORY_ABUSE_PENALTY_MIN_FLIPS="3"
$env:FF_TERRITORY_ABUSE_PENALTY_LOOKBACK_HOURS="24"
$env:FF_TERRITORY_ABUSE_PENALTY_ALLOW_USER_IDS=""

Write-Host "Running Base Tests (Enabled, Zero Reward Enabled)..."
npx tsx scripts/test-phase2b2a-penalty.ts > scripts/test1.log 2>&1

Write-Host "`n`nRunning Test with Feature Flag Disabled..."
$env:FF_TERRITORY_ABUSE_PENALTY_ENABLED="false"
npx tsx scripts/test-phase2b2a-penalty.ts > scripts/test2.log 2>&1

Write-Host "`n`nRunning Gray Test Verification (Not in allowlist)..."
$env:FF_TERRITORY_ABUSE_PENALTY_ENABLED="true"
$env:FF_TERRITORY_ABUSE_PENALTY_ALLOW_USER_IDS="some-other-uuid"
npx tsx scripts/test-phase2b2a-penalty.ts > scripts/test3.log 2>&1
