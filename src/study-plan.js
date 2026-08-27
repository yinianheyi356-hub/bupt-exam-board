import {
  addDays,
  createChapter,
  createModule,
  createTask,
  dateKey,
  daysBetween,
  getTaskContexts,
  startOfDay
} from "./domain.js?v=1.3.0";

export const BUILTIN_PLAN_VERSION = "bupt-mjc-2027-v2";
// 政治目录单独维护版本。四科日程共用 BUILTIN_PLAN_VERSION，政治目录更新时只迁移政治任务。
export const POLITICS_PLAN_VERSION = "bupt-politics-2027-v2";

// 按用户提供的《考研政治核心考案》目录整理。每一项都是看板中的一个正式章节；
// 章节编号保留在名称中，便于在看板、笔记和附件之间直接定位原书内容。
export const POLITICS_OUTLINE = [
  ["马克思主义基本原理", "导论：马克思主义是关于无产阶级和人类解放的科学"],
  ["马克思主义基本原理", "第一章 辩证唯物论"],
  ["马克思主义基本原理", "第二章 唯物辩证法"],
  ["马克思主义基本原理", "第三章 认识论"],
  ["马克思主义基本原理", "第四章 唯物史观"],
  ["马克思主义基本原理", "第五章 资本主义的本质及规律"],
  ["马克思主义基本原理", "第六章 资本主义的发展及其趋势"],
  ["马克思主义基本原理", "第七章 社会主义的发展及其规律"],
  ["马克思主义基本原理", "第八章 共产主义崇高理想及其最终实现"],

  ["毛泽东思想和中国特色社会主义理论体系概论", "导论：马克思主义中国化时代化的历史进程与理论成果"],
  ["毛泽东思想和中国特色社会主义理论体系概论", "第一章 毛泽东思想及其历史地位"],
  ["毛泽东思想和中国特色社会主义理论体系概论", "第二章 新民主主义革命理论"],
  ["毛泽东思想和中国特色社会主义理论体系概论", "第三章 社会主义改造理论"],
  ["毛泽东思想和中国特色社会主义理论体系概论", "第四章 社会主义建设道路初步探索的理论成果"],
  ["毛泽东思想和中国特色社会主义理论体系概论", "第五章 中国特色社会主义理论体系的形成发展"],
  ["毛泽东思想和中国特色社会主义理论体系概论", "第六章 邓小平理论"],
  ["毛泽东思想和中国特色社会主义理论体系概论", "第七章 “三个代表”重要思想"],
  ["毛泽东思想和中国特色社会主义理论体系概论", "第八章 科学发展观"],

  ["习近平新时代中国特色社会主义思想概论", "导论"],
  ["习近平新时代中国特色社会主义思想概论", "第一章 新时代坚持和发展中国特色社会主义"],
  ["习近平新时代中国特色社会主义思想概论", "第二章 以中国式现代化全面推进中华民族伟大复兴"],
  ["习近平新时代中国特色社会主义思想概论", "第三章 坚持党的全面领导"],
  ["习近平新时代中国特色社会主义思想概论", "第四章 坚持以人民为中心"],
  ["习近平新时代中国特色社会主义思想概论", "第五章 全面深化改革开放"],
  ["习近平新时代中国特色社会主义思想概论", "第六章 推动高质量发展"],
  ["习近平新时代中国特色社会主义思想概论", "第七章 社会主义现代化建设的教育、科技、人才战略"],
  ["习近平新时代中国特色社会主义思想概论", "第八章 发展全过程人民民主"],
  ["习近平新时代中国特色社会主义思想概论", "第九章 全面依法治国"],
  ["习近平新时代中国特色社会主义思想概论", "第十章 建设社会主义文化强国"],
  ["习近平新时代中国特色社会主义思想概论", "第十一章 以保障和改善民生为重点加强社会建设"],
  ["习近平新时代中国特色社会主义思想概论", "第十二章 建设社会主义生态文明"],
  ["习近平新时代中国特色社会主义思想概论", "第十三章 维护和塑造国家安全"],
  ["习近平新时代中国特色社会主义思想概论", "第十四章 建设巩固国防和强大人民军队"],
  ["习近平新时代中国特色社会主义思想概论", "第十五章 坚持“一国两制”和推进祖国完全统一"],
  ["习近平新时代中国特色社会主义思想概论", "第十六章 中国特色大国外交和推动构建人类命运共同体"],
  ["习近平新时代中国特色社会主义思想概论", "第十七章 全面从严治党"],

  ["中国近现代史纲要", "第一章 进入近代后中华民族的磨难与抗争"],
  ["中国近现代史纲要", "第二章 不同社会力量对国家出路的早期探索"],
  ["中国近现代史纲要", "第三章 辛亥革命与君主专制制度的终结"],
  ["中国近现代史纲要", "第四章 中国共产党成立和中国革命新局面"],
  ["中国近现代史纲要", "第五章 中国革命的新道路"],
  ["中国近现代史纲要", "第六章 中华民族的抗日战争"],
  ["中国近现代史纲要", "第七章 为建立新中国而奋斗"],
  ["中国近现代史纲要", "第八章 中华人民共和国的成立与中国社会主义建设道路的探索"],
  ["中国近现代史纲要", "第九章 改革开放与中国特色社会主义的开创和发展"],
  ["中国近现代史纲要", "第十章 中国特色社会主义进入新时代"],

  ["思想道德与法治", "绪论：担当复兴大任 成就时代新人"],
  ["思想道德与法治", "第一章 领悟人生真谛 把握人生方向"],
  ["思想道德与法治", "第二章 追求远大理想 坚定崇高信念"],
  ["思想道德与法治", "第三章 继承优良传统 弘扬中国精神"],
  ["思想道德与法治", "第四章 明确价值要求 践行价值准则"],
  ["思想道德与法治", "第五章 遵守道德规范 锤炼道德品格"],
  ["思想道德与法治", "第六章 学习法治思想 提升法治素养"]
];

