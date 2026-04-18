# 采用轻量级 Python 官方基础镜像
FROM python:3.12-slim

# ！！Hugging Face 强制安全要求！！
# 必须使用非 root 用户运行应用，否则将导致权限拒绝报错
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

# 设置工作目录
WORKDIR /home/user/app

# 复制运行依赖并优先安装（利用缓存机制加速之后的构建）
COPY --chown=user requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 把所有的代码文件复制进工作区
COPY --chown=user . /home/user/app

# Hugging Face Spaces & Zeabur 兼容性要求：网页服务必须监听动态端口
# Zeabur 会自动通过 $PORT 环境变量传递
EXPOSE 8080

# 启动口令：使用工业级 Gunicorn 拉起 Flask，绑定在 $PORT 端口
# 如果 $PORT 未定义，则默认使用 8080
CMD ["sh", "-c", "gunicorn backend.app:app -b 0.0.0.0:${PORT:-8080} --timeout 120"]

