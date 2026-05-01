function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizeHref(rawHref) {
  const value = (rawHref || "").trim();
  if (!value) return null;
  if (value.startsWith("www.")) return `https://${value}`;
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:")
  ) {
    return value;
  }
  return null;
}

function renderInline(text) {
  const source = String(text || "");
  const pattern =
    /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)|((?:https?:\/\/|www\.)[^\s<]+))/g;
  const nodes = [];
  let lastIndex = 0;
  let matchIndex = 0;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(source.slice(lastIndex, match.index));
    }

    if (match[2]) {
      nodes.push(<strong key={`rt-bold-${matchIndex}`}>{renderInline(match[2])}</strong>);
    } else if (match[3]) {
      nodes.push(<em key={`rt-italic-${matchIndex}`}>{renderInline(match[3])}</em>);
    } else if (match[4] && match[5]) {
      const href = normalizeHref(match[5]);
      nodes.push(
        href ? (
          <a
            key={`rt-link-${matchIndex}`}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-[#6B7A52] underline decoration-[#B9C7A2] underline-offset-2 transition hover:text-[#53613E]"
          >
            {match[4]}
          </a>
        ) : (
          match[0]
        )
      );
    } else if (match[6]) {
      const href = normalizeHref(match[6]);
      nodes.push(
        href ? (
          <a
            key={`rt-url-${matchIndex}`}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-[#6B7A52] underline decoration-[#B9C7A2] underline-offset-2 transition hover:text-[#53613E]"
          >
            {match[6]}
          </a>
        ) : (
          match[0]
        )
      );
    }

    lastIndex = pattern.lastIndex;
    matchIndex += 1;
  }

  if (lastIndex < source.length) {
    nodes.push(source.slice(lastIndex));
  }

  return nodes;
}

function parseBlocks(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ").trim() });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ type: "list", items: [...listItems] });
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1]);
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}

export default function RichText({
  text,
  className = "",
  paragraphClassName = "",
  listClassName = "",
}) {
  const blocks = parseBlocks(text);

  if (!blocks.length) return null;

  return (
    <div className={cn("space-y-3 break-words", className)}>
      {blocks.map((block, index) =>
        block.type === "list" ? (
          <ul
            key={`rt-block-${index}`}
            className={cn("list-disc space-y-1 pl-5", listClassName)}
          >
            {block.items.map((item, itemIndex) => (
              <li key={`rt-item-${index}-${itemIndex}`}>{renderInline(item)}</li>
            ))}
          </ul>
        ) : (
          <p
            key={`rt-block-${index}`}
            className={cn("whitespace-pre-wrap", paragraphClassName)}
          >
            {renderInline(block.text)}
          </p>
        )
      )}
    </div>
  );
}