export const POLITICS_MODULES = [
  { key: "marxism", name: "马克思主义基本原理", objective: "哲学、政治经济学与科学社会主义的原理框架。" },
  { key: "mao-zedong", name: "毛泽东思想和中国特色社会主义理论体系概论", objective: "毛泽东思想及中国特色社会主义理论成果的历史脉络。" },
  { key: "xi-jinping", name: "习近平新时代中国特色社会主义思想概论", objective: "新时代党的创新理论、总体布局与战略安排。" },
  { key: "modern-history", name: "中国近现代史纲要", objective: "从近代民族苦难到中国特色社会主义新时代的历史主线。" },
  { key: "ideology-law", name: "思想道德与法治", objective: "理想信念、道德规范、价值准则与法治素养。" }
];

// 图片目录中的章节属于不同的教材分组。分组信息用于在看板中保留
// “马克思主义哲学 / 基本问题 / 思想篇”等目录层次，同时仍遵循
// 科目 -> 模块 -> 章节 -> 任务的四级数据结构。
const POLITICS_SECTION_RANGES = [
  { start: 0, end: 0, key: "intro", name: "导论" },
  { start: 1, end: 4, key: "marxism-philosophy", name: "马克思主义哲学" },
  { start: 5, end: 6, key: "political-economy", name: "马克思主义政治经济学" },
  { start: 7, end: 8, key: "scientific-socialism", name: "科学社会主义" },
  { start: 9, end: 9, key: "intro", name: "导论" },
  { start: 10, end: 13, key: "mao-zedong", name: "毛泽东思想" },
  { start: 14, end: 17, key: "socialism-theory", name: "中国特色社会主义理论体系" },
  { start: 18, end: 18, key: "intro", name: "导论" },
  { start: 19, end: 23, key: "basic-questions", name: "基本问题" },
  { start: 24, end: 30, key: "layout", name: "布局安排" },
  { start: 31, end: 35, key: "conditions", name: "内外条件" },
  { start: 36, end: 38, key: "old-democratic", name: "旧民主主义革命时期" },
  { start: 39, end: 42, key: "new-democratic", name: "新民主主义革命时期" },
  { start: 43, end: 45, key: "new-china", name: "新中国时期" },
  { start: 46, end: 46, key: "preface", name: "绪论" },
  { start: 47, end: 49, key: "ideology", name: "思想篇" },
  { start: 50, end: 51, key: "morality", name: "道德篇" },
  { start: 52, end: 52, key: "rule-of-law", name: "法治篇" }
];

const politicsModuleKeyByName = new Map(POLITICS_MODULES.map(module => [module.name, module.key]));

function politicsSectionForIndex(index) {
  return POLITICS_SECTION_RANGES.find(range => index >= range.start && index <= range.end)
    ?? { key: "other", name: "其他" };
}

// 稳定的结构化目录入口。POLITICS_OUTLINE 保持简单的 [模块, 章节] 形式，
// 供导入/测试使用；安装器使用这里的稳定 ID 写入任务，避免同名“导论”冲突。
export const POLITICS_OUTLINE_ENTRIES = POLITICS_OUTLINE.map(([moduleName, title], index) => {
  const section = politicsSectionForIndex(index);
  const moduleKey = politicsModuleKeyByName.get(moduleName) ?? `module-${index}`;
  const isOpening = title.startsWith("导论：") || title.startsWith("绪论：") || title === "导论";
  return {
    outlineId: `politics-${String(index + 1).padStart(2, "0")}`,
    index,
    moduleKey,
    moduleName,
    sectionKey: section.key,
    sectionName: section.name,
    title,
    displayName: isOpening ? title : `${section.name} · ${title}`
  };
});

export const PLAN_PHASES = [
  { key: "foundation", name: "阶段一·基础建构", ratio: 0.27, objective: "完成大纲首轮覆盖，建立四科知识骨架与错题系统。" },
  { key: "reinforcement", name: "阶段二·强化串联", ratio: 0.27, objective: "二轮复习、真题拆解，把孤立知识点串成答题框架。" },
  { key: "application", name: "阶段三·应用输出", ratio: 0.24, objective: "强化论述、实务、阅读与材料分析，形成稳定输出。" },
  { key: "sprint", name: "阶段四·冲刺模拟", ratio: 0.17, objective: "限时训练、查漏补缺，建立考场时间分配。" },
  { key: "final", name: "阶段五·考前回收", ratio: 0.05, objective: "只看高频框架、错题和自建材料，保持输出手感。" }
];

export const PLAN_SOURCES = [
  {
    title: "2027 北邮 334《新闻与传播专业综合能力》考试大纲",
    type: "用户提供的官方 PDF",
    url: ""
  },
  {
    title: "2027 北邮 440《新闻与传播专业基础》考试大纲",
    type: "用户提供的官方 PDF",
    url: ""
  },
  {
    title: "北京邮电大学研究生招生网",
    type: "招生信息核对",
    url: "https://yzb.bupt.edu.cn/"
  },
  {
    title: "研招网专业库：新闻与传播（055200）",
    type: "专业学位信息核对",
    url: "https://yz.chsi.com.cn/zyk/specialityByName.do?zymc=%E6%96%B0%E9%97%BB%E4%B8%8E%E4%BC%A0%E6%92%AD&xwlx=30zx"
  },
  {
    title: "北京邮电大学｜新传考研｜26 择校",
    type: "B 站公开考情参考",
    url: "https://www.bilibili.com/video/BV1CPXxYDEBD/"
  },
  {
    title: "新闻传播考研 334 导学规划",
    type: "B 站公开方法参考",
    url: "https://www.bilibili.com/video/BV1HeEX6vEcv/"
  },
  {
    title: "英语二全年规划与经验分享",
    type: "B 站公开方法参考",
    url: "https://www.bilibili.com/video/BV1MY411Y761/"
  },
  {
    title: "2027 考研政治全年复习规划",
    type: "B 站公开方法参考",
    url: "https://www.bilibili.com/video/BV1AB5u6uEqb/"
  }
];

const dailyBlocks = [
  { subjectKey: "politics", startHour: 8, startMinute: 0, label: "08:00-10:00" },
  { subjectKey: "english", startHour: 10, startMinute: 20, label: "10:20-12:20" },
  { subjectKey: "334", startHour: 14, startMinute: 0, label: "14:00-16:00" },
  { subjectKey: "440", startHour: 16, startMinute: 20, label: "16:20-18:20" }
];

