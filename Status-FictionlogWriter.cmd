@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Status-FictionlogWriter.ps1" %*
exit /b %ERRORLEVEL%
