@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 build.py
) else if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" build.py
) else (
  python build.py
)
if errorlevel 1 (
  echo Build failed. Check that Python 3 is installed and content.json is valid.
  pause
  exit /b 1
)
start "" "%~dp0site\index.html"
