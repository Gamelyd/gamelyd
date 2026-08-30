import { type ReactNode } from "react";

/**
 * A small, safe Markdown renderer. It parses a limited subset into React
 * elements (never raw HTML, so there is no injection surface) covering what a
 * tournament briefing needs: headings, bold, italic, inline code, links, and
 * bullet / numbered lists. Anything it does not recognise is shown as plain
 * text, so a host can never break the page with odd input.
 */
export function Markdown({
  source,
  className = "",
}: {
  source: string;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>{parseBlocks(source ?? "")}</div>
  );
}

/** Only http(s) and internal links are allowed; everything else is dropped. */
function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/")) return u;
  return null;
}

const INLINE =
  /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g;

/** Bold, italic, inline code, and links within a run of text. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[1] !== undefined) {
      const url = safeUrl(match[2]);
      nodes.push(
        url ? (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary hover:underline"
          >
            {match[1]}
          </a>
        ) : (
          match[1]
        ),
      );
    } else if (match[3] !== undefined) {
      nodes.push(<strong key={key}>{match[3]}</strong>);
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key}>{match[4]}</em>);
    } else if (match[5] !== undefined) {
      nodes.push(<em key={key}>{match[5]}</em>);
    } else if (match[6] !== undefined) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em] text-white"
        >
          {match[6]}
        </code>,
      );
    }
    last = INLINE.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const HEADING = /^(#{1,3})\s+(.*)$/;
const UL_ITEM = /^\s*[-*]\s+/;
const OL_ITEM = /^\s*\d+\.\s+/;
const QUOTE = /^\s*>\s?/;

/** Split the source into block-level elements. */
function parseBlocks(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2], `h${key}`);
      const cls =
        level === 1
          ? "font-display text-xl text-white"
          : level === 2
            ? "font-display text-lg text-white"
            : "text-sm font-semibold uppercase tracking-wide text-white";
      out.push(
        <p key={key} className={cls}>
          {content}
        </p>,
      );
      key++;
      i++;
      continue;
    }

    if (UL_ITEM.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && UL_ITEM.test(lines[i])) {
        const text = lines[i].replace(UL_ITEM, "");
        items.push(
          <li key={items.length}>
            {renderInline(text, `ul${key}-${items.length}`)}
          </li>,
        );
        i++;
      }
      out.push(
        <ul
          key={key}
          className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-body"
        >
          {items}
        </ul>,
      );
      key++;
      continue;
    }

    if (OL_ITEM.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && OL_ITEM.test(lines[i])) {
        const text = lines[i].replace(OL_ITEM, "");
        items.push(
          <li key={items.length}>
            {renderInline(text, `ol${key}-${items.length}`)}
          </li>,
        );
        i++;
      }
      out.push(
        <ol
          key={key}
          className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-body"
        >
          {items}
        </ol>,
      );
      key++;
      continue;
    }

    if (QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        buf.push(lines[i].replace(QUOTE, ""));
        i++;
      }
      out.push(
        <blockquote
          key={key}
          className="border-l-2 border-primary/40 pl-3 text-sm italic text-body"
        >
          {renderInline(buf.join(" "), `bq${key}`)}
        </blockquote>,
      );
      key++;
      continue;
    }

    // Paragraph: collect until a blank line or a new block marker.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !HEADING.test(lines[i]) &&
      !UL_ITEM.test(lines[i]) &&
      !OL_ITEM.test(lines[i]) &&
      !QUOTE.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    const content: ReactNode[] = [];
    para.forEach((p, idx) => {
      if (idx > 0) content.push(<br key={`br-${idx}`} />);
      content.push(...renderInline(p, `p${key}-${idx}`));
    });
    out.push(
      <p key={key} className="text-sm leading-relaxed text-body">
        {content}
      </p>,
    );
    key++;
  }

  return out;
}
