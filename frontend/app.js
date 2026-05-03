/**
 * 面向精准教学的错题归因与靶向变式智能生成系统 - 前端交互逻辑
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
let lastGeneratedText = '';
const DOC_QUESTION_TITLE_PATTERN = /^【题目\s*\d+】$/;
const DOC_SECTION_LABEL_PATTERN = /^【(参考答案|详细解析|易错点提醒)】$/;
const DOC_KEYPOINT_PATTERN = /^[（(]考查要点[:：]/;
const DOC_GEOMETRY_NOTE_PATTERN = /^(\*\*|__)?注[:：].*(技术限制|规范绘制|文字描述自行绘制|根据以上描述自行规范绘制)/;

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

    const iconContainer = document.getElementById('heroIcon');
    if (iconContainer) {
        iconContainer.innerHTML = `
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Target Rings -->
                <circle cx="50" cy="50" r="38" stroke="url(#iconGrad)" stroke-width="2.5" opacity="0.2">
                    <animate attributeName="r" values="38;40;38" dur="4s" repeatCount="indefinite" />
                </circle>
                <circle cx="50" cy="50" r="25" stroke="url(#iconGrad)" stroke-width="3" opacity="0.5" />
                <circle cx="50" cy="50" r="10" fill="url(#iconGrad)" />
                
                <!-- Crosshair lines -->
                <line x1="50" y1="5" x2="50" y2="20" stroke="url(#iconGrad)" stroke-width="3" stroke-linecap="round" />
                <line x1="50" y1="80" x2="50" y2="95" stroke="url(#iconGrad)" stroke-width="3" stroke-linecap="round" />
                <line x1="5" y1="50" x2="20" y2="50" stroke="url(#iconGrad)" stroke-width="3" stroke-linecap="round" />
                <line x1="80" y1="50" x2="95" y2="50" stroke="url(#iconGrad)" stroke-width="3" stroke-linecap="round" />
                
                <!-- Sparkles/Magic dots -->
                <circle cx="80" cy="20" r="3" fill="#06b6d4">
                    <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="r" values="1;3;1" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="20" cy="80" r="2" fill="#6366f1">
                    <animate attributeName="opacity" values="0;1;0" dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="r" values="1;2.5;1" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="75" cy="75" r="2" fill="#818cf8">
                    <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite" />
                </circle>

                <defs>
                    <linearGradient id="iconGrad" x1="0" y1="0" x2="100" y2="100">
                        <stop stop-color="#6366f1" />
                        <stop offset="1" stop-color="#06b6d4" />
                    </linearGradient>
                </defs>
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
    lastGeneratedText = '';
    
    // 使用统一的 markdown 样式容器，方便直接复制进入 Word
    container.innerHTML = `
        <div class="question-card generation-shell">
            <div class="preview-toolbar">
                <span class="preview-badge">Word 导出预览</span>
                <span class="preview-caption">已按文档版式进行规范化展示</span>
            </div>
            <div id="streamTarget" class="export-preview">
                <p class="stream-loading">✍️ AI 正在生成靶向变式题，请稍候...</p>
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
            renderGeneratedContent(target, fullText);
            
            // 根据需要可以加自动滚动逻辑，但这里高度可能没那么快超出屏幕，故省略
        }
        
        // 确保最后缓冲区的内容被刷新并渲染
        const finalChunk = decoder.decode();
        if (finalChunk) {
            fullText += finalChunk;
            renderGeneratedContent(target, fullText);
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
    btn.innerHTML = '<span>⏳ 正在整理 Word 版式...</span>';
    btn.disabled = true;
    
    try {
        const structure = parseGeneratedStructure(lastGeneratedText || target.textContent || '');
        const kpName = sanitizeFileName(selectedKP || stripTrainingSuffix(structure.title) || '变式题');

        if (window.docx && typeof window.docx.Packer?.toBlob === 'function') {
            const blob = await buildDocxBlob(structure);
            downloadBlob(blob, `${kpName}_变式训练题.docx`);
        } else if (typeof htmlDocx !== 'undefined') {
            const contentHtml = buildStructuredDocumentHtml(structure, 'word');
            const header = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset='utf-8'>
    <title>靶向变式训练题</title>
    <style>
        body {
            margin: 0;
            font-family: 'Microsoft YaHei', SimSun, sans-serif;
            color: #111827;
            background: #ffffff;
            line-height: 1.85;
            font-size: 11pt;
        }
        @page {
            size: A4;
            margin: 2.2cm 1.9cm;
        }
    </style>
</head>
<body>
`;
            const footer = "</body></html>";
            const converted = htmlDocx.asBlob(header + contentHtml + footer, { orientation: 'portrait' });
            downloadBlob(converted, `${kpName}_变式训练题.docx`);
            showToast('结构化 Word 引擎未加载，已使用兼容导出模式。', 'info');
        } else {
            throw new Error('Word 导出组件未加载，请刷新页面后重试');
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

function renderGeneratedContent(target, markdownText) {
    lastGeneratedText = markdownText;
    const structure = parseGeneratedStructure(markdownText);
    target.innerHTML = buildStructuredDocumentHtml(structure, 'preview');
}

function parseGeneratedStructure(rawText) {
    const normalized = String(rawText || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
    const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean);
    const structure = {
        title: selectedKP ? `${selectedKP} 靶向变式训练` : '',
        meta: '',
        sections: []
    };

    let currentSection = null;
    let currentQuestion = null;
    let currentMode = 'prompt';

    const flushQuestion = () => {
        if (currentQuestion) {
            if (!currentSection) {
                currentSection = { title: '题目内容', questions: [] };
                structure.sections.push(currentSection);
            }
            currentSection.questions.push(currentQuestion);
        }
        currentQuestion = null;
        currentMode = 'prompt';
    };

    const ensureSection = (title) => {
        if (!currentSection || currentSection.title !== title) {
            flushQuestion();
            currentSection = { title, questions: [] };
            structure.sections.push(currentSection);
        }
    };

    lines.forEach((line) => {
        if (/^---+$/.test(line)) {
            flushQuestion();
            return;
        }

        if (/^#\s+/.test(line)) {
            structure.title = line.replace(/^#\s+/, '').trim();
            return;
        }

        if (/^##\s+/.test(line)) {
            ensureSection(line.replace(/^##\s+/, '').trim());
            return;
        }

        const cleanedLine = stripMarkdownStrong(line);

        if (/^针对错因[:：]/.test(cleanedLine)) {
            structure.meta = cleanedLine;
            return;
        }

        if (DOC_QUESTION_TITLE_PATTERN.test(cleanedLine)) {
            flushQuestion();
            if (!currentSection) {
                ensureSection('题目内容');
            }
            currentQuestion = {
                title: cleanedLine,
                keyPoint: '',
                prompt: [],
                geometryNote: '',
                answer: [],
                analysis: [],
                tips: []
            };
            currentMode = 'prompt';
            return;
        }

        if (!currentQuestion) {
            return;
        }

        if (DOC_KEYPOINT_PATTERN.test(cleanedLine)) {
            currentQuestion.keyPoint = cleanedLine;
            return;
        }

        if (DOC_SECTION_LABEL_PATTERN.test(cleanedLine)) {
            if (cleanedLine.includes('参考答案')) currentMode = 'answer';
            if (cleanedLine.includes('详细解析')) currentMode = 'analysis';
            if (cleanedLine.includes('易错点提醒')) currentMode = 'tips';
            return;
        }

        if (DOC_GEOMETRY_NOTE_PATTERN.test(cleanedLine)) {
            currentQuestion.geometryNote = cleanedLine;
            return;
        }

        if (cleanedLine.includes('易错点提醒')) {
            currentMode = 'tips';
            return;
        }

        currentQuestion[currentMode].push(cleanedLine);
    });

    flushQuestion();

    if (!structure.title) {
        structure.title = selectedKP ? `${selectedKP} 靶向变式训练` : '靶向变式训练';
    }

    return structure;
}

function buildStructuredDocumentHtml(input, mode = 'preview') {
    const structure = typeof input === 'string' ? parseGeneratedStructure(input) : input;
    const html = [];

    html.push(`<div ${buildAttr('doc-wrapper', mode)}>`);
    html.push(`<h1 ${buildAttr('doc-title', mode)}>${formatInlineText(structure.title)}</h1>`);

    if (structure.meta) {
        html.push(`<div ${buildAttr('doc-meta', mode)}>${formatInlineText(structure.meta)}</div>`);
    }

    structure.sections.forEach((section, sectionIndex) => {
        html.push(`<h2 ${buildAttr('doc-section-title', mode)}>${formatInlineText(section.title)}</h2>`);

        section.questions.forEach((question) => {
            html.push(`<div ${buildAttr('doc-question-block', mode)}>`);
            html.push(`<div ${buildAttr('doc-question-title', mode)}>${formatInlineText(question.title)}</div>`);

            if (question.keyPoint) {
                html.push(`<div ${buildAttr('doc-key-point', mode)}>${formatInlineText(question.keyPoint)}</div>`);
            }

            question.prompt.forEach((line) => {
                html.push(`<p ${buildAttr('doc-paragraph', mode)}>${formatInlineText(line)}</p>`);
            });

            if (question.geometryNote) {
                html.push(`<div ${buildAttr('doc-geometry-note', mode)}>${formatInlineText(question.geometryNote)}</div>`);
            }

            if (question.answer.length) {
                html.push(`<div ${buildAttr('doc-section-label', mode)}>【参考答案】</div>`);
                question.answer.forEach((line) => {
                    html.push(`<p ${buildAttr('doc-paragraph', mode)}>${formatInlineText(line)}</p>`);
                });
            }

            if (question.analysis.length) {
                html.push(`<div ${buildAttr('doc-section-label', mode)}>【详细解析】</div>`);
                question.analysis.forEach((line) => {
                    html.push(`<p ${buildAttr('doc-paragraph', mode)}>${formatInlineText(line)}</p>`);
                });
            }

            if (question.tips.length) {
                html.push(`<div ${buildAttr('doc-section-label', mode)}>【易错点提醒】</div>`);
                question.tips.forEach((line) => {
                    html.push(`<p ${buildAttr('doc-tips-paragraph', mode)}>${formatInlineText(line)}</p>`);
                });
            }

            html.push(`</div>`);
        });

        if (sectionIndex < structure.sections.length - 1) {
            html.push(`<div ${buildAttr('doc-divider', mode)}></div>`);
        }
    });

    html.push(`</div>`);
    return html.join('');
}

function buildAttr(type, mode) {
    const styles = {
        'doc-wrapper': {
            preview: '',
            word: 'width:100%;'
        },
        'doc-title': {
            preview: 'margin:0 0 18px;padding-bottom:14px;border-bottom:1px solid rgba(148,163,184,0.24);font-size:28px;font-weight:800;line-height:1.35;letter-spacing:0.4px;color:#f8fafc;text-align:center;',
            word: 'margin:0 0 18pt;padding:0 0 10pt;border-bottom:1.5pt solid #dbe3f0;font-size:18pt;font-weight:700;line-height:1.4;letter-spacing:0.5pt;color:#0f172a;text-align:center;'
        },
        'doc-section-title': {
            preview: 'margin:26px 0 14px;padding-left:14px;border-left:4px solid rgba(96,165,250,0.9);font-size:22px;font-weight:700;color:#f8fafc;',
            word: 'margin:18pt 0 10pt;padding:0 0 0 10pt;border-left:4pt solid #3b82f6;font-size:14pt;font-weight:700;color:#0f172a;page-break-after:avoid;'
        },
        'doc-meta': {
            preview: 'margin:0 0 16px;font-size:14px;line-height:1.9;color:#cbd5e1;',
            word: 'margin:0 0 12pt;font-size:11pt;line-height:1.8;color:#475569;'
        },
        'doc-question-block': {
            preview: 'margin:0 0 22px;padding:18px 20px;border:1px solid rgba(148,163,184,0.14);border-radius:14px;background:rgba(15,23,42,0.34);box-shadow:0 8px 30px rgba(15,23,42,0.18);',
            word: 'margin:0 0 16pt;padding:12pt 14pt;border:1pt solid #dbe3f0;background:#ffffff;page-break-inside:avoid;'
        },
        'doc-question-title': {
            preview: 'margin:0 0 12px;padding:10px 14px;border-radius:10px;border-left:4px solid #60a5fa;background:linear-gradient(135deg, rgba(37,99,235,0.16), rgba(14,165,233,0.08));font-size:16px;font-weight:700;color:#ffffff;',
            word: 'margin:0 0 10pt;padding:7pt 10pt;border-left:3pt solid #2563eb;background:#eff6ff;font-size:12pt;font-weight:700;color:#0f172a;'
        },
        'doc-key-point': {
            preview: 'margin:0 0 12px;padding:10px 12px;border:1px solid rgba(148,163,184,0.16);border-radius:10px;background:rgba(15,23,42,0.42);font-size:14px;line-height:1.85;color:#cbd5e1;',
            word: 'margin:0 0 10pt;padding:7pt 9pt;border:1pt solid #e2e8f0;background:#f8fafc;font-size:10.8pt;line-height:1.8;color:#475569;'
        },
        'doc-section-label': {
            preview: 'margin:12px 0 8px;font-size:15px;font-weight:700;color:#f8fafc;',
            word: 'margin:10pt 0 6pt;font-size:11pt;font-weight:700;color:#0f172a;'
        },
        'doc-geometry-note': {
            preview: 'margin:0 0 12px;padding:11px 13px;border-radius:10px;border:1px solid rgba(251,191,36,0.4);background:rgba(251,191,36,0.12);font-size:14px;line-height:1.85;color:#fbbf24;font-weight:700;',
            word: 'margin:0 0 10pt;padding:8pt 10pt;border:1.5pt solid #fcd34d;background:#fffbeb;font-size:10.8pt;line-height:1.8;color:#b45309;font-weight:700;'
        },
        'doc-paragraph': {
            preview: 'margin:0 0 12px;font-size:15px;line-height:1.95;color:#e2e8f0;',
            word: 'margin:0 0 10pt;font-size:11pt;line-height:1.85;color:#111827;text-align:justify;'
        },
        'doc-tips-paragraph': {
            preview: 'margin:0 0 12px;font-size:15px;line-height:1.95;color:#fdba74;',
            word: 'margin:0 0 10pt;font-size:11pt;line-height:1.85;color:#9a3412;text-align:justify;'
        },
        'doc-divider': {
            preview: 'height:1px;margin:18px 0 22px;background:rgba(148,163,184,0.16);',
            word: 'height:1pt;margin:12pt 0 14pt;background:#e5e7eb;'
        }
    };

    const className = type;
    const style = styles[type] ? styles[type][mode] : '';
    return style ? `class="${className}" style="${style}"` : `class="${className}"`;
}

function stripMarkdownStrong(text) {
    return text.replace(/^\*\*(.*?)\*\*$/, '$1').trim();
}

function formatInlineText(text) {
    return escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<span style="font-family:Consolas, monospace;">$1</span>');
}

async function buildDocxBlob(structure) {
    const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        Table,
        TableRow,
        TableCell,
        WidthType,
        BorderStyle,
        ShadingType,
        VerticalAlign,
        AlignmentType,
        Header,
        Footer,
        PageNumber
    } = window.docx;

    const A4_WIDTH = 11906;
    const A4_HEIGHT = 16838;
    const PAGE_MARGIN = 1440;
    const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;

    const border = { style: BorderStyle.SINGLE, size: 1, color: 'D7DEE8' };
    const borders = { top: border, bottom: border, left: border, right: border };

    const makeRun = (text, options = {}) => new TextRun({
        text,
        bold: options.bold || false,
        color: options.color,
        size: options.size,
        font: options.font
    });

    const bodyParagraph = (text, extra = {}) => new Paragraph({
        spacing: { after: 120, line: 360 },
        alignment: extra.alignment || AlignmentType.JUSTIFIED,
        indent: extra.indent,
        children: [
            makeRun(text, {
                font: extra.font || 'SimSun',
                size: extra.size || 24,
                bold: extra.bold || false,
                color: extra.color || '1F2937'
            })
        ]
    });

    const labelParagraph = (text) => new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [makeRun(text, { font: 'Microsoft YaHei', size: 24, bold: true, color: '1D4ED8' })]
    });

    const createQuestionTable = (question) => {
        const children = [];

        children.push(
            new Paragraph({
                spacing: { after: 120 },
                shading: { fill: 'EAF3FF', type: ShadingType.CLEAR },
                border: { left: { style: BorderStyle.SINGLE, size: 8, color: '2563EB' } },
                indent: { left: 120, right: 120 },
                children: [makeRun(question.title, { font: 'Microsoft YaHei', size: 26, bold: true, color: '0F172A' })]
            })
        );

        if (question.keyPoint) {
            children.push(
                new Paragraph({
                    spacing: { after: 140 },
                    shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
                    border: borders,
                    indent: { left: 120, right: 120 },
                    children: [makeRun(question.keyPoint, { font: 'Microsoft YaHei', size: 22, color: '475569' })]
                })
            );
        }

        question.prompt.forEach((line) => children.push(bodyParagraph(line)));

        if (question.geometryNote) {
            children.push(
                new Paragraph({
                    spacing: { after: 140 },
                    shading: { fill: 'FFFBEB', type: ShadingType.CLEAR },
                    border: {
                        top: { style: BorderStyle.SINGLE, size: 4, color: 'FCD34D' },
                        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'FCD34D' },
                        left: { style: BorderStyle.SINGLE, size: 4, color: 'FCD34D' },
                        right: { style: BorderStyle.SINGLE, size: 4, color: 'FCD34D' },
                    },
                    indent: { left: 120, right: 120 },
                    children: [makeRun(question.geometryNote, { font: 'Microsoft YaHei', size: 22, color: 'B45309', bold: true })]
                })
            );
        }

        if (question.answer.length) {
            children.push(labelParagraph('【参考答案】'));
            question.answer.forEach((line) => children.push(bodyParagraph(line)));
        }

        if (question.analysis.length) {
            children.push(labelParagraph('【详细解析】'));
            question.analysis.forEach((line) => children.push(bodyParagraph(line)));
        }

        if (question.tips.length) {
            children.push(labelParagraph('【易错点提醒】'));
            question.tips.forEach((line) => {
                children.push(
                    new Paragraph({
                        spacing: { after: 120, line: 360 },
                        shading: { fill: 'FFF7ED', type: ShadingType.CLEAR },
                        indent: { left: 120, right: 120 },
                        children: [makeRun(line, { font: 'SimSun', size: 24, color: '9A3412' })]
                    })
                );
            });
        }

        return new Table({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            columnWidths: [CONTENT_WIDTH],
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            borders,
                            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                            margins: { top: 140, bottom: 140, left: 180, right: 180 },
                            verticalAlign: VerticalAlign.CENTER,
                            children
                        })
                    ]
                })
            ]
        });
    };

    const children = [];

    children.push(
        new Paragraph({
            spacing: { after: 180 },
            alignment: AlignmentType.CENTER,
            children: [makeRun(structure.title || '靶向变式训练', { font: 'Microsoft YaHei', size: 34, bold: true, color: '0F172A' })]
        })
    );

    if (structure.meta) {
        children.push(
            new Paragraph({
                spacing: { after: 260 },
                shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
                border: borders,
                indent: { left: 180, right: 180 },
                children: [makeRun(structure.meta, { font: 'Microsoft YaHei', size: 23, color: '475569' })]
            })
        );
    }

    structure.sections.forEach((section) => {
        children.push(
            new Paragraph({
                spacing: { before: 220, after: 160 },
                border: { left: { style: BorderStyle.SINGLE, size: 10, color: '3B82F6' } },
                indent: { left: 140 },
                children: [makeRun(section.title, { font: 'Microsoft YaHei', size: 28, bold: true, color: '0F172A' })]
            })
        );

        section.questions.forEach((question) => {
            children.push(createQuestionTable(question));
            children.push(new Paragraph({ spacing: { after: 160 } }));
        });
    });

    const doc = new Document({
        creator: 'Codex',
        title: structure.title || '靶向变式训练',
        description: '结构化生成的规范版 Word 文档',
        styles: {
            default: {
                document: {
                    run: {
                        font: 'SimSun',
                        size: 24
                    }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    size: { width: A4_WIDTH, height: A4_HEIGHT },
                    margin: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN }
                }
            },
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.LEFT,
                            spacing: { after: 80 },
                            children: [makeRun('靶向变式训练', { font: 'Microsoft YaHei', size: 18, color: '64748B' })]
                        })
                    ]
                })
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                                new TextRun({
                                    font: 'Microsoft YaHei',
                                    size: 18,
                                    color: '64748B',
                                    children: ['第 ', PageNumber.CURRENT, ' 页']
                                })
                            ]
                        })
                    ]
                })
            },
            children
        }]
    });

    return Packer.toBlob(doc);
}

function stripTrainingSuffix(title) {
    return String(title || '').replace(/\s*靶向变式训练\s*$/, '').trim();
}

function sanitizeFileName(name) {
    return String(name || '变式题').replace(/[\\/:*?"<>|]/g, '_').trim() || '变式题';
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