const politicsFoundation = [
  ["马克思主义基本原理", "唯物论：物质、意识与实践"],
  ["马克思主义基本原理", "辩证法：联系与发展的总特征"],
  ["马克思主义基本原理", "辩证法：三大规律与五对范畴"],
  ["马克思主义基本原理", "认识论：实践、认识与真理"],
  ["马克思主义基本原理", "唯物史观：社会存在与社会意识"],
  ["马克思主义基本原理", "政治经济学：商品、货币与价值规律"],
  ["马克思主义基本原理", "剩余价值、资本积累与资本主义发展"],
  ["毛泽东思想和中国特色社会主义理论", "毛泽东思想形成发展与活的灵魂"],
  ["毛泽东思想和中国特色社会主义理论", "新民主主义革命理论"],
  ["毛泽东思想和中国特色社会主义理论", "社会主义改造与建设道路探索"],
  ["毛泽东思想和中国特色社会主义理论", "中国特色社会主义理论体系发展脉络"],
  ["习近平新时代中国特色社会主义思想", "新时代总论与主要矛盾"],
  ["习近平新时代中国特色社会主义思想", "五位一体总体布局"],
  ["习近平新时代中国特色社会主义思想", "四个全面战略布局"],
  ["习近平新时代中国特色社会主义思想", "党的领导、国家安全与强军"],
  ["中国近现代史纲要", "旧民主主义革命历史主线"],
  ["中国近现代史纲要", "新民主主义革命与中国共产党"],
  ["中国近现代史纲要", "社会主义建设、改革开放与新时代"],
  ["思想道德与法治", "人生观、理想信念与中国精神"],
  ["思想道德与法治", "道德规范、法治思维与依法治国"],
  ["形势与政策", "建立全年时政事件台账与政策关键词库"]
];

const politicsReinforcement = [
  ["马克思主义基本原理", "马原核心概念辨析与选择题一轮"],
  ["马克思主义基本原理", "马原原理对应材料题设问"],
  ["毛泽东思想和中国特色社会主义理论", "毛中特历史脉络与会议节点"],
  ["习近平新时代中国特色社会主义思想", "新思想专题框架与材料关键词"],
  ["中国近现代史纲要", "史纲时间轴、人物与历史评价"],
  ["思想道德与法治", "思法概念对比与案例判断"],
  ["形势与政策", "核对 2027 最新考试大纲变化与新增表述"],
  ["综合训练", "政治选择题套组与错因分类"],
  ["综合训练", "跨章节易混概念回忆测试"]
];

const politicsApplication = [
  ["综合训练", "马原材料分析题：原理定位与分层作答"],
  ["综合训练", "新思想材料分析题：政策话语转化"],
  ["综合训练", "史纲材料分析题：历史逻辑与现实意义"],
  ["综合训练", "思法材料分析题：价值判断与法治依据"],
  ["形势与政策", "本周重大时政专题整理"],
  ["综合训练", "选择题限时训练与错题二刷"]
];

const politicsSprint = [
  ["冲刺与模拟", "政治选择题限时半套模拟"],
  ["冲刺与模拟", "马原分析题模板与材料迁移"],
  ["冲刺与模拟", "新思想分析题高频专题"],
  ["冲刺与模拟", "史纲与思法分析题高频专题"],
  ["冲刺与模拟", "时政热点与中央最新表述"],
  ["冲刺与模拟", "错题本回炉与薄弱章节补缺"]
];

const politicsFinal = [
  ["考前回收", "政治高频易错选择题回收"],
  ["考前回收", "分析题关键词与首句回忆"],
  ["考前回收", "时政清单与政策表述最终核对"]
];

const englishFoundation = [
  ["词汇与长难句", "核心词汇新学 + 间隔复习"],
  ["词汇与长难句", "长难句：主干、从句与修饰成分"],
  ["阅读理解", "英语二早期真题阅读精读一篇"],
  ["阅读理解", "阅读题型：主旨、细节与推断"],
  ["阅读理解", "阅读题型：词义、态度与例证"],
  ["翻译", "英语二翻译：断句与顺译调整"],
  ["完形填空", "完形：逻辑关系与固定搭配"],
  ["新题型", "新题型：匹配与信息定位"]
];

const englishReinforcement = [
  ["阅读理解", "英语二真题阅读限时两篇 + 精析"],
  ["阅读理解", "真题阅读错因归类与同义替换"],
  ["词汇与长难句", "真题生词、熟词僻义与长难句回收"],
  ["翻译", "真题翻译逐句评分与表达修订"],
  ["完形与新题型", "完形、新题型专项限时训练"],
  ["写作", "小作文功能句与格式框架"],
  ["写作", "大作文图表描述与论证段框架"],
  ["大纲核对", "核对 2027 英语二最新大纲与题型说明"]
];

const englishApplication = [
  ["阅读理解", "近年英语二阅读套组限时训练"],
  ["写作", "小作文独立写作、批改与重写"],
  ["写作", "大作文独立写作、批改与重写"],
  ["翻译", "翻译 + 完形组合限时训练"],
  ["综合训练", "英语二真题分模块模拟与复盘"],
  ["词汇与长难句", "错题词汇与高频同义替换回收"]
];

const englishSprint = [
  ["冲刺与模拟", "英语二阅读四篇限时模拟"],
  ["冲刺与模拟", "完形、新题型、翻译组合模拟"],
  ["冲刺与模拟", "大小作文组合限时写作"],
  ["冲刺与模拟", "近年真题错题三刷"],
  ["冲刺与模拟", "作文素材去模板化与表达替换"],
  ["冲刺与模拟", "全卷时间分配与答题顺序演练"]
];

const englishFinal = [
  ["考前回收", "阅读错题规律与同义替换最终回收"],
  ["考前回收", "大小作文框架默写与个性化表达"],
  ["考前回收", "翻译断句、完形逻辑与新题型方法清单"]
];

