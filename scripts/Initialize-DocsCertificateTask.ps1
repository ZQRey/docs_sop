# Run on dc01.gp1.loc as an administrator. Renew-DocsCertificate.ps1 must be adjacent.
param([Parameter(Mandatory = $true)][string]$SshHostPublicKey)
$ErrorActionPreference = 'Stop'
Import-Module ActiveDirectory
$taskDirectory = 'C:\ProgramData\DocsSopTLS'
New-Item -ItemType Directory -Path $taskDirectory -Force | Out-Null
$taskAcl = New-Object Security.AccessControl.DirectorySecurity
$taskAcl.SetAccessRuleProtection($true, $false)
foreach ($taskSid in 'S-1-5-18', 'S-1-5-32-544') {
    $taskRule = New-Object Security.AccessControl.FileSystemAccessRule(
        (New-Object Security.Principal.SecurityIdentifier($taskSid)), 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $taskAcl.AddAccessRule($taskRule)
}
Set-Acl -LiteralPath $taskDirectory -AclObject $taskAcl
Copy-Item "$PSScriptRoot\Renew-DocsCertificate.ps1" "$taskDirectory\Renew-DocsCertificate.ps1" -Force
if (-not (Test-Path "$taskDirectory\id_ed25519")) {
    $taskProcess = Start-Process -FilePath 'C:\Windows\System32\OpenSSH\ssh-keygen.exe' -ArgumentList "-t ed25519 -N `"`" -f `"$taskDirectory\id_ed25519`" -C DocsSopTLS" -WindowStyle Hidden -Wait -PassThru
    if ($taskProcess.ExitCode -ne 0) { throw 'SSH key generation failed' }
}
$taskKeyAcl = New-Object Security.AccessControl.FileSecurity
$taskSystemSid = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
$taskKeyAcl.SetOwner($taskSystemSid)
$taskKeyAcl.SetAccessRuleProtection($true, $false)
$taskKeyAcl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($taskSystemSid, 'FullControl', 'Allow')))
Set-Acl -LiteralPath "$taskDirectory\id_ed25519" -AclObject $taskKeyAcl
$taskKeyParts = $SshHostPublicKey.Split(' ')
[IO.File]::WriteAllText("$taskDirectory\known_hosts", "172.16.16.62 $($taskKeyParts[0]) $($taskKeyParts[1])`n", [Text.Encoding]::ASCII)
$taskConfiguration = (Get-ADRootDSE).configurationNamingContext
$taskPki = "CN=Public Key Services,CN=Services,$taskConfiguration"
$taskTemplates = "CN=Certificate Templates,$taskPki"
$taskTemplateDn = "CN=DocsSopTLS,$taskTemplates"
$taskExisting = Get-ADObject -LDAPFilter '(cn=DocsSopTLS)' -SearchBase $taskTemplates
if (-not $taskExisting) {
    $taskSource = Get-ADObject "CN=WebServer,$taskTemplates" -Properties *
    $taskAttributes = @{}
    foreach ($taskProperty in 'flags','pKIDefaultKeySpec','pKIKeyUsage','pKIMaxIssuingDepth','pKICriticalExtensions','pKIExpirationPeriod','pKIOverlapPeriod','pKIExtendedKeyUsage','pKIDefaultCSPs','msPKI-RA-Signature','msPKI-Enrollment-Flag','msPKI-Private-Key-Flag','msPKI-Certificate-Name-Flag','msPKI-Minimal-Key-Size') {
        $taskValue = $taskSource.$taskProperty
        if ($null -ne $taskValue -and $taskValue.Count -gt 0) {
            if ($taskValue -is [Microsoft.ActiveDirectory.Management.ADPropertyValueCollection]) {
                if ($taskValue.Count -eq 1) { $taskAttributes[$taskProperty] = $taskValue[0] }
                else { $taskAttributes[$taskProperty] = [object[]]$taskValue }
            } else { $taskAttributes[$taskProperty] = $taskValue }
        }
    }
    $taskOidRoot = (Get-ADObject "CN=OID,$taskPki" -Properties msPKI-Cert-Template-OID).'msPKI-Cert-Template-OID'
    if (-not $taskOidRoot) { throw 'Forest template OID root not found' }
    $taskOid = "$taskOidRoot.$(Get-Random -Minimum 10000000 -Maximum 99999999).$(Get-Random -Minimum 10000000 -Maximum 99999999)"
    New-ADObject -Name ([guid]::NewGuid().ToString()) -Type 'msPKI-Enterprise-Oid' -Path "CN=OID,$taskPki" -DisplayName 'Docs SOP TLS' -OtherAttributes @{ 'msPKI-Cert-Template-OID' = $taskOid; flags = 1 }
    $taskAttributes['msPKI-Cert-Template-OID'] = $taskOid
    $taskAttributes['msPKI-Template-Schema-Version'] = 2
    $taskAttributes['msPKI-Template-Minor-Revision'] = 1
    $taskAttributes['revision'] = 100
    $taskAttributes['msPKI-Minimal-Key-Size'] = 3072
    $taskAttributes['pKIExpirationPeriod'] = [BitConverter]::GetBytes(-[long]([TimeSpan]::FromDays(365).Ticks))
    $taskAttributes['pKIOverlapPeriod'] = [BitConverter]::GetBytes(-[long]([TimeSpan]::FromDays(30).Ticks))
    $taskAttributes['msPKI-Certificate-Name-Flag'] = 1
    $taskAttributes['msPKI-Enrollment-Flag'] = 0
    $taskAttributes['pKIExtendedKeyUsage'] = '1.3.6.1.5.5.7.3.1'
    New-ADObject -Name 'DocsSopTLS' -Type 'pKICertificateTemplate' -Path $taskTemplates -DisplayName 'Docs SOP TLS' -OtherAttributes $taskAttributes
}
# Only the CA computer account gets an explicit enrollment grant on this new template.
$taskCaSid = (Get-ADComputer DC01).SID
$taskAdPath = "AD:\$taskTemplateDn"
$taskTemplateAcl = Get-Acl $taskAdPath
$taskRead = New-Object DirectoryServices.ActiveDirectoryAccessRule($taskCaSid, 'GenericRead', 'Allow')
$taskEnroll = New-Object DirectoryServices.ActiveDirectoryAccessRule($taskCaSid, 'ExtendedRight', 'Allow', [guid]'0e10c968-78fb-11d2-90d4-00c04f79dc55')
$taskTemplateAcl.SetAccessRule($taskRead)
$taskTemplateAcl.SetAccessRule($taskEnroll)
Set-Acl -Path $taskAdPath -AclObject $taskTemplateAcl
& certutil.exe -SetCATemplates +DocsSopTLS | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Publishing TLS template failed' }
$taskAction = New-ScheduledTaskAction -Execute 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$taskDirectory\Renew-DocsCertificate.ps1`""
$taskTriggers = @((New-ScheduledTaskTrigger -Daily -At '03:15'), (New-ScheduledTaskTrigger -AtStartup))
$taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName 'DocsSopTLS-Renew' -Action $taskAction -Trigger $taskTriggers -Principal $taskPrincipal -Settings $taskSettings -Description 'Renew docs.gp1.loc TLS certificate through local AD CS; rotate Linux key and reload Nginx 30 days before expiry.' -Force | Out-Null
Get-Content "$taskDirectory\id_ed25519.pub"
