@echo off
setlocal

:: Change to the directory where the script is located
cd /d "%~dp0"

:: Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Git is not installed. Please install Git and run this script again.
    exit /b 1
)

:: Clone the NocoDB repository if not already cloned
if not exist "nocodb" (
    git clone https://github.com/nocodb/nocodb.git
)

cd nocodb

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js and run this script again.
    exit /b 1
)

:: Install pnpm if not installed
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing pnpm...
    npm install -g pnpm
)

:: Install project dependencies
pnpm install

:: Run Docker Compose to set up the environment
if not exist "docker-compose/pg" (
    echo Docker Compose files not found.
    exit /b 1
)

cd docker-compose/pg

:: Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not installed. Please install Docker and run this script again.
    exit /b 1
)

:: Start NocoDB with PostgreSQL using Docker
docker-compose up -d

echo NocoDB setup complete. Access the dashboard at http://localhost:8080/dashboard

endlocal
pause