export const OUTLINE_334 = [
  ["采访与写作", "新闻采访的特点、流程与内容"],
  ["采访与写作", "网络时代新闻采访的新特点"],
  ["采访与写作", "新闻写作的特征与要求"],
  ["采访与写作", "媒介融合与新闻生产的新流程、新特点"],
  ["编辑与评论", "新闻编辑的基本知识与要求"],
  ["编辑与评论", "互联网对新闻编辑的影响"],
  ["编辑与评论", "新闻评论的特征及要求"],
  ["编辑与评论", "新闻评论的写作实务"],
  ["网络运营与策划", "网络媒体的运营模式"],
  ["网络运营与策划", "网络媒体的策划方案实务"],
  ["网络运营与策划", "网络媒体的营销策略"],
  ["网络运营与策划", "网络媒体的营销策划实务"],
  ["营销与危机传播", "整合营销传播的基本知识"],
  ["营销与危机传播", "危机传播的基本策略"],
  ["营销与危机传播", "危机传播的操作实务"],
  ["效果、监管与伦理", "传播效果的评估方法"],
  ["效果、监管与伦理", "网络媒体的政府监管"],
  ["效果、监管与伦理", "网络媒体的社会责任与伦理规范"],
  ["效果、监管与伦理", "网络时代新闻与传播从业者的媒介素养"]
];

const reinforcement334 = [
  ["采访与写作", "采访流程 + 网络采访：比较框架与采访提纲"],
  ["采访与写作", "新闻写作 + 融合生产：消息改写与多端分发"],
  ["编辑与评论", "编辑要求 + 互联网影响：编辑方案分析"],
  ["编辑与评论", "评论理论 + 写作：论点、结构与论据库"],
  ["网络运营与策划", "运营模式 + 策划方案：平台案例拆解"],
  ["网络运营与策划", "营销策略 + 营销实务：用户与渠道设计"],
  ["营销与危机传播", "整合营销 + 危机策略：模型对比"],
  ["营销与危机传播", "危机传播实务：情境推演与回应文本"],
  ["效果、监管与伦理", "效果评估：指标、方法与方案设计"],
  ["效果、监管与伦理", "监管、责任、伦理与媒介素养专题"]
];

const application334 = [
  ["实务输出", "限时完成采访提纲与追问设计"],
  ["实务输出", "限时完成消息改写与融合报道方案"],
  ["实务输出", "限时完成新闻评论并自评结构"],
  ["实务输出", "限时完成网络媒体运营策划案"],
  ["实务输出", "限时完成整合营销传播方案"],
  ["实务输出", "限时完成危机传播处置方案"],
  ["实务输出", "限时完成传播效果评估方案"],
  ["专题论述", "平台治理、算法伦理与社会责任论述"],
  ["专题论述", "生成式人工智能与新闻生产专题"],
  ["案例库", "本周新闻传播案例更新与一题多用"]
];

const sprint334 = [
  ["冲刺与模拟", "334 简答题组合限时训练"],
  ["冲刺与模拟", "334 论述题提纲 + 完整作答"],
  ["冲刺与模拟", "334 评论类实务压缩模拟"],
  ["冲刺与模拟", "334 策划类实务压缩模拟"],
  ["冲刺与模拟", "334 案例库与热点专题回收"],
  ["冲刺与模拟", "334 错题、漏点与时间分配复盘"]
];

const final334 = [
  ["考前回收", "334 十九个官方考点口述回忆"],
  ["考前回收", "评论、策划、危机三类实务模板默写"],
  ["考前回收", "334 高频案例与伦理监管专题最终回收"]
];

export const OUTLINE_440 = [
  ["新闻学史与理论", "中外新闻学发展史"],
  ["新闻学史与理论", "马克思主义新闻观与中国特色社会主义新闻理论"],
  ["新闻学史与理论", "新闻的基本概念和特征"],
  ["新闻学史与理论", "新闻传播的过程和模式"],
  ["价值、专业主义与社会责任", "新闻价值与新闻选择"],
  ["价值、专业主义与社会责任", "新闻专业主义"],
  ["价值、专业主义与社会责任", "新闻的舆论监督与社会责任"],
  ["价值、专业主义与社会责任", "新闻传播效果"],
  ["价值、专业主义与社会责任", "中国新闻事业的发展与改革"],
  ["传播学史与传播形态", "中外传播学发展史"],
  ["传播学史与传播形态", "人类传播活动的历史和发展"],
  ["传播学史与传播形态", "传播与技术的关系"],
  ["传播学史与传播形态", "人际传播"],
  ["传播学史与传播形态", "群体传播和组织传播"],
  ["传播学史与传播形态", "大众传播"],
  ["传播学史与传播形态", "国际传播与全球传播"],
  ["传播学史与传播形态", "新媒体传播"],
  ["效果、受众与制度", "传播效果理论"],
  ["效果、受众与制度", "传播受众理论"],
  ["效果、受众与制度", "传播制度与媒介规范理论"],
  ["传播学研究方法", "传播学研究的主要方法"]
];

const reinforcement440 = [
  ["新闻学史与理论", "中外新闻学史：时间轴、人物与范式"],
  ["新闻学史与理论", "马克思主义新闻观 + 中国特色新闻理论"],
  ["新闻学史与理论", "新闻概念、传播过程与模式比较"],
  ["价值、专业主义与社会责任", "新闻价值、选择与专业主义争议"],
  ["价值、专业主义与社会责任", "舆论监督、社会责任与事业改革"],
  ["传播学史与传播形态", "传播学史与经验学派、批判学派"],
  ["传播学史与传播形态", "传播技术史与媒介技术理论"],
  ["传播学史与传播形态", "人际、群体、组织与大众传播比较"],
  ["传播学史与传播形态", "国际传播、全球传播与新媒体传播"],
  ["效果、受众与制度", "效果理论发展阶段与代表模型"],
  ["效果、受众与制度", "受众理论、传播制度与规范理论"],
  ["传播学研究方法", "定量、定性与混合研究设计"]
];

