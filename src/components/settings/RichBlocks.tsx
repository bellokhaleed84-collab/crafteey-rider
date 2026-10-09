import type { Block } from "@/lib/richText";

export default function RichBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-2">
      {blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i} className="text-xs leading-relaxed text-steel">
            {b.text}
          </p>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-steel">
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}