import React from 'react';

// Minimal, safe formatter for Mini-Me replies. Supports **bold** and "- " / "* " / "1. " list lines. Builds React elements only, never HTML.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<strong key={`${keyPrefix}-b${i++}`} className="font-semibold">{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Models sometimes start a list on the same line as its intro ("board: - item").
// Move that first item onto its own line when more list lines follow.
function normalize(text: string): string {
  let t = text.replace(/\r\n/g, '\n');
  if (/\n\s*[-*]\s+/.test(t)) {
    t = t.replace(/:[ \t]+([-*])[ \t]+/, ':\n$1 ');
  }
  return t;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;

export const RichText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const lines = normalize(text || '').split('\n');
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`;
      blocks.push(
        <p key={k}>
          {para.map((line, idx) => (
            <React.Fragment key={`${k}-${idx}`}>
              {idx > 0 && <br />}
              {renderInline(line, `${k}-${idx}`)}
            </React.Fragment>
          ))}
        </p>
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const k = `l${blocks.length}`;
      const items = list.items.map((item, idx) => (
        <li key={`${k}-${idx}`}>{renderInline(item, `${k}-${idx}`)}</li>
      ));
      blocks.push(
        list.ordered ? (
          <ol key={k} className="list-decimal pl-5 space-y-1">{items}</ol>
        ) : (
          <ul key={k} className="list-disc pl-5 space-y-1">{items}</ul>
        )
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const bullet = raw.match(BULLET);
    const numbered = raw.match(NUMBERED);
    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      const item = numbered ? numbered[2] : bullet![1];
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item);
    } else if (raw.trim() === '') {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(raw);
    }
  }
  flushPara();
  flushList();

  return <div className={`space-y-2 ${className || ''}`}>{blocks}</div>;
};
