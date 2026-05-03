const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
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
    Footer,
    Header,
    PageNumber,
} = require("docx");

const A4_WIDTH = 11906;
const A4_HEIGHT = 16838;
const PAGE_MARGIN = 1440;
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;

function decodeQuotedPrintable(input) {
    const normalized = input.replace(/=\r?\n/g, "");
    const bytes = [];

    for (let i = 0; i < normalized.length; i += 1) {
        const char = normalized[i];
        if (char === "=" && /^[0-9A-Fa-f]{2}$/.test(normalized.slice(i + 1, i + 3))) {
            bytes.push(parseInt(normalized.slice(i + 1, i + 3), 16));
            i += 2;
        } else {
            bytes.push(normalized.charCodeAt(i));
        }
    }

    return Buffer.from(bytes).toString("utf8");
}

function decodeHtmlEntities(text) {
    return text
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripMarkdown(text) {
    return text.replace(/^\*\*(.*?)\*\*$/, "$1").trim();
}

function extractBodyHtml(html) {
    const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return match ? match[1] : html;
}

function htmlToLines(bodyHtml) {
    const text = decodeHtmlEntities(
        bodyHtml
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/(p|div|h1|h2|h3|li|hr|table|tr|td)>/gi, "\n")
            .replace(/<[^>]+>/g, "")
    );

    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => line !== "靶向变式训练题");
}

function extractHtmlFromAltChunk(docxBuffer) {
    return JSZip.loadAsync(docxBuffer).then(async (zip) => {
        const entry = zip.file("word/afchunk.mht");
        if (!entry) {
            throw new Error("未找到 word/afchunk.mht，无法从 altChunk 导出内容");
        }

        const raw = await entry.async("nodebuffer");
        const rawText = raw.toString("latin1");
        const boundaryMatch = rawText.match(/boundary="([^"]+)"/i);
        if (!boundaryMatch) {
            throw new Error("无法识别 MHT 边界");
        }

        const boundary = `--${boundaryMatch[1]}`;
        const parts = rawText.split(boundary);
        const htmlPart = parts.find((part) => /Content-Type:\s*text\/html/i.test(part));
        if (!htmlPart) {
            throw new Error("MHT 中未找到 HTML 正文");
        }

        const splitIndex = htmlPart.search(/\r?\n\r?\n/);
        if (splitIndex === -1) {
            throw new Error("HTML 正文格式异常");
        }

        const encodedBody = htmlPart.slice(splitIndex).replace(/^\r?\n\r?\n/, "");
        return decodeQuotedPrintable(encodedBody);
    });
}

function parseDocumentStructure(lines) {
    const doc = { title: "", meta: "", sections: [] };
    let currentSection = null;
    let currentQuestion = null;
    let currentMode = "prompt";

    const flushQuestion = () => {
        if (currentQuestion && currentSection) {
            currentSection.questions.push(currentQuestion);
        }
        currentQuestion = null;
        currentMode = "prompt";
    };

    const ensureSection = (title) => {
        if (!currentSection || currentSection.title !== title) {
            flushQuestion();
            currentSection = { title, questions: [] };
            doc.sections.push(currentSection);
        }
    };

    for (const rawLine of lines) {
        const line = stripMarkdown(rawLine);

        if (!doc.title && /靶向变式训练$/.test(line)) {
            doc.title = line;
            continue;
        }

        if (!doc.meta && /^针对错因[:：]/.test(line)) {
            doc.meta = line;
            continue;
        }

        if (/^[一二三四五六七八九十]+、/.test(line)) {
            ensureSection(line);
            continue;
        }

        if (/^【题目\s*\d+】$/.test(line)) {
            flushQuestion();
            if (!currentSection) {
                ensureSection("未分组题目");
            }
            currentQuestion = {
                title: line,
                keyPoint: "",
                prompt: [],
                geometryNote: "",
                answer: [],
                analysis: [],
                tips: [],
            };
            continue;
        }

        if (!currentQuestion) {
            continue;
        }

        if (/^[（(]考查要点[:：]/.test(line)) {
            currentQuestion.keyPoint = line;
            continue;
        }

        if (/^【参考答案】$/.test(line)) {
            currentMode = "answer";
            continue;
        }

        if (/^【详细解析】$/.test(line)) {
            currentMode = "analysis";
            continue;
        }

        if (line.includes("易错点提醒")) {
            currentMode = "tips";
            continue;
        }

        if (/^注[:：].*(技术限制|规范绘制|根据以上描述自行规范绘制)/.test(line)) {
            currentQuestion.geometryNote = line;
            continue;
        }

        currentQuestion[currentMode].push(line);
    }

    flushQuestion();
    return doc;
}

function run(text, options = {}) {
    return new TextRun({
        text,
        bold: options.bold || false,
        color: options.color,
        size: options.size,
        font: options.font,
    });
}

function bodyParagraph(text, extra = {}) {
    return new Paragraph({
        spacing: { after: 120, line: 360 },
        alignment: extra.alignment || AlignmentType.JUSTIFIED,
        indent: extra.indent,
        children: [
            run(text, {
                font: extra.font || "SimSun",
                size: extra.size || 24,
                bold: extra.bold || false,
                color: extra.color || "1F2937",
            }),
        ],
    });
}

function labelParagraph(text) {
    return new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [run(text, { font: "Microsoft YaHei", size: 24, bold: true, color: "1D4ED8" })],
    });
}

