@echo off
echo Fixing role case mismatch...
echo.

REM Push schema changes
echo Step 1: Pushing Prisma schema changes...
call npx prisma db push --skip-generate
echo.

REM Run the fix script
echo Step 2: Updating roles in database...
call node fix-roles-lowercase.js
echo.

echo Done!
pause
