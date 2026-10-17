@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-FictionlogWriter.ps1" %*
exit /b %ERRORLEVEL%
