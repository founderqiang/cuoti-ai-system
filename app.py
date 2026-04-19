"""
初中数学错题归因与靶向变式智能生成系统 - 后端服务
============================================
功能模块：
1. 数据分析与可视化 - 解析 Excel 成绩单，输出知识点薄弱分析数据
2. 推理预测与策略辅助 - AI 错因归因 + 讲评策略建议
3. 内容生成 - 靶向变式训练题生成（接入国产大模型）
"""

import os
import json
import traceback
from io import BytesIO

import pandas as pd
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv, set_key

load_dotenv()

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# ── 大模型客户端配置 ──────────────────────────────────────────
LLM_API_KEY = os.getenv('LLM_API_KEY', '')
LLM_BASE_URL = os.getenv('LLM_BASE_URL', 'https://api.deepseek.com/v1')
LLM_MODEL = os.getenv('LLM_MODEL', 'deepseek-chat')

client = None
if LLM_API_KEY:
    client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)


# ── 工具函数 ──────────────────────────────────────────────────
def parse_excel(file_bytes: bytes, filename: str):
    """
    解析教师上传的 Excel 成绩/错题统计表，支持两种格式：
    格式A（成绩单模式）：行=学生, 列=知识点题目, 单元格=得分/满分
    格式B（错题统计模式）：行=知识点, 列=错误人数/总人数/错误率
    自动检测格式并统一输出分析结果
    """
    df = pd.read_excel(BytesIO(file_bytes), engine='openpyxl')
    
    # 尝试检测格式
    columns = list(df.columns)
    
    result = {
        'raw_columns': columns,
        'total_students': 0,
        'knowledge_points': [],
        'format_detected': '',
        'student_details': []
    }
    
    # 格式B检测：如果存在"知识点"/"错误率"等关键列名
    format_b_keywords = ['知识点', '错误率', '错误人数', '错题数', '薄弱点']
    is_format_b = any(kw in str(col) for col in columns for kw in format_b_keywords)
    
    if is_format_b:
        result['format_detected'] = 'B-错题统计表'
        # 尝试找到知识点列和错误率列
        kp_col = None
        error_rate_col = None
        error_count_col = None
        total_col = None
        
        for col in columns:
            col_str = str(col)
            if '知识点' in col_str or '章节' in col_str or '考点' in col_str:
                kp_col = col
            elif '错误率' in col_str or '错率' in col_str:
                error_rate_col = col
            elif '错误人数' in col_str or '错题数' in col_str or '错误' in col_str:
                error_count_col = col
            elif '总人数' in col_str or '总数' in col_str or '满分人数' in col_str:
                total_col = col
        
        if kp_col is None:
            kp_col = columns[0]
        
        for _, row in df.iterrows():
            kp_name = str(row[kp_col])
            if pd.isna(row[kp_col]) or kp_name.strip() == '':
                continue
                
            if error_rate_col and not pd.isna(row.get(error_rate_col)):
                rate_val = row[error_rate_col]
                if isinstance(rate_val, str):
                    rate_val = float(rate_val.replace('%', '')) / 100
                error_rate = float(rate_val)
            elif error_count_col and total_col:
                err_c = float(row[error_count_col])
                tot_c = float(row[total_col])
                error_rate = err_c / tot_c if tot_c > 0 else 0
            else:
                # 使用数值列作为错误率
                numeric_cols = [c for c in columns if c != kp_col]
                vals = [row[c] for c in numeric_cols if not pd.isna(row.get(c))]
                if vals:
                    error_rate = float(vals[0])
                    if error_rate > 1:
                        error_rate = error_rate / 100
                else:
                    error_rate = 0
            
            result['knowledge_points'].append({
                'name': kp_name.strip(),
                'error_rate': round(error_rate, 4),
                'error_count': int(row[error_count_col]) if error_count_col and not pd.isna(row.get(error_count_col)) else 0,
                'mastery_rate': round(1 - error_rate, 4)
            })
    else:
        # 格式A：成绩单模式，行=学生, 列=知识点得分
        result['format_detected'] = 'A-成绩单模式'
        
        # 第一列通常是学生姓名/学号
        student_col = columns[0]
        kp_columns = columns[1:]  # 其余列为知识点
        
        result['total_students'] = len(df)
        
        # 分析每个知识点的错误率
        for kp_col in kp_columns:
            col_str = str(kp_col)
            if '姓名' in col_str or '学号' in col_str or '班级' in col_str:
                continue
            
            col_data = pd.to_numeric(df[kp_col], errors='coerce')
            valid_data = col_data.dropna()
            
            if len(valid_data) == 0:
                continue
            
            # 判断是百分制还是01制
            max_val = valid_data.max()
            if max_val > 1:
                # 百分制或具体分数，需要推断满分
                if max_val <= 10:
                    full_score = 10
                elif max_val <= 20:
                    full_score = 20
                elif max_val <= 50:
                    full_score = 50
                else:
                    full_score = 100
                score_rates = valid_data / full_score
            else:
                score_rates = valid_data
            
            avg_score_rate = float(score_rates.mean())
            error_rate = round(1 - avg_score_rate, 4)
            
            # 收集每个学生的得分情况
            student_scores = []
            for idx, row in df.iterrows():
                if not pd.isna(row[kp_col]):
                    student_scores.append({
                        'student': str(row[student_col]) if not pd.isna(row[student_col]) else f'学生{idx+1}',
                        'score': float(row[kp_col]),
                        'score_rate': float(row[kp_col] / full_score) if max_val > 1 else float(row[kp_col])
                    })
            
            result['knowledge_points'].append({
                'name': col_str.strip(),
                'error_rate': error_rate,
                'error_count': int(sum(1 for s in score_rates if s < 0.6)),
                'mastery_rate': round(avg_score_rate, 4),
                'student_scores': student_scores
            })
        
        # 构建学生详细数据
        for idx, row in df.iterrows():
            student_name = str(row[student_col]) if not pd.isna(row[student_col]) else f'学生{idx+1}'
            scores = {}
            for kp_col in kp_columns:
                if not pd.isna(row.get(kp_col)):
                    scores[str(kp_col)] = float(row[kp_col])
            result['student_details'].append({
                'name': student_name,
                'scores': scores
            })
    
    # 按错误率排序（从高到低）
    result['knowledge_points'].sort(key=lambda x: x['error_rate'], reverse=True)
    
    return result