const application440 = [
  ["概念与简答", "440 高频概念：定义、源流、内涵、评价"],
  ["概念与简答", "440 简答题：总分总结构与关键词覆盖"],
  ["专题论述", "马克思主义新闻观与主流媒体系统性变革"],
  ["专题论述", "平台化、算法与新闻专业主义"],
  ["专题论述", "智能传播、生成式 AI 与人机关系"],
  ["专题论述", "国际传播能力与全球传播秩序"],
  ["专题论述", "传播效果、受众能动性与平台治理"],
  ["研究设计", "围绕新媒体问题完成研究方案"],
  ["理论迁移", "用两种理论分析同一新闻传播案例"],
  ["理论史", "学者—理论—时代背景关系图回忆"]
];

const sprint440 = [
  ["冲刺与模拟", "440 概念题组合限时训练"],
  ["冲刺与模拟", "440 简答题组合限时训练"],
  ["冲刺与模拟", "440 论述题提纲 + 完整作答"],
  ["冲刺与模拟", "440 理论史与代表学者回收"],
  ["冲刺与模拟", "440 研究方法与研究设计回收"],
  ["冲刺与模拟", "440 错题、漏点与时间分配复盘"]
];

const final440 = [
  ["考前回收", "440 二十一个官方考点口述回忆"],
  ["考前回收", "高频概念与代表学者最终回收"],
  ["考前回收", "论述框架、研究方法与热点专题最终回收"]
];

const subjectDefinitions = {
  politics: {
    name: "思想政治理论",
    color: "#8a4b4b",
    pools: {
      foundation: politicsFoundation,
      reinforcement: politicsReinforcement,
      application: politicsApplication,
      sprint: politicsSprint,
      final: politicsFinal
    },
    routine: ["框架输入", "主动回忆", "选择题训练", "错题与材料输出"]
  },
  english: {
    name: "英语二",
    color: "#315a7d",
    pools: {
      foundation: englishFoundation,
      reinforcement: englishReinforcement,
      application: englishApplication,
      sprint: englishSprint,
      final: englishFinal
    },
    routine: ["词汇复习", "限时做题", "逐句精析", "错因与表达回收"]
  },
  "334": {
    name: "334 新闻与传播专业综合能力",
    color: "#1f5d42",
    pools: {
      foundation: OUTLINE_334,
      reinforcement: reinforcement334,
      application: application334,
      sprint: sprint334,
      final: final334
    },
    routine: ["大纲与理论", "案例补充", "答题框架", "限时输出与复盘"]
  },
  "440": {
    name: "440 新闻与传播专业基础",
    color: "#8a6a32",
    pools: {
      foundation: OUTLINE_440,
      reinforcement: reinforcement440,
      application: application440,
      sprint: sprint440,
      final: final440
    },
    routine: ["概念与理论", "主动回忆", "题目迁移", "完整输出与复盘"]
  }
};

function localDateAt(day, hour, minute) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

function calculatePhaseRanges(totalDays) {
  let cursor = 0;
  return PLAN_PHASES.map((phase, index) => {
    const remaining = totalDays - cursor;
    const phaseDays = index === PLAN_PHASES.length - 1
      ? remaining
      : Math.max(1, Math.round(totalDays * phase.ratio));
    const range = { ...phase, startIndex: cursor, endIndex: Math.min(cursor + phaseDays, totalDays) };
    cursor = range.endIndex;
    return range;
  });
}

function phaseForIndex(ranges, dayIndex) {
  return ranges.find(phase => dayIndex >= phase.startIndex && dayIndex < phase.endIndex)
    ?? ranges.at(-1);
}

function ensureSubject(state, subjectKey, definition) {
  let subject = state.subjects.find(item => item.planSubjectKey === subjectKey)
    ?? state.subjects.find(item => item.name === definition.name);
  if (!subject) {
    subject = {
      id: `plan-subject-${subjectKey}`,
      name: definition.name,
      notes: "",
      color: definition.color,
      weight: 1,
      targetStudyMinutes: 0,
      sortOrder: state.subjects.length,
      archived: false,
      modules: []
    };
    state.subjects.push(subject);
  }
  subject.planSubjectKey = subjectKey;
  subject.modules ??= [];
  return subject;
}

function ensureModule(subject, phase) {
  const planKey = `${BUILTIN_PLAN_VERSION}:${phase.key}`;
  let module = subject.modules.find(item => item.planKey === planKey);
  if (!module) {
    module = createModule(phase.name, subject.modules.length);
    Object.assign(module, {
      id: `plan-module-${subject.planSubjectKey}-${phase.key}`,
      notes: phase.objective,
      planKey,
      weight: 1
    });
    subject.modules.push(module);
  }
  return module;
}

function ensurePoliticsModule(subject, definition, options = {}) {
  const moduleDefinition = POLITICS_MODULES.find(item => item.key === definition.moduleKey)
    ?? POLITICS_MODULES[0];
  const planKey = `${POLITICS_PLAN_VERSION}:${moduleDefinition.key}`;
  let module = subject.modules.find(item => item.planKey === planKey);
  if (!module) {
    module = createModule(moduleDefinition.name, subject.modules.length);
    Object.assign(module, {
      id: `plan-politics-module-${moduleDefinition.key}`,
      notes: moduleDefinition.objective,
      planKey,
      planModuleKey: moduleDefinition.key,
      weight: 1
    });
    subject.modules.push(module);
  } else {
    Object.assign(module, {
      planModuleKey: moduleDefinition.key
    });
    // Keep a user's label, notes, and archive choice during normal startup.
    // The explicit repair action is the opt-in way to restore built-in nodes.
    if (options.repair) {
      module.name = moduleDefinition.name;
      module.notes = moduleDefinition.objective;
      module.archived = false;
    }
  }
  return module;
}

function ensureChapter(module, subjectKey, phaseKey, group) {
  const planKey = `${BUILTIN_PLAN_VERSION}:${subjectKey}:${phaseKey}:${group}`;
  let chapter = module.chapters.find(item => item.planKey === planKey);
  if (!chapter) {
    chapter = createChapter(group, module.chapters.length);
    Object.assign(chapter, {
      id: `plan-chapter-${subjectKey}-${phaseKey}-${module.chapters.length}`,
      planKey
    });
    module.chapters.push(chapter);
  }
  return chapter;
}

