@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Restart-FictionlogWriter.ps1" %*
exit /b %ERRORLEVEL%
