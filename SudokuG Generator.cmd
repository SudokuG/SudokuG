@echo off
title SudokuG generator
rem Double-click to start the SudokuG puzzle generator. It opens a page in your browser.
cd /d "%~dp0"
where node >/dev/null 2>/dev/null || (echo Node.js is not installed. Get the LTS version from https://nodejs.org and try again. & pause & exit /b 1)
if not exist node_modules (echo First run: installing the build tools, this takes a minute... & call npm install || (pause & exit /b 1))
call npm run grow
pause