function ensurePoliticsChapter(module, entry, options = {}) {
  const planKey = `${POLITICS_PLAN_VERSION}:${entry.outlineId}`;
  let chapter = module.chapters.find(item => item.planKey === planKey);
  if (!chapter) {
    chapter = createChapter(entry.displayName, module.chapters.length);
    Object.assign(chapter, {
      id: `plan-politics-chapter-${entry.outlineId}`,
      planKey,
      outlineId: entry.outlineId,
      outlineTopic: entry.title,
      outlineSectionKey: entry.sectionKey,
      outlineSectionName: entry.sectionName
    });
    module.chapters.push(chapter);
  } else {
    Object.assign(chapter, {
      outlineId: entry.outlineId,
      outlineTopic: entry.title,
      outlineSectionKey: entry.sectionKey,
      outlineSectionName: entry.sectionName
    });
    if (options.repair) {
      chapter.name = entry.displayName;
      chapter.archived = false;
    }
  }
  return chapter;
}

function ensurePlanTags(state) {
  const definitions = [
    ["plan-core", "内置规划", "#1f5d42"],
    ["plan-daily", "每日必做", "#315a7d"],
    ["plan-output", "输出训练", "#8a6a32"]
  ];
  for (const [id, name, color] of definitions) {
    if (!state.tags.some(tag => tag.id === id)) state.tags.push({ id, name, color });
  }
}

function taskDetails(definition, phase, block, title, isWeeklyReview) {
  const routine = definition.routine.map((item, index) => `番茄 ${index + 1}：${item}`).join("；");
  const output = isWeeklyReview
    ? "本日必须产出：本周框架复述、错题清零、一道限时输出和下周薄弱点清单。"
    : `本日必须产出：${title} 的一页笔记、主动回忆记录和可复用错题/案例。`;
  return `${phase.objective}\n学习块：${block.label}，2 小时，4 个 25 分钟番茄。\n${routine}。\n${output}`;
}

function politicsTaskTitle(entry, phase, isWeeklyReview) {
  const prefixByPhase = {
    foundation: "基础精读",
    reinforcement: "强化回忆",
    application: "选择题与材料输出",
    sprint: "限时回收",
    final: "考前口述"
  };
  const prefix = prefixByPhase[phase.key] ?? "复习";
  const title = `${prefix}：${entry.title}`;
  return isWeeklyReview ? `周复盘：${title}` : title;
}

function politicsTaskDetails(entry, phase, block, isWeeklyReview) {
  const reviewLine = isWeeklyReview
    ? "本周复盘产出：章节框架复述、错题清零、易混概念对比和下周薄弱点清单。"
    : "本日必须产出：一页章节框架、主动回忆记录、至少 10 道选择题错因或一份材料题答题提纲。";
  return `${phase.objective}\n目录定位：${entry.moduleName} · ${entry.sectionName} · ${entry.title}\n学习块：${block.label}，2 小时，4 个 25 分钟番茄。\n${isWeeklyReview ? "复述本章核心概念，整理错题并完成一次限时输出。" : "通读教材并标注考点；合上书主动回忆；完成配套选择题；整理错题/材料题。"}\n${reviewLine}`;
}

function rewritePlanKey(value, fromVersion, toVersion) {
  const prefix = `${fromVersion}:`;
  return typeof value === "string" && value.startsWith(prefix)
    ? `${toVersion}:${value.slice(prefix.length)}`
    : value;
}

function findTaskByPlanKey(state, planKey, matches = () => true) {
  let archivedMatch = null;
  for (const subject of state.subjects) {
    for (const module of subject.modules ?? []) {
      for (const chapter of module.chapters ?? []) {
        for (const task of chapter.tasks ?? []) {
          if (task.planKey !== planKey) continue;
          if (!matches({ subject, module, chapter, task })) continue;
          // Prefer an active task when an imported backup contains duplicates.
          if (!task.archived) return task;
          archivedMatch ??= task;
        }
      }
    }
  }
  return archivedMatch;
}

function migrateLegacyBuiltinPlan(state) {
  const legacyVersion = "bupt-mjc-2027-v1";
  let migratedCount = 0;
  let politicsLegacyCount = 0;
  for (const subject of state.subjects) {
    const isPolitics = subject.planSubjectKey === "politics"
      || subject.name === subjectDefinitions.politics.name;
    for (const module of subject.modules ?? []) {
      const moduleWasLegacy = typeof module.planKey === "string"
        && module.planKey.startsWith(`${legacyVersion}:`);
      if (moduleWasLegacy && !isPolitics) module.planKey = rewritePlanKey(module.planKey, legacyVersion, BUILTIN_PLAN_VERSION);
      for (const chapter of module.chapters ?? []) {
        const chapterWasLegacy = typeof chapter.planKey === "string"
          && chapter.planKey.startsWith(`${legacyVersion}:`);
        if (chapterWasLegacy && !isPolitics) chapter.planKey = rewritePlanKey(chapter.planKey, legacyVersion, BUILTIN_PLAN_VERSION);
        let chapterHasActiveUserContent = false;
        for (const task of chapter.tasks ?? []) {
          // A current political task may have been imported with an old
          // generic plan key. Its explicit directory version is authoritative;
          // preserve it so repair cannot archive the active plan by accident.
          if ((isPolitics || task.planSubjectKey === "politics")
            && task.politicsPlanVersion === POLITICS_PLAN_VERSION) {
            if (!task.archived && !task.isReview) chapterHasActiveUserContent = true;
            continue;
          }
          const taskWasLegacy = typeof task.planKey === "string"
            && task.planKey.startsWith(`${legacyVersion}:`);
          if (!taskWasLegacy) {
            if (!task.archived && !task.isReview) chapterHasActiveUserContent = true;
            continue;
          }
          if (isPolitics || task.planSubjectKey === "politics") {
            task.archived = true;
            task.politicsPlanVersion = POLITICS_PLAN_VERSION;
            politicsLegacyCount += 1;
          } else {
            task.planKey = rewritePlanKey(task.planKey, legacyVersion, BUILTIN_PLAN_VERSION);
            migratedCount += 1;
          }
        }
        if (isPolitics && chapterWasLegacy && !chapterHasActiveUserContent) chapter.archived = true;
      }
      // The old political phase container must not sit beside the new
      // five-book directory. Keep its tasks for history, but expose them
      // only through the board's "show archived" switch.
      if (isPolitics && moduleWasLegacy) module.archived = true;
    }
  }
  return { migratedCount, politicsLegacyCount };
}

