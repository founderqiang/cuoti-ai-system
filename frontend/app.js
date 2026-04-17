/**
 * 初中数学错题归因与靶向变式智能生成系统 - 前端交互逻辑
 * ============================================================
 * 功能模块：
 *   1. Excel 数据上传与解析
 *   2. Chart.js 可视化（雷达图 + 柱状图）
 *   3. AI 错因归因诊断
 *   4. 靶向变式题生成
 */

const API_BASE = '';  // 同源部署，无需跨域

// ── 全局状态 ────────────────────────────────────
let analysisData = null;       // 解析后的数据
let diagnosisData = null;      // 诊断结果
let selectedKP = null;         // 当前选中的知识点
let radarChartInstance = null;
let barChartInstance = null;

// ── 初始化 ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initUpload();
    initScrollEffects();
    checkLLMStatus();
    initHeroAnimations();
});

// ── 健康检查 ────────────────────────────────────
async function checkLLMStatus() {
    const statusEl = document.getElementById('llmStatus');
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('.status-text');
    
    try {
        const res = await fetch(`${API_BASE}/api/health`);
        const data = await res.json();
        
        if (data.llm_configured) {
            dot.classList.add('connected');
            dot.classList.remove('error');
            text.textContent = `${data.llm_model} 已连接`;
        } else {
            dot.classList.add('error');
            text.textContent = '大模型未配置';
        }
    } catch {
        dot.classList.add('error');
        text.textContent = '服务未启动';
    }
}

// ── Hero 动画 ───────────────────────────────────
function initHeroAnimations() {
    // 绘制简单的mini图表作为装饰
    const card1 = document.querySelector('.card-float-1 .mini-chart');
    const card2 = document.querySelector('.card-float-2 .mini-chart');
    
    if (card1) {
        card1.innerHTML = `
            <svg viewBox="0 0 120 60" style="width:120px;height:60px;">
                <polyline points="5,55 20,35 40,42 60,18 80,28 100,12 115,22"
                    fill="none" stroke="url(#miniGrad1)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <defs><linearGradient id="miniGrad1" x1="0" y1="0" x2="120" y2="0">
                    <stop stop-color="#6366f1"/><stop offset="1" stop-color="#06b6d4"/>
                </linearGradient></defs>
            </svg>`;
    }
    if (card2) {
        card2.innerHTML = `
            <svg viewBox="0 0 120 60" style="width:120px;height:60px;">
                <rect x="5" y="35" width="14" height="20" rx="3" fill="#6366f1" opacity="0.7"/>
                <rect x="25" y="20" width="14" height="35" rx="3" fill="#8b5cf6" opacity="0.8"/>
                <rect x="45" y="28" width="14" height="27" rx="3" fill="#a78bfa" opacity="0.7"/>
                <rect x="65" y="10" width="14" height="45" rx="3" fill="#ef4444" opacity="0.8"/>
                <rect x="85" y="38" width="14" height="17" rx="3" fill="#06b6d4" opacity="0.7"/>
                <rect x="105" y="42" width="14" height="13" rx="3" fill="#10b981" opacity="0.6"/>
            </svg>`;
    }
}

// ── 滚动效果 ────────────────────────────────────
function initScrollEffects() {
    const header = document.getElementById('header');
    const navLinks = document.querySelectorAll('.nav-link');
    
    window.addEventListener('scroll', () => {
        // Header 滚动效果
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        // 导航高亮
        const sections = ['upload-section', 'analysis-section', 'generate-section'];
        let currentSection = sections[0];
        
        for (const id of sections) {
            const el = document.getElementById(id);
            if (el && el.getBoundingClientRect().top < 200) {
                currentSection = id;
            }
        }
        
        navLinks.forEach(link => {
            const section = link.getAttribute('data-section');
            if (section && currentSection.includes(section)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    });
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    }
}

// ── 文件上传 ────────────────────────────────────
function initUpload() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('fileInput');
    
    // 点击上传
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
    
    // 拖拽上传
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });
    
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
    });
    
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });
}

