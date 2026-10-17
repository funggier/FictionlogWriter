@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Stop-FictionlogWriter.ps1" %*
exit /b %ERRORLEVEL%
