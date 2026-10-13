import type { Concept, Connection, Idea, InnovationProvider, Critic } from '../../types';
import { pick, uid, clamp } from '../../utils/id';
import { localConceptDraft } from '../conceptDraft';
import { exploreLocally } from './exploration';

function specialConnections(a: Concept, b: Concept): Connection[] | null {
  if (
    new Set([a.id, b.id]).size !== 2 ||
    ![a.id, b.id].includes('蜂群') ||
    ![a.id, b.id].includes('金刚石')
  )
    return null;
  const rows = [
    [
      '分布式缺陷传感网络',
      '局部通信',
      '缺陷中心',
      '已有知识：金刚石的部分缺陷中心可用于局域传感，蜂群依赖局部互动。创意假设：把独立传感节点的读数作为“个体判断”，仅交换置信度和异常位置，以多数一致性降低局部噪声。需验证节点标定误差和通信成本。',
      84,
      66,
    ],
    [
      '像蜂群一样分配热负载',
      '分布式决策',
      '高导热',
      '已有知识：金刚石能高效导热，蜂群会通过个体行为调节群体状态。创意假设：给多块散热单元配置温度测量与局部功率调度，让热负载转移到余量较大的单元。金刚石负责导热，群体规则负责分配，二者的作用明确分离。',
      72,
      75,
    ],
    [
      '可容错的光学读出阵列',
      '冗余',
      '光学透明',
      '创意假设：参考蜂群的个体冗余，为缺陷传感阵列设置多条光学读出路径；某个节点失效时由邻居补充覆盖。透明材料不自动等于可读出，需要额外激发光源、滤光和标定。',
      77,
      60,
    ],
    [
      '自组织的微传感布局',
      '自组织',
      '缺陷中心',
      '创意假设：借鉴蜂群对局部线索的响应，用节点测得的梯度迭代调整采样密度。可先在软件中模拟节点位置，再指导固定传感片布局；这不是让金刚石晶格自行移动。',
      89,
      47,
    ],
    [
      '耐磨外壳里的协作探针',
      '局部通信',
      '高硬度',
      '创意假设：为巡检探针使用金刚石耐磨接触面，并让多个探针只共享疑似缺陷坐标。硬度解决接触磨损，局部通信减少重复扫描；需比较金刚石涂层与普通耐磨材料的成本。',
      68,
      71,
    ],
  ] as const;
  return rows.map(([title, swarm, diamond, explanation, novelty, plausibility]) => ({
    id: uid(),
    title,
    conceptAProperty: a.id === '蜂群' ? swarm : diamond,
    conceptBProperty: b.id === '金刚石' ? diamond : swarm,
    explanation,
    novelty,
    plausibility,
  }));
}

