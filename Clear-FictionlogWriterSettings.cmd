@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Clear-FictionlogWriterSettings.ps1" %*
exit /b %ERRORLEVEL%