function politicsPlanIsPresent(state) {
  const subject = state.subjects.find(item => item.planSubjectKey === "politics");
  if (!subject) return false;
  const expectedDays = state.planning?.startDate && state.planning?.endDate
    ? Math.max(0, daysBetween(new Date(`${state.planning.startDate}T00:00:00`), new Date(`${state.planning.endDate}T00:00:00`)) + 1)
    : 0;
  // Validate each expected date, not just the set of chapters represented.
  // This catches a deleted day even when the same chapter appears elsewhere.
  for (let dayIndex = 0; dayIndex < expectedDays; dayIndex += 1) {
    const day = addDays(new Date(`${state.planning.startDate}T00:00:00`), dayIndex);
    const entry = POLITICS_OUTLINE_ENTRIES[dayIndex % POLITICS_OUTLINE_ENTRIES.length];
    const task = findTaskByPlanKey(
      state,
      `${BUILTIN_PLAN_VERSION}:${dateKey(day)}:politics`,
      context => context.subject.planSubjectKey === "politics"
        && context.chapter.planKey === `${POLITICS_PLAN_VERSION}:${entry.outlineId}`
    );
    if (!task
      || task.politicsPlanVersion !== POLITICS_PLAN_VERSION
      || task.outlineId !== entry.outlineId) return false;
  }

  return POLITICS_MODULES.every(moduleDefinition => {
    const module = subject.modules?.find(item => item.planKey === `${POLITICS_PLAN_VERSION}:${moduleDefinition.key}`);
    return module && POLITICS_OUTLINE_ENTRIES
      .filter(entry => entry.moduleKey === moduleDefinition.key)
      .every(entry => module.chapters?.some(chapter =>
        chapter.planKey === `${POLITICS_PLAN_VERSION}:${entry.outlineId}`
      ));
  });
}

function englishCyclePlanIsPresent(state) {
  const englishTasks = getTaskContexts(state, { includeArchived: true })
    .filter(({ subject, task }) => subject.planSubjectKey === "english" && task.planKey);
  if (!englishTasks.length) return false;
  return englishTasks.some(({ task }) => task.englishCyclePhase === "doing")
    && englishTasks.some(({ task }) => task.englishCyclePhase === "consolidating");
}