export const mutations = [
  '更实用',
  '更离谱',
  '更便宜',
  '更小',
  '更简单',
  '更未来',
  '去掉AI',
  '加入机械结构',
  '加入光学',
  '加入生物机制',
  '提高可制造性',
  '换一个使用场景',
] as const;
export type Mutation = (typeof mutations)[number];
function enrichExample(idea: Idea, c: Connection, a: Concept, b: Concept): Idea {
  if (![a.id, b.id].includes('蜂群') || ![a.id, b.id].includes('金刚石')) return idea;
  const prototypes: Record<string, { name: string; problem: string; method: string }> = {
    分布式缺陷传感网络: {
      name: '蜂巢探针 · HiveSense',
      problem: '多点弱信号测量中，单个探头漂移会造成误报；把所有原始数据送到中心又增加带宽与延迟。',
      method:
        '以三到五个现成缺陷中心传感模块组成演示阵列，各自完成光学读出与标定。每个节点仅交换异常标记和置信度，用邻域一致性规则决定是否报警。对照独立报警和集中式融合，记录误报率、漏报率、延迟及总能耗。',
    },
    像蜂群一样分配热负载: {
      name: '蜂巢散热底座',
      problem: '多芯片系统的局部热点会限制性能，而均匀增加冷却能力会浪费能量。',
      method:
        '在可替换的高导热垫片上布置三个受控加热单元和温度传感器。使用相邻温差与热余量分配加热功率，对比金刚石片、铜片以及无调度三种配置的峰值温度与成本。',
    },
    可容错的光学读出阵列: {
      name: '光路接力站',
      problem: '多点光学传感中的遮挡或单一路径失效，会造成整片区域暂时不可观测。',
      method:
        '用两个光学读出方向观测同一小型传感阵列；人工遮挡一条光路，用剩余视角与相邻节点数据补充覆盖。测量恢复时间、误差和新增光学器件成本。',
    },
    自组织的微传感布局: {
      name: '会迁移的采样地图',
      problem: '固定均匀采样常把测量资源花在平静区域，却漏掉局部变化较快的位置。',
      method:
        '先在仿真中用局部梯度与置信度分配采样预算，再用可移动的探头在固定网格上验证。自组织只改变测量位置或时序，不改变金刚石内部晶格。',
    },
    耐磨外壳里的协作探针: {
      name: '协作耐磨巡检笔',
      problem: '粗糙表面的重复巡检会磨损接触探针，多名操作者也可能反复扫描同一区域。',
      method:
        '制作可更换耐磨接触头，用三支探针记录已扫描位置与疑似缺陷。共享简化区域标记以减少重复，分别测量涂层寿命、定位误差、完成时间和每次检测成本。',
    },
  };
  const spec = prototypes[c.title];
  if (!spec) return idea;
  if (idea.kind === '实用型')
    return {
      ...idea,
      name: spec.name,
      problem: spec.problem,
      summary: `把“${c.title}”变成可做对照实验的小型原型，让两个概念各自承担明确职责。`,
      implementation: spec.method,
    };
  if (idea.kind === '探索型')
    return {
      ...idea,
      name: `${spec.name.split(' · ')[0]} / 机制边界实验`,
      problem: `${spec.problem} 但尚不知道群体规则带来的收益能否抵消传感与通信代价。`,
      summary: '扫描节点数量、噪声强度与通信延迟，找到机制有效和失效的边界。',
      implementation: `${spec.method} 每次只改变一个变量；额外设置随机决策对照，避免把样本偶然性当作协作收益。`,
    };
  return {
    ...idea,
    name:
      c.title === '分布式缺陷传感网络'
        ? '会投票的钻石吊灯'
        : `${spec.name.split(' · ')[0]} / 荒诞体验版`,
    problem: '观众难以直观理解局部判断怎样形成群体共识，以及共识为什么也可能出错。',
    summary: '让每个“钻石个体”以灯光表达意见，观众通过干扰一个节点，观察整个装置如何协商。',
    implementation:
      '用透明亚克力模型模拟金刚石节点，按钮代替昂贵的量子测量输入。相邻节点交换简单状态，LED 展示共识变化；明确标注这是机制演示，不具备真实量子传感能力。',
  };
}
const changes: Record<
  Mutation,
  { name: string; change: string; method: string; risk: string; n: number; f: number; fun: number }