def call_llm(system_prompt: str, user_prompt: str, temperature: float = 0.7):
    """调用国产大模型"""
    if not client:
        return "[错误] 未配置大模型API密钥，请在 .env 文件中设置 LLM_API_KEY"
    
    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=temperature,
            max_tokens=4096
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"[大模型调用出错] {str(e)}"


# ── API 路由 ──────────────────────────────────────────────────

@app.route('/')
def serve_index():
    """服务前端页面"""
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/api/upload', methods=['POST'])
def upload_excel():
    """
    功能1: 数据分析与可视化
    上传 Excel 文件，解析并返回知识点薄弱分析结果
    """
    if 'file' not in request.files:
        return jsonify({'error': '请上传Excel文件'}), 400
    
    file = request.files['file']
    if not file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({'error': '仅支持 .xlsx / .xls 格式的Excel文件'}), 400
    
    try:
        file_bytes = file.read()
        analysis = parse_excel(file_bytes, file.filename)
        return jsonify({
            'success': True,
            'data': analysis
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': f'解析Excel失败: {str(e)}'}), 500


@app.route('/api/diagnose', methods=['POST'])
def diagnose_errors():
    """
    功能2: 推理预测与策略辅助
    对错误率极高的知识点进行错因归因诊断，并生成讲评策略
    """
    data = request.json
    knowledge_points = data.get('knowledge_points', [])
    grade_info = data.get('grade_info', '初中')
    exam_info = data.get('exam_info', '月考')
    
    if not knowledge_points:
        return jsonify({'error': '请提供知识点数据'}), 400
    
    # 构建分析提示词
    system_prompt = """你是一位资深初中数学教研专家，拥有20年一线教学及教研经验。
请根据教师上传的班级测验错题数据，进行专业的错因归因分析，并提供切实可行的讲评策略。

输出要求：
1. 对每个薄弱知识点给出2-3个可能的具体错因（如"计算粗心"、"辅助线构造方法不当"、"公式记忆混淆"等）
2. 错因分析要有针对性，结合初中数学学情特点
3. 给出下节课的讲评策略建议（包括讲评重点、教学方法建议、时间分配建议等）
4. 用JSON格式输出，结构为：
{
  "diagnosis": [
    {
      "knowledge_point": "知识点名称",
      "error_rate": 0.xx,
      "error_causes": ["错因1", "错因2", "错因3"],
      "cause_details": "对错因的详细分析说明",
      "severity": "高/中/低"
    }
  ],
  "teaching_strategy": {
    "review_focus": "讲评重点说明",
    "methods": ["方法1", "方法2"],
    "time_allocation": "时间分配建议",
    "homework_suggestion": "课后作业建议"
  },
  "overall_analysis": "全班整体学情总结"
}"""

    kp_text = "\n".join([
        f"- {kp['name']}: 错误率{kp['error_rate']*100:.1f}%, 掌握率{kp.get('mastery_rate', 1-kp['error_rate'])*100:.1f}%"
        for kp in knowledge_points
    ])
    
    user_prompt = f"""以下是{grade_info}班级{exam_info}后的数学知识点薄弱统计数据：

{kp_text}

请进行详细的错因归因分析，并为教师提供下节课的讲评策略建议。请直接输出JSON，不要包含markdown代码块标记。"""

    result = call_llm(system_prompt, user_prompt, temperature=0.5)
    
    # 尝试解析JSON
    try:
        # 寻找第一个 { 和最后一个 }
        start_idx = result.find('{')
        end_idx = result.rfind('}')
        if start_idx != -1 and end_idx != -1:
            cleaned = result[start_idx:end_idx+1]
        else:
            cleaned = result.strip()
            
        parsed = json.loads(cleaned, strict=False)
        return jsonify({'success': True, 'data': parsed, 'raw': result})
    except Exception:
        return jsonify({'success': True, 'data': None, 'raw': result})


@app.route('/api/generate', methods=['POST'])
def generate_variants():
    """
    功能3: 内容生成
    针对薄弱知识点自动生成3-5道难度递进的变式训练题及详细解析
    """
    data = request.json
    knowledge_point = data.get('knowledge_point', '')
    error_causes = data.get('error_causes', [])
    difficulty = data.get('difficulty', '递进')  # 递进/基础/提升
    count = data.get('count', 5)
    grade = data.get('grade', '初三')
    
    if not knowledge_point:
        return jsonify({'error': '请指定需要生成变式题的知识点'}), 400
    
    system_prompt = rf"""你是一位顶尖的初中数学命题专家，专精于设计高质量的变式训练题。

核心要求：
1. 根据给定的薄弱知识点和错因分析，设计{count}道有针对性的变式训练题
2. 题目难度必须呈递进梯度排列（★ 基础巩固 → ★★ 能力提升 → ★★★ 拓展挑战）
3. 每一道题都必须具有极强的针对性，直接瞄准学生的典型错因进行矫正
4. 必须提供详细的解题步骤和易错点提醒
5. 题目要新颖，避免简单改数字的低级变式
6. 【纯文本无图排版，禁用LaTeX】：坚决不使用SVG或代码绘图。使用高质量文字描述图形，让学生自行画图。【极其重要】：绝不能使用任何 LaTeX 数学代码（严禁出现 `\frac`, `\Rightarrow` 等）！所有的数学公式必须写成键盘能直接敲出的纯字符形式（例如使用 `b/(2a)`，`x^2`，`=>`），保证导出到普通 Word 后肉眼直接可读。
7. 【详略得当与防止截断】：为了防止输出过长被断开，必须严格控制节奏：每道题的【详细解析】需保持在 400 字左右，可以比400字少点，但不能超出太多。既要清晰地展示核心等式、关键定理和主干推导步骤以保证学生能看懂，也要点到为止，【绝对禁止】过度发散、举无关特例或啰嗦计算细节！必须且只能生成 {count} 道题目，满 {count} 题立刻收尾。

输出格式要求：
请直接输出纯文本（使用清晰的中文排版，方便教师直接复制到Word中），不要使用任何JSON格式，也不要包含任何英文的格式标签。
推荐排版方式如下：

# [知识点名称] 靶向变式训练
针对错因：[错因1]、[错因2]

## 一、基础巩固（★）
**【题目 1】**
(考查要点：...)
已知...
（如果是含图题，请紧接着在这里输出您手写的完整 SVG 标签代码，无需markdown代码块包裹，直接闭合 `<svg><path ... /></svg>`）

**【参考答案】**
...

**【详细解析】**
...

**【易错点提醒】**
...

## 二、能力提升（★★）
...以此类推"""

    error_causes_text = '、'.join(error_causes) if error_causes else '未指定'
    
    user_prompt = rf"""请为{grade}数学生成针对以下薄弱知识点的变式训练题：

知识点：{knowledge_point}
学生常见错因：{error_causes_text}
需要生成：{count}道题
难度要求：{difficulty}（从基础到拓展递进排列）

请按照纯文本中文排版直接输出你的变式题，方便直接复制进入 Word。请勿输出 JSON。"""

    from flask import Response, stream_with_context
    
    if not client:
        return jsonify({'error': '未配置大模型API密钥'}), 500
        
    try:
        completion = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.8,
            max_tokens=4096,
            stream=True
        )
        
        def generate():
            for chunk in completion:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
                    
        return Response(stream_with_context(generate()), mimetype='text/plain')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/generate_sample', methods=['GET'])
def generate_sample_data():
    """生成示例 Excel 数据，方便演示使用"""
    import random
    
    knowledge_points = [
        '全等三角形判定', '二次函数图像', '一元二次方程',
        '勾股定理应用', '相似三角形', '概率统计',
        '圆的性质', '反比例函数', '一次函数综合',
        '几何证明综合'
    ]
    
    students = [f'学生{i+1}' for i in range(40)]
    
    data = {'姓名': students}
    
    # 设置不同知识点的基准正确率
    base_rates = {
        '全等三角形判定': 0.55,
        '二次函数图像': 0.45,
        '一元二次方程': 0.70,
        '勾股定理应用': 0.65,
        '相似三角形': 0.50,
        '概率统计': 0.75,
        '圆的性质': 0.60,
        '反比例函数': 0.55,
        '一次函数综合': 0.68,
        '几何证明综合': 0.40,
    }
    
    for kp in knowledge_points:
        base = base_rates.get(kp, 0.6)
        scores = []
        for _ in students:
            # 10分满分
            score = max(0, min(10, round(random.gauss(base * 10, 2))))
            scores.append(score)
        data[kp] = scores
    
    df = pd.DataFrame(data)
    
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='月考成绩')
    buffer.seek(0)
    
    from flask import send_file
    return send_file(
        buffer,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='示例_月考成绩数据.xlsx'
    )


