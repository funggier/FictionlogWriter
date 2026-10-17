@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-FictionlogWriter.ps1" %*
exit /b %ERRORLEVEL%