> = {
  更实用: {
    name: '现场验证版',
    change: '只处理一种高频问题，并提供手动回退路径',
    method: '先记录十次现有流程的耗时，再用原型完成同一任务；只有时间或误差显著降低才增加功能。',
    risk: '真实工作流程可能已经有更省事的替代方案。',
    n: -5,
    f: 12,
    fun: -4,
  },
  更离谱: {
    name: '不可能剧场',
    change: '把状态变化夸张为一场可以参与的空间表演',
    method: '使用灯光、声音与实体模型表达假想机制，观众改变输入后观察戏剧化反馈。',
    risk: '表演效果不能证明机制在真实工程中可行。',
    n: 13,
    f: -22,
    fun: 18,
  },
  更便宜: {
    name: '低成本实验套件',
    change: '替换专用器件，仅保留验证关键映射所需的结构',
    method: '用纸板、通用夹具和已有测量设备制作替代模型，列出逐项物料清单并设置成本上限。',
    risk: '替代材料可能无法保留关键物理性质，必须明确模拟与实物的差异。',
    n: -3,
    f: 10,
    fun: 2,
  },
  更小: {
    name: '掌上模块',
    change: '缩减到单个输入、单个输出和一个核心单元',
    method: '先制作掌心大小的非功能模型检查布局，再测试缩小后功耗、散热与信号噪声的变化。',
    risk: '尺度变化可能使原有作用机制失效。',
    n: 5,
    f: -4,
    fun: 6,
  },
  更简单: {
    name: '单回路原型',
    change: '删除多余分支，只保留可解释的一条输入—转换—输出路径',
    method: '用固定规则和单步操作取代自动编排，每一步都显示或记录状态，人工复位。',
    risk: '简化可能牺牲适应复杂环境的能力。',
    n: -7,
    f: 14,
    fun: -2,
  },
  更未来: {
    name: '远期研究平台',
    change: '研究可重构单元与自适应接口的长期潜力',
    method: '先用仿真扫描参数空间，把尚不存在或未验证的部件列为独立研究假设，再分阶段验证。',
    risk: '关键部件可能仍缺少可制造的实现路线。',
    n: 14,
    f: -18,
    fun: 12,
  },
  去掉AI: {
    name: '确定性控制版',
    change: '用阈值、查表和有限状态机取代所有学习与推断模块',
    method: '为每种输入范围定义明确动作，用人工标定的查找表控制输出，不训练模型、不调用推理服务。',
    risk: '固定规则在未预见的环境中可能失效，需要人工调参。',
    n: -4,
    f: 11,
    fun: 0,
  },
  加入机械结构: {
    name: '机械反馈版',
    change: '增加弹簧—连杆组件，把状态变化转换为可见位移',
    method: '用可调预紧弹簧提供阈值，以连杆放大位移，并设置机械限位和手动释放机构。',
    risk: '摩擦、回差和疲劳会改变响应阈值。',
    n: 6,
    f: 2,
    fun: 8,
  },
  加入光学: {
    name: '光学读出版',
    change: '用反射标记和光电探测读取关键单元状态',
    method: '增加低功率光源、遮光罩和光电接收器，先测暗噪声，再用参考标记校正光强变化。',
    risk: '环境光和对准误差可能掩盖真实变化。',
    n: 7,
    f: -3,
    fun: 7,
  },
  加入生物机制: {
    name: '仿生适应版',
    change: '借鉴局部感知与负反馈实现自适应，不直接使用活体材料',
    method: '让每个模块仅观测相邻单元，以抑制过强输出的规则保持整体平衡；用仿真验证稳定性。',
    risk: '生物类比未必适用于工程尺度，需要证明稳定性。',
    n: 10,
    f: -5,
    fun: 8,
  },
  提高可制造性: {
    name: '标准装配版',
    change: '统一接口、减少零件种类，并让关键部件可拆卸更换',
    method: '建立标准尺寸与公差表，优先激光切割或通用加工，装配五件样品比较一致性。',
    risk: '标准件的性能可能低于原来设想的专用部件。',
    n: -4,
    f: 16,
    fun: -1,
  },
  换一个使用场景: {
    name: '课堂探索版',
    change: '将原场景改为课堂或科学馆中的可重复互动实验',
    method: '把参数转换为可调旋钮，让使用者先预测结果，再对照观察记录；提供复位和说明卡。',
    risk: '教育趣味不能替代对原理正确性的验证。',
    n: 6,
    f: 7,
    fun: 13,
  },
};

