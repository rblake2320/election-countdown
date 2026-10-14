# Owner-authorized production test. Test credentials are encrypted at rest with Windows DPAPI.
$ErrorActionPreference='Stop'
$taskSecretsDir = Join-Path (Get-Location) '.local/friend-visibility'
New-Item -ItemType Directory -Path $taskSecretsDir -Force | Out-Null
foreach ($taskRole in @('friend','stranger')) {
  $taskSecretPath = Join-Path $taskSecretsDir ($taskRole+'.dpapi')
  if (-not (Test-Path -LiteralPath $taskSecretPath)) {
    $taskRandom = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))+'aA9!'
    $taskSecure = ConvertTo-SecureString $taskRandom -AsPlainText -Force
    $taskSecure | ConvertFrom-SecureString | Set-Content -LiteralPath $taskSecretPath
    $taskSecure.Dispose()
    $taskRandom=$null
  }
}
$taskOwnerSecret=(Get-Content -LiteralPath .local/production-profile-20261014/password.dpapi -Raw).Trim() | ConvertTo-SecureString
$taskFriendSecret=(Get-Content -LiteralPath .local/friend-visibility/friend.dpapi -Raw).Trim() | ConvertTo-SecureString
$taskStrangerSecret=(Get-Content -LiteralPath .local/friend-visibility/stranger.dpapi -Raw).Trim() | ConvertTo-SecureString
$env:LIVE_PROFILE_TEST_PASSWORD=[Net.NetworkCredential]::new('',$taskOwnerSecret).Password
$env:LIVE_FRIEND_PASSWORD=[Net.NetworkCredential]::new('',$taskFriendSecret).Password
$env:LIVE_STRANGER_PASSWORD=[Net.NetworkCredential]::new('',$taskStrangerSecret).Password
try {
  node tests/e2e/production-friend-visibility.mjs *> .local/friend-visibility/run.log
  $taskExit=$LASTEXITCODE
} finally {
  Remove-Item Env:LIVE_PROFILE_TEST_PASSWORD,Env:LIVE_FRIEND_PASSWORD,Env:LIVE_STRANGER_PASSWORD -ErrorAction SilentlyContinue
  $taskOwnerSecret.Dispose();$taskFriendSecret.Dispose();$taskStrangerSecret.Dispose()
}
exit $taskExit
