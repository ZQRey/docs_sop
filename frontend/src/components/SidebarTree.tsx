import { useState } from "react";
import { ChevronRight, Folder, Plus, Pencil, Trash2 } from "lucide-react";
import { Category } from "../api";
type Props = {
  nodes: Category[];
  selected: string;
  select: (id: string) => void;
  admin: boolean;
  action: (mode: "create" | "rename" | "delete", category: Category) => void;
};
export function SidebarTree(props: Props) {
  return (
    <div>
      {props.nodes.map((node) => (
        <Branch key={node.id} {...props} node={node} />
      ))}
    </div>
  );
}
function Branch({ node, ...p }: Props & { node: Category }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div className={`tree-row ${p.selected === node.id ? "active" : ""}`}>
        <button
          className={`chevron ${open ? "open" : ""}`}
          aria-label={open ? "Свернуть" : "Развернуть"}
          onClick={() => setOpen(!open)}
          disabled={!node.children.length}
        >
          <ChevronRight size={14} />
        </button>
        <button className="tree-label" onClick={() => p.select(node.id)}>
          <Folder size={16} />
          <span>{node.name}</span>
          <small>{node.count}</small>
        </button>
      </div>
      {p.admin && (
        <div className="tree-actions">
          <button
            title="Добавить подпапку"
            onClick={() => p.action("create", node)}
          >
            <Plus size={13} />
          </button>
          <button
            title="Переименовать"
            onClick={() => p.action("rename", node)}
          >
            <Pencil size={13} />
          </button>
          <button
            title="Удалить категорию"
            onClick={() => p.action("delete", node)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
      <div className={`tree-children ${open ? "expanded" : ""}`}>
        <div>
          <SidebarTree {...p} nodes={node.children} />
        </div>
      </div>
    </div>
  );
}