export const localGenerator: InnovationProvider = {
  async analyzeConcept(name, description) {
    return localConceptDraft(name, description);
  },
  async generateConnections(a, b, options = {}) {
    const special = specialConnections(a, b);
    const count = Math.max(4, Math.min(12, options.count ?? 5));
    const explored = exploreLocally(a, b, count, options.exclude);
    if (special && !options.exclude?.length)
      return [special[0], pick(special.slice(1)), ...explored.slice(0, count - 2)];
    return explored;
  },
  async generateIdeas(a, b, c, collisionId) {
    const scenario = pick(['工作台', '共享实验室', '小型展厅', '移动巡检点']);
    return (['实用型', '探索型', '荒诞型'] as const).map((kind, i) => {
      const id = uid();
      const practical = i === 0,
        exploratory = i === 1;
      const name = practical
        ? `${a.functions[0]}协作工具台`
        : exploratory
          ? `${c.conceptBProperty}映射实验仪`
          : `会${b.functions[0]}的${a.name}剧场`;
      return enrichExample(
        {
          id,
          rootId: id,
          parentId: null,
          version: 1,
          mutation: '初始创意',
          collisionId,
          connectionId: c.id,
          kind,
          name,
          summary: practical
            ? `在${scenario}中，以${a.name}的“${c.conceptAProperty}”改进${b.name}的${b.functions[0]}过程。`
            : exploratory
              ? `用可调实验平台检验“${c.conceptAProperty}”与“${c.conceptBProperty}”之间是否存在可测量的映射。`
              : `把${a.name}的变化转换为${b.name}的夸张反馈，让观众操纵一场跨领域表演。`,
          problem: practical
            ? `${b.functions[0]}过程中，单一方案受“${b.constraints[0]}”限制；尝试引入可独立验证的辅助环节。`
            : exploratory
              ? `目前只有概念类比，尚不知道${a.name}的机制是否能在${b.name}的尺度与条件下成立。`
              : '抽象知识缺少可参与的表达，观众难以感知两个领域之间的差异与联系。',
          principle: `创意假设：${c.explanation} ${practical ? '将两种机制通过明确接口连接，避免直接混合不兼容材料。' : exploratory ? '把属性对应关系转成可控制的实验变量，不预设实验一定成功。' : '以可见模型模拟假想行为，不宣称现实物理系统已能实现。'}`,
          contributionA: `${a.name}：提供“${c.conceptAProperty}”这一设计线索，用于${a.functions[0]}环节。`,
          contributionB: `${b.name}：提供“${c.conceptBProperty}”这一设计线索，用于${b.functions[0]}环节。`,
          implementation: practical
            ? `1. 单独验证${a.name}与${b.name}的输入输出。2. 在${scenario}制作一组可拆卸接口。3. 设置没有新增机制的对照组，记录效率、误差和成本。4. 若无收益，移除复杂环节。`
            : exploratory
              ? `1. 用仿真或等效材料建立最小模型。2. 每次只改变“${c.conceptAProperty}”对应的一个参数。3. 测量“${c.conceptBProperty}”的响应。4. 重复实验并报告不成立的条件。`
              : '1. 用纸板、灯光与机械道具制作演示。2. 将观众动作作为输入。3. 用夸张的颜色、形变或声音表达结果。4. 在展牌上明确哪些部分是科学事实，哪些是想象。',
          biggestProblem: `${a.constraints.join('、')}；${b.constraints.join('、')}。${exploratory ? '跨尺度映射可能完全不成立。' : practical ? '新增部件的成本可能超过实际收益。' : '艺术表达不能被误认为已验证的技术。'}`,
          novelty: c.novelty === null ? null : clamp(c.novelty + i * 6),
          feasibility:
            c.plausibility === null
              ? null
              : clamp(c.plausibility + (practical ? 8 : exploratory ? -15 : -32)),
          fun: clamp(58 + i * 18 + Math.random() * 8),
          createdAt: new Date().toISOString(),
          source: 'local',
        },
        c,
        a,
        b,
      );
    });
  },
  async evolveIdea(idea, mutation, a, b) {
    const change = changes[mutation as Mutation];
    if (!change) throw new Error('未知的演化方向');
    const id = uid();
    return {
      ...idea,
      id,
      parentId: idea.id,
      version: idea.version + 1,
      mutation,
      name: `${idea.name.split(' / ')[0]} / ${change.name}`,
      summary: `${change.change}。保留${a.name}与${b.name}的核心映射，迭代自 V${idea.version}。`,
      principle: `${idea.principle}\n本次变更：${change.change}。这仍是待验证的创意假设。`,
      implementation: `${change.method}\n继承上一版的验证目标：${idea.problem}`,
      biggestProblem: change.risk,
      novelty: idea.novelty === null ? null : clamp(idea.novelty + change.n),
      feasibility: idea.feasibility === null ? null : clamp(idea.feasibility + change.f),
      fun: idea.fun === null ? null : clamp(idea.fun + change.fun),
      createdAt: new Date().toISOString(),
      source: 'local',
    };
  },
  async criticizeIdea(idea, a, b): Promise<Critic> {
    const verdict =
      idea.feasibility === null
        ? 'Needs Work'
        : idea.feasibility < 30
          ? 'Physically Questionable'
          : idea.kind === '荒诞型' && idea.feasibility < 55
            ? 'Mostly Gimmick'
            : idea.feasibility >= 72
              ? 'Promising'
              : 'Needs Work';
    return {
      verdict,
      majorProblems: [
        `问题价值：${idea.problem} 尚缺少真实用户频次和痛点强度的数据。`,
        `物理与制造：${idea.biggestProblem}`,
        `机制映射：${a.name}的属性不一定能在${b.name}的尺度、介质和边界条件中保持；必须证明接口是有效的。`,
      ],
      minorProblems: [
        `成熟替代方案：先比较现有${b.functions[0]}工具；本地模式没有进行市场或专利检索。`,
        `成本与需求：${a.constraints[0]}和${b.constraints[0]}可能增加维护负担，用户未必愿意为复杂性付费。`,
      ],
      potentialFixes: [
        `制作只验证“${a.properties[0]}”映射的一组对照实验，记录不支持假设的结果。`,
        '采访 3 位目标使用者，对比现有方案的时间、成本与失败率。',
        '先移除自动化或装饰性组件，检验最简单的单回路版本是否已足够。',
      ],
      explanation:
        verdict === 'Promising'
          ? '机制分工相对清楚，适合低成本验证；仍不代表技术或商业可行性已经得到证明。'
          : verdict === 'Physically Questionable'
            ? '关键映射与尺度假设尚未成立，先验证物理边界，再讨论产品。'
            : verdict === 'Mostly Gimmick'
              ? '作为展览体验有趣，但作为解决实际问题的工具，新增复杂性暂时缺少价值依据。'
              : '值得保留，但需要用对照实验和用户证据回答关键问题。',
    };
  },
};
