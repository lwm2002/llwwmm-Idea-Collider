import type { Concept, Connection } from '../../types';
import { uid } from '../../utils/id';

type Lens = {
  dimension: string;
  match: RegExp;
  question: (a: string, b: string) => string;
  test: string;
};
const lenses: Lens[] = [
  {
    dimension: '结构',
    match: /结构|网络|孔|阵列|分支|层|模块|晶|几何|连接/,
    question: (a, b) =>
      `若将“${a}”的连接关系转译成“${b}”的布局规则，哪些节点必须保留，哪些连接可以移除？先画映射图，不假定材料性质能够一起迁移。`,
    test: '移除一个连接，比较改变前后的连通性与局部失效范围',
  },
  {
    dimension: '行为',
    match: /响应|反馈|控制|决策|适应|阈值|选择|自组织|调节/,
    question: (a, b) =>
      `把“${a}”的触发条件作为“${b}”的动作规则：什么事件启动动作，何时停止？需要能识别触发条件的接口，不能只因为都有变化就认定机制相同。`,
    test: '固定输入，比较原规则、映射规则与随机规则的输出差异',
  },
  {
    dimension: '时间',
    match: /时间|周期|节律|同步|脉冲|步进|延迟|缓|快|生长|记忆|刷新|衰|循环|恢复|储/,
    question: (a, b) =>
      `让“${a}”与“${b}”以不同节奏工作，探索等待、积累和释放能否产生新的体验或用途。需要先测出两者时间尺度；时间尺度不相容可能直接否定组合。`,
    test: '对比同步、错峰与随机时序，记录等待时间及结果变化',
  },
  {
    dimension: '信息',
    match: /信号|信息|编码|传递|感知|感|透明|光|通信|数据|学习|识别/,
    question: (a, b) =>
      `把“${a}”中可观察的差异编码为“${b}”能够表达的状态，形成跨媒介的说明或沟通方式。必须定义对应表以及丢失的信息；相似图案不等于相同含义。`,
    test: '让不了解映射规则的人解读输出，统计误读类型，再与直接表达比较',
  },
  {
    dimension: '社会',
    match: /分布|协作|共享|群|冗余|资源|局部|分配|网络|竞争|交换/,
    question: (a, b) =>
      `将“${a}”类比为参与者之间的分工，将“${b}”类比为共享规则，探索谁掌握信息、谁承担代价。这里只迁移组织关系，不把物理现象当成社会规律。`,
    test: '用角色卡模拟信息不对称与成员退出，观察是否出现垄断或协作崩溃',
  },
  {
    dimension: '空间',
    match: /微|尺度|轻|薄|二维|三维|空间|展开|折|方向|表面|界面/,
    question: (a, b) =>
      `以“${a}”改变“${b}”发生的位置或接触边界，探索缩放、折叠或重新布置后的用途。需明确哪种尺度下仍有效，不能假定小模型可直接放大。`,
    test: '制作两个尺度或两种布局的模型，比较边界效应与有效作用范围',
  },
  {
    dimension: '能量',
    match: /热|能|电|吸收|吸能|流动|传输|储|耗散|力|压力|弹性/,
    question: (a, b) =>
      `检查“${a}”释放或耗散的资源是否能成为“${b}”所需的输入。先明确资源种类、转换接口和损耗；若单位或数量级不匹配，这条连接就不成立。`,
    test: '列输入输出收支，测转换前后损耗，并与直接供给比较',
  },
  {
    dimension: '体验',
    match: /色|声|光|透明|柔|纹|节|形|波|运动|可视|显示/,
    question: (a, b) =>
      `把“${a}”的可感知变化映射到“${b}”的表达形式，用于解释、表演或审美体验。这里追求感知与理解的改变，不声称两者拥有相同物理机制。`,
    test: '对比有无映射的两个演示，记录参与者对变化的理解与误解',
  },
];

