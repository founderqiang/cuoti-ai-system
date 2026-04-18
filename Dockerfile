FROM python:3.12-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量，确保 Python 产生的输出能直接在日志中看到
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 复制依赖文件并安装（显式安装 setuptools，避免 gunicorn 在精简镜像中缺少 pkg_resources）
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

# 复制其余代码
COPY . .

# 暴露端口
EXPOSE 8080

# 启动命令：直接调用 gunicorn
CMD ["sh", "-c", "gunicorn backend.app:app -b 0.0.0.0:${PORT:-8080} --timeout 120"]
