import { FileText, ArrowDownToLine, ArrowUpRight, Trash2 } from "lucide-react";
import { Document } from "../api";
export function DocumentCard({
  doc,
  view,
  tag,
  admin,
  remove,
}: {
  doc: Document;
  view: () => void;
  tag: (t: string) => void;
  admin: boolean;
  remove: () => void;
}) {
  return (
    <article className="document-card">
      <div className="card-top">
        <span className="file-icon">
          <FileText size={24} />
        </span>
        <span className="file-type">
          {doc.originalFilename.split(".").pop()?.toUpperCase()}
        </span>
        {admin && (
          <button className="delete" title="Удалить документ" onClick={remove}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <h3>{doc.title}</h3>
      <div className="tags">
        {doc.tags.map((t) => (
          <button key={t} onClick={() => tag(t)}>
            #{t}
          </button>
        ))}
      </div>
      <p className="metadata">
        {new Intl.DateTimeFormat("ru").format(new Date(doc.updatedAt))}
        <span>·</span>
        {doc.fileSize < 1048576
          ? `${Math.ceil(doc.fileSize / 1024)} КБ`
          : `${(doc.fileSize / 1048576).toFixed(1)} МБ`}
      </p>
      <footer>
        <button onClick={view}>
          Просмотреть
          <ArrowUpRight size={16} />
        </button>
        <a title="Скачать оригинал" href={`/api/documents/${doc.id}/download`}>
          <ArrowDownToLine size={18} />
        </a>
      </footer>
    </article>
  );
}