function createQuestionTable(question) {
    const border = { style: BorderStyle.SINGLE, size: 1, color: "D7DEE8" };
    const borders = { top: border, bottom: border, left: border, right: border };
    const children = [];

    children.push(
        new Paragraph({
            spacing: { after: 120 },
            shading: { fill: "EAF3FF", type: ShadingType.CLEAR },
            border: {
                left: { style: BorderStyle.SINGLE, size: 8, color: "2563EB" },
            },
            indent: { left: 120, right: 120 },
            children: [run(question.title, { font: "Microsoft YaHei", size: 26, bold: true, color: "0F172A" })],
        })
    );

    if (question.keyPoint) {
        children.push(
            new Paragraph({
                spacing: { after: 140 },
                shading: { fill: "F8FAFC", type: ShadingType.CLEAR },
                border: {
                    top: border,
                    bottom: border,
                    left: border,
                    right: border,
                },
                indent: { left: 120, right: 120 },
                children: [run(question.keyPoint, { font: "Microsoft YaHei", size: 22, color: "475569" })],
            })
        );
    }

    question.prompt.forEach((line) => children.push(bodyParagraph(line)));

    if (question.geometryNote) {
        children.push(
            new Paragraph({
                spacing: { after: 140 },
                shading: { fill: "F9FAFB", type: ShadingType.CLEAR },
                border: {
                    top: border,
                    bottom: border,
                    left: border,
                    right: border,
                },
                indent: { left: 120, right: 120 },
                children: [run(question.geometryNote, { font: "Microsoft YaHei", size: 22, color: "374151" })],
            })
        );
    }

    if (question.answer.length) {
        children.push(labelParagraph("【参考答案】"));
        question.answer.forEach((line) => children.push(bodyParagraph(line)));
    }

    if (question.analysis.length) {
        children.push(labelParagraph("【详细解析】"));
        question.analysis.forEach((line) => children.push(bodyParagraph(line)));
    }

    if (question.tips.length) {
        children.push(labelParagraph("【易错点提醒】"));
        question.tips.forEach((line) =>
            children.push(
                new Paragraph({
                    spacing: { after: 120, line: 360 },
                    shading: { fill: "FFF7ED", type: ShadingType.CLEAR },
                    indent: { left: 120, right: 120 },
                    children: [run(line, { font: "SimSun", size: 24, color: "9A3412" })],
                })
            )
        );
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
                        children,
                    }),
                ],
            }),
        ],
    });
}

function buildDocument(structure) {
    const content = [];

    content.push(
        new Paragraph({
            spacing: { after: 180 },
            alignment: AlignmentType.CENTER,
            children: [run(structure.title || "靶向变式训练", { font: "Microsoft YaHei", size: 34, bold: true, color: "0F172A" })],
        })
    );

    if (structure.meta) {
        content.push(
            new Paragraph({
                spacing: { after: 260 },
                shading: { fill: "F8FAFC", type: ShadingType.CLEAR },
                border: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "D7DEE8" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "D7DEE8" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "D7DEE8" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "D7DEE8" },
                },
                indent: { left: 180, right: 180 },
                children: [run(structure.meta, { font: "Microsoft YaHei", size: 23, color: "475569" })],
            })
        );
    }

    structure.sections.forEach((section) => {
        content.push(
            new Paragraph({
                spacing: { before: 220, after: 160 },
                border: {
                    left: { style: BorderStyle.SINGLE, size: 10, color: "3B82F6" },
                },
                indent: { left: 140 },
                children: [run(section.title, { font: "Microsoft YaHei", size: 28, bold: true, color: "0F172A" })],
            })
        );

        section.questions.forEach((question) => {
            content.push(createQuestionTable(question));
            content.push(new Paragraph({ spacing: { after: 160 } }));
        });
    });

    return new Document({
        creator: "Codex",
        title: structure.title || "靶向变式训练",
        description: "按 docx skill 规范重建的标准化 Word 文档",
        styles: {
            default: {
                document: {
                    run: {
                        font: "SimSun",
                        size: 24,
                    },
                },
            },
        },
        sections: [
            {
                properties: {
                    page: {
                        size: {
                            width: A4_WIDTH,
                            height: A4_HEIGHT,
                        },
                        margin: {
                            top: PAGE_MARGIN,
                            right: PAGE_MARGIN,
                            bottom: PAGE_MARGIN,
                            left: PAGE_MARGIN,
                        },
                    },
                },
                headers: {
                    default: new Header({
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.LEFT,
                                spacing: { after: 80 },
                                children: [run("靶向变式训练", { font: "Microsoft YaHei", size: 18, color: "64748B" })],
                            }),
                        ],
                    }),
                },
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.RIGHT,
                                children: [
                                    new TextRun({
                                        font: "Microsoft YaHei",
                                        size: 18,
                                        color: "64748B",
                                        children: ["第 ", PageNumber.CURRENT, " 页"],
                                    }),
                                ],
                            }),
                        ],
                    }),
                },
                children: content,
            },
        ],
    });
}

async function main() {
    const inputPath = process.argv[2];
    const outputPath = process.argv[3];

    if (!inputPath || !outputPath) {
        throw new Error("用法: node rebuild_docx_from_altchunk.js <input.docx> <output.docx>");
    }

    const inputBuffer = fs.readFileSync(inputPath);
    const html = await extractHtmlFromAltChunk(inputBuffer);
    const bodyHtml = extractBodyHtml(html);
    const lines = htmlToLines(bodyHtml);
    const structure = parseDocumentStructure(lines);
    const doc = buildDocument(structure);
    const buffer = await Packer.toBuffer(doc);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);

    console.log(`Rebuilt DOCX written to ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
