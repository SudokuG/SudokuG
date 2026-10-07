@echo off
title SudokuG generator
rem Double-click to start the SudokuG puzzle generator. It opens a page in your browser.
cd /d "%~dp0"
rem Right after installing Node.js, Windows may not know where it is yet: look in its usual folder.
where node >nul 2>nul || set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
where node >nul 2>nul || (echo Node.js was not found. Get the LTS version from https://nodejs.org, install it, and try again. & pause & exit /b 1)
if not exist node_modules (echo First run: installing the build tools, this takes a minute... & call npm install || (pause & exit /b 1))
call npm run grow
pause