@app.route('/api/render_plot', methods=['POST'])
def render_plot():
    """接收前台传来的 Matplotlib 代码由 AI 编写，在沙箱执行后返回图片 base64"""
    data = request.json
    code = data.get('code', '')
    if not code:
        return jsonify({'error': '未提供绘图代码'}), 400
        
    import io
    import base64
    import matplotlib
    matplotlib.use('Agg')  # 后台静默生成，禁用交互界面
    import matplotlib.pyplot as plt
    import numpy as np
    
    # 强制清理画布环境
    plt.clf()
    plt.close('all')
    
    try:
        # 为 LLM 的代码提供干净的执行命名空间
        local_scope = {'plt': plt, 'np': np, 'matplotlib': matplotlib}
        exec(code, local_scope, local_scope)
        
        # 将绘制的图表存入内存
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close('all')
        
        return jsonify({'success': True, 'image': img_base64})
    except Exception as e:
        plt.close('all')
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings', methods=['GET', 'POST'])
def manage_settings():
    """管理并持久化大语言模型的配置项"""
    global LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, client
    env_file = os.path.join(os.path.dirname(__file__), '.env')
    
    if request.method == 'GET':
        masked_key = f"sk-***{LLM_API_KEY[-4:]}" if len(LLM_API_KEY) > 10 else ""
        return jsonify({
            'api_key': masked_key,
            'base_url': LLM_BASE_URL,
            'model': LLM_MODEL
        })
        
    if request.method == 'POST':
        data = request.json
        new_key = data.get('api_key', '').strip()
        new_url = data.get('base_url', '').strip()
        new_model = data.get('model', '').strip()
        
        try:
            if not os.path.exists(env_file):
                open(env_file, 'a').close()  # 如果不存在则创建空文件
                
                
            # 更新内存变量
            if new_key and not new_key.startswith('sk-***'): LLM_API_KEY = new_key
            if new_url: LLM_BASE_URL = new_url
            if new_model: LLM_MODEL = new_model
            
            # 使用后台线程延迟半秒写入 .env，防止刚一写入触发 Flask 热重载直接杀死了现在的 HTTP 响应进程
            def save_env():
                if new_key and not new_key.startswith('sk-***'): set_key(env_file, 'LLM_API_KEY', new_key)
                if new_url: set_key(env_file, 'LLM_BASE_URL', new_url)
                if new_model: set_key(env_file, 'LLM_MODEL', new_model)
            import threading
            threading.Timer(0.5, save_env).start()
                
            # 立即热重载底层连接客户端
            if LLM_API_KEY:
                client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)
                
            return jsonify({'success': True, 'msg': '配置已保存并即时生效！无需重启后端。'})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'llm_configured': bool(LLM_API_KEY),
        'llm_model': LLM_MODEL
    })


if __name__ == '__main__':
    print("=" * 60)
    print("  初中数学错题归因与靶向变式智能生成系统")
    print("  服务启动中...")
    print(f"  大模型状态: {'已配置 (' + LLM_MODEL + ')' if LLM_API_KEY else '未配置 - 请设置 .env'}")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
