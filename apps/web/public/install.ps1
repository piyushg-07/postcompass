# PostCompass installer for Windows 10 and 11 (64-bit).
#
#   irm https://www.postcompass.cloud/install.ps1 | iex
#
# Downloads the latest release's installer and installs it silently for the current user
# (no admin rights). Files downloaded by PowerShell aren't marked as coming from the
# internet, so SmartScreen doesn't stop the install.

# Run in a script block so these settings don't leak into the user's PowerShell session
& {
    $ErrorActionPreference = 'Stop'
    # The progress bar makes Invoke-WebRequest many times slower in Windows PowerShell 5.1
    $ProgressPreference = 'SilentlyContinue'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $repo = 'piyushg-07/postcompass'

    if (-not [Environment]::Is64BitOperatingSystem) {
        throw 'PostCompass needs 64-bit Windows 10 or 11.'
    }

    # Latest release version, e.g. "0.1.0"
    $release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'postcompass-installer' }
    $version = $release.tag_name.TrimStart('v')
    $file = "PostCompass_${version}_x64-setup.exe"
    $installer = Join-Path $env:TEMP $file

    Write-Host "Downloading PostCompass $version..."
    Invoke-WebRequest "https://github.com/$repo/releases/download/v$version/$file" -OutFile $installer -UseBasicParsing

    Write-Host 'Installing...'
    # /S installs silently; the installer is per-user, so no admin prompt
    $process = Start-Process $installer -ArgumentList '/S' -Wait -PassThru
    Remove-Item $installer -ErrorAction SilentlyContinue
    if ($process.ExitCode -ne 0) {
        throw "The installer exited with code $($process.ExitCode)."
    }

    $app = Join-Path $env:LOCALAPPDATA 'PostCompass\PostCompass.exe'
    if (Test-Path $app) {
        Write-Host "Installed PostCompass $version. Opening it..."
        Start-Process $app
    } else {
        Write-Host "Installed PostCompass $version. Open it from the Start menu."
    }
}
