param([switch]$Force)
$ErrorActionPreference = 'Stop'
$taskDirectory = 'C:\ProgramData\DocsSopTLS'
Start-Transcript -Path "$taskDirectory\task-output.log" -Append | Out-Null
$taskSsh = 'C:\Windows\System32\OpenSSH\ssh.exe'
$taskSshOptions = @('-i', "$taskDirectory\id_ed25519", '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', "UserKnownHostsFile=$taskDirectory\known_hosts", '-o', 'ConnectTimeout=15', 'zqrey@172.16.16.62')
function Invoke-TaskSsh([string]$Operation, [string]$InputText = '') {
    $taskStartInfo = New-Object Diagnostics.ProcessStartInfo
    $taskStartInfo.FileName = $taskSsh
    $taskStartInfo.Arguments = (($taskSshOptions + $Operation) | ForEach-Object { '"' + $_ + '"' }) -join ' '
    $taskStartInfo.UseShellExecute = $false
    $taskStartInfo.CreateNoWindow = $true
    $taskStartInfo.RedirectStandardOutput = $true
    $taskStartInfo.RedirectStandardError = $true
    $taskStartInfo.RedirectStandardInput = $true
    $taskNative = [Diagnostics.Process]::Start($taskStartInfo)
    try {
        $taskOutputRead = $taskNative.StandardOutput.ReadToEndAsync()
        $taskErrorRead = $taskNative.StandardError.ReadToEndAsync()
        $taskNative.StandardInput.Write($InputText)
        $taskNative.StandardInput.Close()
        if (-not $taskNative.WaitForExit(180000)) { $taskNative.Kill(); throw 'SSH operation timed out' }
        $taskOutputText = $taskOutputRead.GetAwaiter().GetResult()
        $taskErrorText = $taskErrorRead.GetAwaiter().GetResult()
        if ($taskNative.ExitCode -ne 0) { throw "SSH $Operation failed: $taskErrorText $taskOutputText" }
        return $taskOutputText
    } finally { $taskNative.Dispose() }
}
$taskMutex = New-Object Threading.Mutex($false, 'Global\DocsSopTLSRenewal')
if (-not $taskMutex.WaitOne(0)) { exit 0 }
try {
    $taskCurrent = Invoke-TaskSsh 'status'
    if (($taskCurrent -join "`n") -match '-----BEGIN CERTIFICATE-----') {
        $taskBase64 = (($taskCurrent -join '') -replace '-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s', '')
        $taskCertificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2(,[Convert]::FromBase64String($taskBase64))
        if (-not $Force -and $taskCertificate.NotAfter.ToUniversalTime() -gt [DateTime]::UtcNow.AddDays(30)) {
            "$(Get-Date -Format o) OK expires=$($taskCertificate.NotAfter.ToString('o'))" | Add-Content "$taskDirectory\renewal.log"
            exit 0
        }
    }
    $taskCsr = Invoke-TaskSsh 'csr'
    [IO.File]::WriteAllText("$taskDirectory\request.pem", ($taskCsr -join "`n") + "`n", [Text.Encoding]::ASCII)
    $taskResponse = "$taskDirectory\issued.cer"
    $taskOutput = & certreq.exe -submit -q -f -config 'dc01.gp1.loc\gp1-DC01-CA' -attrib 'CertificateTemplate:DocsSopTLS' "$taskDirectory\request.pem" $taskResponse 2>&1
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $taskResponse)) { throw "Certificate issuance failed: $taskOutput" }
    $taskIssued = New-Object Security.Cryptography.X509Certificates.X509Certificate2($taskResponse)
    $taskPem = "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($taskIssued.RawData, [Base64FormattingOptions]::InsertLineBreaks) + "`n-----END CERTIFICATE-----`n"
    $taskInstall = Invoke-TaskSsh 'install' $taskPem
    if ($taskInstall -notmatch 'INSTALLED') { throw 'Certificate installation or Nginx reload failed' }
    "$(Get-Date -Format o) RENEWED serial=$($taskIssued.SerialNumber) expires=$($taskIssued.NotAfter.ToString('o'))" | Add-Content "$taskDirectory\renewal.log"
} catch {
    "$(Get-Date -Format o) ERROR $($_.Exception.Message)" | Add-Content "$taskDirectory\renewal.log"
    Write-Error $_ -ErrorAction Continue
    exit 1
} finally {
    $taskMutex.ReleaseMutex()
    $taskMutex.Dispose()
}