/** Offline exploration prompts grounded in supplied properties; no invented knowledge. */
export function exploreLocally(
  a: Concept,
  b: Concept,
  count = 5,
  exclude: Connection[] = [],
): Connection[] {
  if (!a.properties.length || !b.properties.length) return [];
  // Explore a bounded sample for large inputs without truncating saved definitions.
  const totalPairs = a.properties.length * b.properties.length;
  const pairIndexes = new Set<number>();
  if (totalPairs <= 1024) {
    for (let i = 0; i < totalPairs; i++) pairIndexes.add(i);
  } else {
    // Sampling without replacement also terminates when randomness repeats.
    for (let i = totalPairs - 1024; i < totalPairs; i++) {
      const index = Math.floor(Math.random() * (i + 1));
      pairIndexes.add(pairIndexes.has(index) ? i : index);
    }
  }
  const sampled = [...pairIndexes].flatMap((index) => {
    const pa = a.properties[Math.floor(index / b.properties.length)];
    const pb = b.properties[index % b.properties.length];
    return lenses.map((lens) => ({
      pa,
      pb,
      lens,
      fit: Number(lens.match.test(pa)) + Number(lens.match.test(pb)),
      tie: Math.random(),
    }));
  });
  const candidates = sampled
    .filter((c) => c.fit > 0)
    .sort((x, y) => y.fit - x.fit || x.tie - y.tie);
  // Unknown properties remain explicit questions rather than fabricated facts.
  if (candidates.length < count) candidates.push(...sampled.filter((c) => c.fit === 0));
  const unique = new Set(
    exclude.map((c) => JSON.stringify([c.conceptAProperty, c.conceptBProperty, c.dimension])),
  );
  for (let i = candidates.length - 1; i >= 0; i--) {
    const c = candidates[i];
    const key = JSON.stringify([c.pa, c.pb, c.lens.dimension]);
    if (unique.has(key)) candidates.splice(i, 1);
    else unique.add(key);
  }
  const chosen: typeof candidates = [];
  while (chosen.length < count && candidates.length) {
    const score = (c: (typeof candidates)[number]) =>
      c.fit * 2 -
      chosen.filter((x) => x.lens.dimension === c.lens.dimension).length * 8 -
      chosen.filter((x) => x.pa === c.pa).length * 3 -
      chosen.filter((x) => x.pb === c.pb).length * 3 -
      chosen.filter((x) => x.pa === c.pa && x.pb === c.pb).length * 10;
    candidates.sort((x, y) => score(y) - score(x) || y.tie - x.tie);
    const fresh =
      chosen.length < 4
        ? candidates.findIndex(
            (c) =>
              !chosen.some((x) => x.lens.dimension === c.lens.dimension) &&
              !chosen.some((x) => x.pa === c.pa && x.pb === c.pb),
          )
        : candidates.findIndex((c) => !chosen.some((x) => x.pa === c.pa && x.pb === c.pb));
    chosen.push(candidates.splice(fresh >= 0 ? fresh : 0, 1)[0]);
  }
  const basis = (concept: Concept, property: string): NonNullable<Connection['basisA']> => ({
    status: property.startsWith('待确认') ? '推测' : concept.source ? '用户定义' : '已知特征',
    reason: property.startsWith('待确认')
      ? '尚未提供这个概念的具体特征，需要补充定义或使用 AI 拆解后再验证。'
      : `${concept.name}的${concept.source ? '用户草案' : '内置条目'}记录了“${property}”；这只是探索起点，不代表跨概念映射已经成立。`,
  });
  return chosen.map(({ pa, pb, lens, fit }) => ({
    id: uid(),
    dimension: lens.dimension,
    title: `${lens.dimension}探索 · ${pa}如何遇见${pb}`,
    conceptAProperty: pa,
    conceptBProperty: pb,
    basisA: basis(a, pa),
    basisB: basis(b, pb),
    explanation: `创意假设（本地探索提问）：${lens.question(`${a.name}的${pa}`, `${b.name}的${pb}`)} 场景起点：${a.functions[0]}与${b.functions[0]}。反证实验：${lens.test}；如果组合没有带来区别于单独使用的结果，就放弃映射。边界：${a.name}的“${a.constraints[0]}”和${b.name}的“${b.constraints[0]}”仍然存在。${fit === 0 ? '当前属性缺少可识别机制，这只是待补充信息的问题。' : ''}`,
    novelty: 55 + Math.round(Math.random() * 25),
    plausibility: fit === 0 ? 15 : 30 + fit * 12,
  }));
}
