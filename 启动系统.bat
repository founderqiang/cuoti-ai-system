@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════
echo   初中数学错题归因与靶向变式智能生成系统
echo   启动脚本
echo ═══════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

REM 检查Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到Python，请先安装Python 3.8+
    pause
    exit /b 1
)

REM 检查虚拟环境
if not exist "backend\.venv" (
    echo [信息] 正在创建虚拟环境...
    python -m venv backend\.venv
)

REM 激活虚拟环境
call backend\.venv\Scripts\activate.bat

REM 安装依赖
echo [信息] 正在检查依赖...
pip install -r requirements.txt -q

REM 检查.env配置
if not exist "backend\.env" (
    echo.
    echo ═══════════════════════════════════════════════════════
    echo [提示] 未找到 backend\.env 配置文件！
    echo 请复制 backend\.env.example 为 backend\.env
    echo 并填入你的大模型API密钥（如DeepSeek API Key）
    echo ═══════════════════════════════════════════════════════
    echo.
    copy backend\.env.example backend\.env >nul 2>&1
    echo 已自动创建 .env 文件，请编辑填入API密钥后重新启动。
    notepad backend\.env
    pause
    exit /b 0
)

echo.
echo [信息] 正在启动服务...
echo [信息] 访问地址: http://localhost:5000
echo [信息] 按 Ctrl+C 停止服务
echo.

python backend\app.py
pause
