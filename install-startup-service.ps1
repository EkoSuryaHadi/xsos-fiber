$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = [Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupFolder 'Xenoptics-NMS-Proxy.lnk'

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = 'wscript.exe'
$Shortcut.Arguments = '"""E:\Project\Nms\start-proxy-hidden.vbs"""'
$Shortcut.WorkingDirectory = 'E:\Project\Nms'
$Shortcut.Description = 'Auto-start Xenoptics NMS Backend Proxy on Windows boot'
$Shortcut.Save()

Write-Host "Startup shortcut created successfully at: $ShortcutPath"
