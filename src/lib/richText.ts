export type Block = { type: "p"; text: string } | { type: "ul"; items: string[] };
export interface RichSection {
  title: string;
  blocks: Block[];
}

// "# Heading" starts a section. A blank line ends a paragraph. "- item" lines make a bullet list.
export function parseSections(body: string): RichSection[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const sections: RichSection[] = [];
  let cur: RichSection = { title: "", blocks: [] };
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) {
      cur.blocks.push({ type: "p", text: para.join(" ") });
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      cur.blocks.push({ type: "ul", items: list });
      list = [];
    }
  };
  const pushCur = () => {
    flushPara();
    flushList();
    if (cur.title || cur.blocks.length) sections.push(cur);
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("# ")) {
      pushCur();
      cur = { title: line.slice(2).trim(), blocks: [] };
      continue;
    }
    if (line === "") {
      flushPara();
      flushList();
      continue;
    }
    if (line.startsWith("- ")) {
      flushPara();
      list.push(line.slice(2).trim());
      continue;
    }
    flushList();
    para.push(line);
  }
  pushCur();
  return sections;
}