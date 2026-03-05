@echo off
echo 请先在GitHub上创建仓库，然后按任意键继续...
pause

echo.
echo 请输入您的GitHub用户名:
set /p USERNAME=

echo.
echo 请输入仓库名称 (默认: option):
set /p REPO=
if "%REPO%"=="" set REPO=option

echo.
echo 添加远程仓库...
git remote add origin https://github.com/%USERNAME%/%REPO%.git

echo.
echo 推送到GitHub...
git branch -M main
git push -u origin main

echo.
echo 完成! 您的代码已上传到 https://github.com/%USERNAME%/%REPO%
pause
