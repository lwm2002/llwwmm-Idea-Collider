import type { Critic } from '../types';
import { ShieldCheck } from 'lucide-react';
export function CriticPanel({ critic }: { critic: Critic }) {
  return (
    <section className="critic-panel">
      <div className="section-heading">
        <div className="eyebrow">
          <ShieldCheck size={16} /> CRITIC / 反向检验
        </div>
        <span className={`verdict ${critic.verdict === 'Promising' ? 'positive' : ''}`}>
          {critic.verdict}
        </span>
      </div>
      <p>{critic.explanation}</p>
      <div className="critic-columns">
        {[
          ['Major Problems', critic.majorProblems],
          ['Minor Problems', critic.minorProblems],
          ['Potential Fixes', critic.potentialFixes],
        ].map(([title, items]) => (
          <div key={title as string}>
            <h4>{title}</h4>
            <ul>
              {(items as string[]).map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <small>批评用于提出验证问题，不替代研究、工程评审或市场检索。</small>
    </section>
  );
}