export function installBuiltinStudyPlan(state, now = new Date(), options = {}) {
  const examDate = new Date(`${state.settings.examDate}T00:00:00`);
  // 以用户设置的备考开始日为规划锚点；旧版本未保存该字段时才退回今天。
  const configuredStart = state.settings.preparationStartDate
    ? new Date(`${state.settings.preparationStartDate}T00:00:00`)
    : startOfDay(now);
  const startDate = Number.isNaN(configuredStart.getTime()) ? startOfDay(now) : startOfDay(configuredStart);
  const endDate = addDays(startOfDay(examDate), -1);
  if (state.planning?.version === BUILTIN_PLAN_VERSION
    && state.planning?.politicsPlanVersion === POLITICS_PLAN_VERSION
    && state.planning?.endDate === dateKey(endDate)
    && state.planning?.examDate === state.settings.examDate
    && politicsPlanIsPresent(state)
    && englishCyclePlanIsPresent(state)
    && !options.repair) {
    return { installed: false, taskCount: 0, planning: state.planning };
  }

  const totalDays = Math.max(0, Math.round((endDate - startDate) / 86_400_000) + 1);
  if (!totalDays) return { installed: false, taskCount: 0, planning: null };

  const migration = migrateLegacyBuiltinPlan(state);
  ensurePlanTags(state);
  const ranges = calculatePhaseRanges(totalDays);
  let createdCount = 0;

  // 先把图片中的所有正式章节建立出来，即使当前剩余备考天数少于 53 天，
  // 看板也能完整呈现目录，后续新增任务会继续挂到对应章节下。
  const politicsDefinition = subjectDefinitions.politics;
  const politicsSubject = ensureSubject(state, "politics", politicsDefinition);
  for (const entry of POLITICS_OUTLINE_ENTRIES) {
    const module = ensurePoliticsModule(politicsSubject, entry, options);
    ensurePoliticsChapter(module, entry, options);
  }

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const day = addDays(startDate, dayIndex);
    const phase = phaseForIndex(ranges, dayIndex);
    const phaseDayIndex = dayIndex - phase.startIndex;
    const isWeeklyReview = (dayIndex + 1) % 7 === 0;

    for (const block of dailyBlocks) {
      const definition = subjectDefinitions[block.subjectKey];
      const politicsEntry = block.subjectKey === "politics"
        ? POLITICS_OUTLINE_ENTRIES[dayIndex % POLITICS_OUTLINE_ENTRIES.length]
        : null;
      const pool = definition.pools[phase.key];
      const [baseGroup, baseTitle] = politicsEntry
        ? [politicsEntry.sectionName, politicsEntry.title]
        : pool[phaseDayIndex % pool.length];
      const group = isWeeklyReview ? `${baseGroup}·周复盘` : baseGroup;
      const englishCyclePhase = block.subjectKey === "english"
        ? (dayIndex % 2 === 0 ? "doing" : "consolidating")
        : null;
      const englishExamLabel = state.englishCycle?.examType === "英语一" ? "一" : "二";
      const englishCycleTitle = englishCyclePhase === "doing"
        ? `英语${englishExamLabel}第 ${Math.floor(dayIndex / 2) + 1} 套真题：完成一套真题`
        : englishCyclePhase === "consolidating"
          ? `英语${englishExamLabel}第 ${Math.floor(dayIndex / 2) + 1} 套真题：巩固与复习`
          : null;
      const title = politicsEntry
        ? politicsTaskTitle(politicsEntry, phase, isWeeklyReview)
        : (isWeeklyReview ? `周复盘：${baseTitle}` : baseTitle);
      const planKey = `${BUILTIN_PLAN_VERSION}:${dateKey(day)}:${block.subjectKey}`;
      const existingTask = findTaskByPlanKey(state, planKey);
      if (existingTask) {
        // Only an explicit repair may restore an archived built-in task;
        // ordinary launches must respect a user's archive choice.
        if (existingTask.archived && options.repair) existingTask.archived = false;
        if (englishCyclePhase) Object.assign(existingTask, {
          englishCyclePhase,
          englishSetIndex: Math.floor(dayIndex / 2),
          englishExamType: state.englishCycle?.examType || "英语二",
          englishSection: existingTask.englishSection || "Text 1～4 / 完形 / 新题型 / 翻译"
        });
        // 旧版本内置英语任务没有周期字段时，补齐自动生成的标题和说明；
        // 已经被用户手动改名的任务则保留原内容。
        const looksLikeLegacyEnglishTask = existingTask.title === baseTitle || existingTask.title === englishCycleTitle;
        if (englishCyclePhase && !existingTask.englishCycleMigrated && looksLikeLegacyEnglishTask) {
          existingTask.title = englishCycleTitle ?? existingTask.title;
          existingTask.details = `${phase.objective}\n两天一套真题计划：${englishCyclePhase === "doing" ? "今天完成整套真题并记录文章/题型错因。" : "今天巩固、整理并复习前一天真题中的词汇、长难句和错题。"}\n学习块：${block.label}，2 小时，4 个 25 分钟番茄。`;
          existingTask.englishCycleMigrated = true;
        }
        continue;
      }

      const subject = ensureSubject(state, block.subjectKey, definition);
      const module = politicsEntry
        ? ensurePoliticsModule(subject, politicsEntry, options)
        : ensureModule(subject, phase);
      const chapter = politicsEntry
        ? ensurePoliticsChapter(module, politicsEntry, options)
        : ensureChapter(module, block.subjectKey, phase.key, group);
      const scheduledAt = localDateAt(day, block.startHour, block.startMinute);
      const dueAt = new Date(scheduledAt.getTime() + 120 * 60_000);
      const task = createTask({
        title: englishCycleTitle ?? title,
        details: politicsEntry
          ? politicsTaskDetails(politicsEntry, phase, block, isWeeklyReview)
          : englishCyclePhase
            ? `${phase.objective}\n两天一套真题计划：${englishCyclePhase === "doing" ? "今天完成整套真题并记录文章/题型错因。" : "今天巩固、整理并复习前一天真题中的词汇、长难句和错题。"}\n学习块：${block.label}，2 小时，4 个 25 分钟番茄。`
          : taskDetails(definition, phase, block, baseTitle, isWeeklyReview),
        status: "notStarted",
        priority: phase.key === "final" ? "high" : "normal",
        weight: 1,
        scheduledAt: scheduledAt.toISOString(),
        dueAt: dueAt.toISOString(),
        estimatedMinutes: 100,
        automaticReview: false,
        tags: ["plan-core", "plan-daily", ...(phase.key === "application" || phase.key === "sprint" ? ["plan-output"] : [])]
      }, chapter.tasks.length);
      Object.assign(task, {
        id: `plan-task-${dateKey(day)}-${block.subjectKey}`,
        planKey,
        planDate: dateKey(day),
        planPhase: phase.key,
        planSubjectKey: block.subjectKey,
        planBlockLabel: block.label,
        planBlockMinutes: 120,
        pomodoroTarget: 4,
        studyNotes: "",
        resourceLinks: [],
        attachments: [],
        outlineTopic: politicsEntry
          ? politicsEntry.title
          : (phase.key === "foundation" && ["334", "440"].includes(block.subjectKey) ? baseTitle : null),
        outlineId: politicsEntry?.outlineId ?? null,
        outlineSectionKey: politicsEntry?.sectionKey ?? null,
        outlineSectionName: politicsEntry?.sectionName ?? null,
        politicsPlanVersion: politicsEntry ? POLITICS_PLAN_VERSION : null,
        englishCyclePhase,
        englishSetIndex: englishCyclePhase ? Math.floor(dayIndex / 2) : null,
        englishExamType: englishCyclePhase ? (state.englishCycle?.examType || "英语二") : null,
        englishSection: englishCyclePhase ? "Text 1～4 / 完形 / 新题型 / 翻译" : null
      });
      chapter.tasks.push(task);
      createdCount += 1;
    }
  }

  const phaseSchedule = ranges.map(phase => ({
    key: phase.key,
    name: phase.name,
    objective: phase.objective,
    startDate: dateKey(addDays(startDate, phase.startIndex)),
    endDate: dateKey(addDays(startDate, Math.max(phase.endIndex - 1, phase.startIndex)))
  }));
  state.settings.dailyGoalMinutes = 400;
  state.settings.dailyPlannedMinutes = 480;
  state.settings.dailyPomodoroTarget = 16;
  state.settings.subjectPomodoroTarget = 4;
  state.planning = {
    version: BUILTIN_PLAN_VERSION,
    installedAt: new Date().toISOString(),
    startDate: dateKey(startDate),
    endDate: dateKey(endDate),
    examDate: state.settings.examDate,
    dailyStudyMinutes: 480,
    dailyFocusMinutes: 400,
    dailyPomodoroTarget: 16,
    subjectBlockMinutes: 120,
    subjectPomodoroTarget: 4,
    politicsPlanVersion: POLITICS_PLAN_VERSION,
    politicsOutlineCount: POLITICS_OUTLINE_ENTRIES.length,
    phaseSchedule,
    sources: PLAN_SOURCES
  };

  return {
    installed: true,
    taskCount: createdCount,
    migratedCount: migration.migratedCount,
    archivedPoliticsCount: migration.politicsLegacyCount,
    planning: state.planning
  };
}

export function planTasksForDate(state, day = new Date()) {
  const key = dateKey(day);
  return getTaskContexts(state)
    .filter(({ task }) => !task.archived && task.planDate === key)
    .sort((a, b) => new Date(a.task.scheduledAt) - new Date(b.task.scheduledAt));
}
