' VBScript to run Xenoptics NMS Proxy silently in the background
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

batPath = scriptDir & "\run-backend-proxy.bat"
WshShell.Run """" & batPath & """", 0, False
Set WshShell = Nothing
Set fso = Nothing