async function handleFileUpload(file) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        showToast('请上传 .xlsx 或 .xls 格式的Excel文件', 'error');
        return;
    }
    
    // 显示进度
    const progressEl = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressEl.style.display = 'block';
    progressFill.style.width = '30%';
    progressText.textContent = `正在上传 ${file.name}...`;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        progressFill.style.width = '60%';
        progressText.textContent = '正在解析数据...';
        
        const res = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });
        
        const result = await res.json();
        
        if (result.success) {
            progressFill.style.width = '100%';
            progressText.textContent = '解析完成！';
            
            analysisData = result.data;
            
            setTimeout(() => {
                progressEl.style.display = 'none';
                document.getElementById('uploadArea').style.display = 'none';
                showAnalysisResults();
            }, 600);
        } else {
            throw new Error(result.error || '解析失败');
        }
    } catch (err) {
        progressFill.style.width = '0%';
        progressText.textContent = `上传失败: ${err.message}`;
        showToast(`上传失败: ${err.message}`, 'error');
        
        setTimeout(() => {
            progressEl.style.display = 'none';
        }, 3000);
    }
}

function resetUpload() {
    analysisData = null;
    diagnosisData = null;
    selectedKP = null;
    
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('analysisResults').style.display = 'none';
    document.getElementById('fileInput').value = '';
    
    // 销毁旧图表
    if (radarChartInstance) { radarChartInstance.destroy(); radarChartInstance = null; }
    if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }
    
    // 重置诊断和生成区域
    document.getElementById('diagnosisContent').style.display = 'none';
    document.getElementById('diagnosisEmpty').style.display = 'block';
    document.getElementById('generateContent').style.display = 'none';
    document.getElementById('generateEmpty').style.display = 'block';
    
    // 重置知识点选择器
    document.getElementById('kpSelector').innerHTML = '<div class="empty-hint">请先上传数据分析后选择薄弱知识点</div>';
}

// ── 分析结果展示 ────────────────────────────────
function showAnalysisResults() {
    const container = document.getElementById('analysisResults');
    container.style.display = 'block';
    
    const kps = analysisData.knowledge_points;
    
    // 格式标签
    document.getElementById('formatTag').textContent = analysisData.format_detected;
    
    // 统计卡片
    const totalKps = kps.length;
    const weakKps = kps.filter(k => k.error_rate > 0.4).length;
    const avgErrorRate = kps.reduce((s, k) => s + k.error_rate, 0) / totalKps;
    const maxErrorKp = kps[0]; // 已按错误率排序
    
    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card">
            <div class="stat-label">考查知识点数</div>
            <div class="stat-value">${totalKps}</div>
            <div class="stat-extra">${analysisData.total_students ? `共 ${analysisData.total_students} 名学生` : ''}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">薄弱知识点数</div>
            <div class="stat-value danger">${weakKps}</div>
            <div class="stat-extra">错误率 > 40%</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">平均错误率</div>
            <div class="stat-value">${(avgErrorRate * 100).toFixed(1)}%</div>
            <div class="stat-extra">全班平均</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">最薄弱知识点</div>
            <div class="stat-value danger" style="font-size:20px;">${maxErrorKp.name}</div>
            <div class="stat-extra">错误率 ${(maxErrorKp.error_rate * 100).toFixed(1)}%</div>
        </div>
    `;
    
    document.getElementById('weakCount').textContent = weakKps;
    
    // 绘制图表
    renderRadarChart(kps);
    renderBarChart(kps);
    
    // 详细表格
    renderDetailTable(kps);
    
    // 更新知识点选择器
    updateKPSelector(kps);
    
    // 滚动到结果
    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// ── Chart.js 图表 ───────────────────────────────
function renderRadarChart(kps) {
    if (radarChartInstance) radarChartInstance.destroy();
    
    const ctx = document.getElementById('radarChart').getContext('2d');
    const labels = kps.map(k => k.name);
    const masteryData = kps.map(k => (k.mastery_rate * 100).toFixed(1));
    
    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: '掌握率 (%)',
                data: masteryData,
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                borderColor: '#6366f1',
                borderWidth: 2,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#fff',
                pointBorderWidth: 1,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        font: { size: 10 },
                        color: '#64708a',
                        backdropColor: 'transparent'
                    },
                    pointLabels: {
                        font: { size: 11, family: "'Noto Sans SC', sans-serif" },
                        color: '#9ca3b8'
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.06)'
                    },
                    angleLines: {
                        color: 'rgba(255,255,255,0.06)'
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e2030',
                    titleFont: { family: "'Noto Sans SC', sans-serif" },
                    bodyFont: { family: "'Noto Sans SC', sans-serif" },
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: (ctx) => `掌握率: ${ctx.raw}%`
                    }
                }
            }
        }
    });
}

function renderBarChart(kps) {
    if (barChartInstance) barChartInstance.destroy();
    
    const ctx = document.getElementById('barChart').getContext('2d');
    const labels = kps.map(k => k.name);
    const errorData = kps.map(k => (k.error_rate * 100).toFixed(1));
    
    // 颜色梯度：错误率越高颜色越红
    const colors = kps.map(k => {
        if (k.error_rate > 0.5) return '#ef4444';
        if (k.error_rate > 0.35) return '#f59e0b';
        if (k.error_rate > 0.2) return '#3b82f6';
        return '#10b981';
    });
    
    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '错误率 (%)',
                data: errorData,
                backgroundColor: colors.map(c => c + '40'),
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        font: { size: 11 },
                        color: '#64708a',
                        callback: v => v + '%'
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.04)'
                    }
                },
                y: {
                    ticks: {
                        font: { size: 12, family: "'Noto Sans SC', sans-serif" },
                        color: '#9ca3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e2030',
                    titleFont: { family: "'Noto Sans SC', sans-serif" },
                    bodyFont: { family: "'Noto Sans SC', sans-serif" },
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: (ctx) => `错误率: ${ctx.raw}%`
                    }
                }
            }
        }
    });
}

function renderDetailTable(kps) {
    const tbody = document.getElementById('detailTableBody');
    tbody.innerHTML = kps.map((kp, idx) => {
        const severity = kp.error_rate > 0.5 ? 'high' : kp.error_rate > 0.3 ? 'medium' : 'low';
        const severityLabel = severity === 'high' ? '严重' : severity === 'medium' ? '中等' : '良好';
        const errorPct = (kp.error_rate * 100).toFixed(1);
        const masteryPct = (kp.mastery_rate * 100).toFixed(1);
        
        return `
            <tr>
                <td>${idx + 1}</td>
                <td><strong>${kp.name}</strong></td>
                <td>
                    <div class="rate-bar">
                        <span>${errorPct}%</span>
                        <div class="rate-bar-track">
                            <div class="rate-bar-fill danger" style="width:${errorPct}%"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="rate-bar">
                        <span>${masteryPct}%</span>
                        <div class="rate-bar-track">
                            <div class="rate-bar-fill good" style="width:${masteryPct}%"></div>
                        </div>
                    </div>
                </td>
                <td><span class="severity-badge severity-${severity}">${severityLabel}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="selectKPAndGenerate('${kp.name}')">
                        生成变式题
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ── 知识点选择器 ────────────────────────────────
function updateKPSelector(kps) {
    const selector = document.getElementById('kpSelector');
    selector.innerHTML = kps.map(kp => {
        const rateClass = kp.error_rate > 0.5 ? 'high' : kp.error_rate > 0.3 ? 'medium' : 'low';
        return `
            <div class="kp-chip" data-kp="${kp.name}" onclick="toggleKP(this, '${kp.name}')">
                <span>${kp.name}</span>
                <span class="error-rate ${rateClass}">${(kp.error_rate * 100).toFixed(0)}%</span>
            </div>
        `;
    }).join('');
}

function toggleKP(el, name) {
    // 单选模式
    document.querySelectorAll('.kp-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedKP = name;
}

function selectKPAndGenerate(name) {
    selectedKP = name;
    
    // 高亮对应的chip
    document.querySelectorAll('.kp-chip').forEach(c => {
        if (c.dataset.kp === name) {
            c.classList.add('selected');
        } else {
            c.classList.remove('selected');
        }
    });
    
    // 滚动到生成区域
    scrollToSection('generate-section');
}

// ── AI 错因诊断 ─────────────────────────────────
async function startDiagnosis() {
    if (!analysisData) {
        showToast('请先上传Excel数据', 'error');
        return;
    }
    
    const kps = analysisData.knowledge_points;
    const grade = document.getElementById('gradeSelect').value;
    const exam = document.getElementById('examSelect').value;
    
    // 显示loading
    document.getElementById('diagnosisEmpty').style.display = 'none';
    document.getElementById('diagnosisContent').style.display = 'none';
    document.getElementById('diagnosisLoading').style.display = 'block';
    
    // 滚动到诊断区域
    scrollToSection('analysis-section');
    
    // 禁用按钮
    const btn = document.getElementById('btnDiagnose');
    btn.disabled = true;
    btn.innerHTML = '<span>正在诊断中...</span>';
    
    try {
        const res = await fetch(`${API_BASE}/api/diagnose`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                knowledge_points: kps,
                grade_info: grade,
                exam_info: exam
            })
        });
        
        const result = await res.json();
        
        document.getElementById('diagnosisLoading').style.display = 'none';
        
        if (result.success) {
            diagnosisData = result.data;
            renderDiagnosisResults(result.data, result.raw);
        } else {
            throw new Error(result.error || '诊断失败');
        }
    } catch (err) {
        document.getElementById('diagnosisLoading').style.display = 'none';
        document.getElementById('diagnosisEmpty').style.display = 'block';
        showToast(`诊断失败: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>启动AI错因诊断</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    }
}

function renderDiagnosisResults(data, rawText) {
    const container = document.getElementById('diagnosisContent');
    container.style.display = 'block';
    
    if (!data) {
        // 无法解析JSON时展示原始文本
        container.innerHTML = `
            <div class="overall-card">
                <h4>🧠 AI 诊断结果</h4>
                <div style="white-space: pre-wrap; line-height: 1.9; font-size: 14px; color: var(--text-secondary);">
                    ${escapeHtml(rawText)}
                </div>
            </div>
        `;
        return;
    }
    
    // 整体学情
    const overallEl = document.getElementById('overallAnalysis');
    overallEl.innerHTML = `
        <h4>📋 全班学情总结</h4>
        <p>${data.overall_analysis || '暂无整体分析'}</p>
    `;
    
    // 各知识点错因
    const listEl = document.getElementById('diagnosisList');
    if (data.diagnosis && data.diagnosis.length > 0) {
        listEl.innerHTML = data.diagnosis.map((item, idx) => `
            <div class="diagnosis-item" style="animation-delay: ${idx * 0.1}s">
                <div class="diagnosis-item-header">
                    <h5>
                        <span style="color: ${item.severity === '高' ? '#ef4444' : item.severity === '中' ? '#f59e0b' : '#10b981'}">●</span>
                        ${item.knowledge_point}
                    </h5>
                    <span class="severity-badge severity-${item.severity === '高' ? 'high' : item.severity === '中' ? 'medium' : 'low'}">
                        ${item.severity || '中'}
                    </span>
                </div>
                <div class="diagnosis-causes">
                    <h6>🔍 可能错因</h6>
                    <div class="cause-tags">
                        ${(item.error_causes || []).map(c => `<span class="cause-tag">${c}</span>`).join('')}
                    </div>
                </div>
                ${item.cause_details ? `
                    <div class="cause-detail">${item.cause_details}</div>
                ` : ''}
            </div>
        `).join('');
    } else {
        listEl.innerHTML = '';
    }
    
    // 讲评策略
    const strategyEl = document.getElementById('strategyCard');
    if (data.teaching_strategy) {
        const ts = data.teaching_strategy;
        strategyEl.innerHTML = `
            <h4>📝 讲评策略建议</h4>
            <div class="strategy-grid">
                <div class="strategy-item">
                    <h6>🎯 讲评重点</h6>
                    <p>${ts.review_focus || '—'}</p>
                </div>
                <div class="strategy-item">
                    <h6>💡 教学方法</h6>
                    <ul>
                        ${(ts.methods || []).map(m => `<li>${m}</li>`).join('')}
                    </ul>
                </div>
                <div class="strategy-item">
                    <h6>⏰ 时间分配</h6>
                    <p>${ts.time_allocation || '—'}</p>
                </div>
                <div class="strategy-item">
                    <h6>📚 课后作业建议</h6>
                    <p>${ts.homework_suggestion || '—'}</p>
                </div>
            </div>
        `;
    } else {
        strategyEl.innerHTML = '';
    }
}

// ── 变式题生成 ──────────────────────────────────
async function generateVariants() {
    if (!selectedKP) {
        showToast('请先选择一个目标知识点', 'error');
        return;
    }
    
    const count = parseInt(document.getElementById('questionCount').value);
    const difficulty = document.getElementById('difficultyMode').value;
    const grade = document.getElementById('gradeSelect').value;
    
    // 获取该知识点的错因
    let errorCauses = [];
    if (diagnosisData && diagnosisData.diagnosis) {
        const match = diagnosisData.diagnosis.find(d => d.knowledge_point === selectedKP);
        if (match) {
            errorCauses = match.error_causes || [];
        }
    }
    
    // 隐藏占位，准备容器
    document.getElementById('generateEmpty').style.display = 'none';
    const container = document.getElementById('generateContent');
    container.style.display = 'block';
    
    // 使用统一的 markdown 样式容器，方便直接复制进入 Word
    container.innerHTML = `
        <div class="question-card" style="padding: 30px;">
            <div id="streamTarget" style="white-space: pre-wrap; line-height: 1.8; color: #e2e8f0; font-size: 15px; font-family: 'Noto Sans SC', sans-serif;">
                <span style="display:inline-block; animation: pulse 1.5s infinite; color:#6366f1;">✍️ AI 正在光速生成靶向变式题，请稍候...</span>
            </div>
        </div>
    `;
    
    // 生成时重置导出按钮状态
    const exportBtn = document.getElementById('btnExportWord');
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.style.cursor = 'not-allowed';
        exportBtn.style.color = '#94a3b8';
        exportBtn.style.borderColor = '#cbd5e1';
    }
    
    // 滚动到生成区域
    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    const btn = document.getElementById('btnGenerate');
    btn.disabled = true;
    btn.textContent = '⏳ 生成中 (流式输出)...';
    
    try {
        const res = await fetch(`${API_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                knowledge_point: selectedKP,
                error_causes: errorCauses,
                difficulty: difficulty,
                count: count,
                grade: grade
            })
        });
        
        if (!res.ok) {
            throw new Error(await res.text() || '网络请求失败');
        }
        
        const target = document.getElementById('streamTarget');
        target.innerHTML = ''; // 清空提示
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullText = "";
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, {stream: true});
            fullText += chunk;
            
            // 实时使用 marked 解析 Markdown 并渲染
            target.innerHTML = marked.parse(fullText);
            
            // 根据需要可以加自动滚动逻辑，但这里高度可能没那么快超出屏幕，故省略
        }
        
        // 渲染完毕后，拦截内部可能存在的 python matplotlib 代码兵执行
        const preElements = target.querySelectorAll('pre code.language-python');
        for (const codeEl of preElements) {
            if (codeEl.textContent.includes('matplotlib') || codeEl.textContent.includes('plt.')) {
                const preEl = codeEl.parentElement;
                const loadingDiv = document.createElement('div');
                loadingDiv.innerHTML = '<div style="padding: 15px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center; color: #6366f1; margin: 15px 0;">⏳ AI 正在执行沙箱 Python 绘图代码，绘制精确几何图...</div>';
                preEl.parentNode.replaceChild(loadingDiv, preEl);
                
                try {
                    const plotRes = await fetch(`${API_BASE}/api/render_plot`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: codeEl.textContent })
                    });
                    
                    const plotData = await plotRes.json();
                    if (plotData.success) {
                        loadingDiv.innerHTML = `<img src="data:image/png;base64,${plotData.image}" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 15px auto; display: block;">`;
                    } else {
                        loadingDiv.innerHTML = `<div style="color:red; font-size: 13px; padding:10px; background:#fef2f2; border:1px solid #fecaca; border-radius:6px;">⚠️ AI 生成的 Python 绘图代码有误: ${plotData.error}</div>`;
                    }
                } catch (e) {
                     loadingDiv.innerHTML = `<div style="color:red;">绘图引擎连接失败</div>`;
                }
            }
        }
        
    } catch (err) {
        document.getElementById('streamTarget').innerHTML = `<div style="color:#ef4444;">生成失败: ${err.message}</div>`;
        showToast(`生成失败: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✨ 重新生成变式题';
        
        // 激活导出按钮
        const exportBtn = document.getElementById('btnExportWord');
        if (exportBtn && document.getElementById('streamTarget').innerHTML.length > 50) {
            exportBtn.disabled = false;
            exportBtn.style.cursor = 'pointer';
            exportBtn.style.color = '#6366f1';
            exportBtn.style.borderColor = '#6366f1';
        }
    }
}

// ── 导出为 Word ──────────────────────────────────
window.exportToWord = async function() {
    const target = document.getElementById('streamTarget');
    if (!target) return;
    
    // 显示处理状态
    const btn = document.getElementById('btnExportWord');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>⏳ 正在光栅化图形...</span>';
    btn.disabled = true;
    
    try {
        // 克隆一个节点以便处理图片，同时不影响页面浏览
        const clone = target.cloneNode(true);
        
        // 将所有的 SVG 标签转换为标准的 PNG Base64 图片，因为 Word 不识别内嵌的 SVG Base64
        const svgs = clone.querySelectorAll('svg');
        for (let i = 0; i < svgs.length; i++) {
            const svg = svgs[i];
            if (!svg.getAttribute('xmlns')) {
                svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }
            const width = parseInt(svg.getAttribute('width') || svg.getBoundingClientRect().width || 250);
            const height = parseInt(svg.getAttribute('height') || svg.getBoundingClientRect().height || 250);
            
            const svgData = new XMLSerializer().serializeToString(svg);
            const encodedData = window.btoa(unescape(encodeURIComponent(svgData)));
            const svgDataUrl = 'data:image/svg+xml;base64,' + encodedData;
            
            // 使用 Canvas 将 SVG 转换为 PNG
            const pngBase64 = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = "#ffffff"; // 填充白色背景
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = () => { resolve(svgDataUrl); } // 如果失败退化为 SVG
                img.src = svgDataUrl;
            });
            
            const newImg = document.createElement('img');
            newImg.src = pngBase64;
            newImg.width = width;
            newImg.height = height;
            newImg.style.display = 'block';
            newImg.style.margin = '10px auto';
            svg.parentNode.replaceChild(newImg, svg);
        }
        
        // 把处理后的 HTML 提取出来
        const contentHtml = clone.innerHTML;
        
        // 构建 Word 兼容的完整 HTML (明确加上白色背景和黑色字样式，避免暗色主题影响)
        const header = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset='utf-8'>
    <title>靶向变式训练题</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', SimSun, sans-serif;
            color: #000000;
            background: #ffffff;
            line-height: 1.8;
            font-size: 11pt;
        }
        h1 { font-size: 16pt; text-align: center; }
        h2 { font-size: 14pt; margin-top: 20px; }
        p { margin-bottom: 10px; }
        img { max-width: 100%; height: auto; }
    </style>
</head>
<body>
`;
        const footer = "</body></html>";
        const sourceHTML = header + contentHtml + footer;
        
        // 检查是否存在 htmlDocx，如果存在则输出原生 docx
        const kpName = selectedKP || '变式题';
        if (typeof htmlDocx !== 'undefined') {
            const converted = htmlDocx.asBlob(sourceHTML, { orientation: 'portrait' });
            const url = URL.createObjectURL(converted);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${kpName}_变式训练题.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${kpName}_变式训练题.doc`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    } catch (err) {
        showToast('导出失败: ' + err.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// ── 工具函数 ────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMathText(text) {
    // 简单的格式化：将换行转为<br>，将**bold**转为加粗
    let html = escapeHtml(text);
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return html;
}

function downloadSampleExcel() {
    window.open(`${API_BASE}/api/generate_sample`, '_blank');
}

// ── Toast 通知 ──────────────────────────────────
function showToast(message, type = 'info') {
    // 移除已有toast
    document.querySelectorAll('.toast').forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span>${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}</span>
        <span>${message}</span>
    `;
    
    // 样式
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%) translateY(20px)',
        padding: '12px 24px',
        borderRadius: '12px',
        background: type === 'error' ? 'rgba(239,68,68,0.9)' : type === 'success' ? 'rgba(16,185,129,0.9)' : 'rgba(59,130,246,0.9)',
        color: 'white',
        fontSize: '14px',
        fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: '9999',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        opacity: '0',
        transition: 'all 0.3s ease'
    });
    
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ── 模型设置逻辑 ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    const openBtn = document.getElementById('openSettingsBtn');
    const closeBtn = document.getElementById('closeSettingsBtn');
    const cancelBtn = document.getElementById('cancelSettingsBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const providerSelect = document.getElementById('llmProviderSelect');
    
    // Fetch initial settings
    async function fetchSettings() {
        try {
            const res = await fetch(`${API_BASE}/api/settings`);
            if (res.ok) {
                const data = await res.json();
                if (data.model) document.getElementById('llmModelInput').value = data.model;
                if (data.base_url) document.getElementById('llmUrlInput').value = data.base_url;
                
                // Set preset
                if (data.base_url.includes('dashscope')) providerSelect.value = 'qwen';
                else if (data.base_url.includes('deepseek')) providerSelect.value = 'deepseek';
                else if (data.base_url.includes('bigmodel')) providerSelect.value = 'zhipu';
                else providerSelect.value = 'custom';
            }
        } catch (e) {
            console.error('Failed to fetch settings', e);
        }
    }

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            fetchSettings();
            modal.style.display = 'flex';
        });
    }

    const closeModal = () => modal.style.display = 'none';
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (providerSelect) {
        providerSelect.addEventListener('change', (e) => {
            const p = e.target.value;
            const modelInput = document.getElementById('llmModelInput');
            const urlInput = document.getElementById('llmUrlInput');
            if (p === 'qwen') {
                modelInput.value = 'qwen-max';
                urlInput.value = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
            } else if (p === 'deepseek') {
                modelInput.value = 'deepseek-chat';
                urlInput.value = 'https://api.deepseek.com/v1';
            } else if (p === 'zhipu') {
                modelInput.value = 'glm-4-flash';
                urlInput.value = 'https://open.bigmodel.cn/api/paas/v4';
            } else {
                modelInput.value = '';
                urlInput.value = '';
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const apiKey = document.getElementById('llmKeyInput').value;
            const baseUrl = document.getElementById('llmUrlInput').value;
            const model = document.getElementById('llmModelInput').value;
            
            saveBtn.innerText = '保存中...';
            saveBtn.disabled = true;
            
            try {
                const res = await fetch(`${API_BASE}/api/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: apiKey, base_url: baseUrl, model: model })
                });
                const data = await res.json();
                if (data.success) {
                    showToast(data.msg, 'success');
                    closeModal();
                    document.getElementById('llmKeyInput').value = ''; // clear key
                    checkLLMStatus(); // Refresh header status
                } else {
                    showToast(data.error || '保存失败', 'error');
                }
            } catch (e) {
                console.error(e);
                showToast('执行时发生错误: ' + e.message, 'error');
            } finally {
                saveBtn.innerText = '保存并立即生效';
                saveBtn.disabled = false;
            }
        });
    }
});
