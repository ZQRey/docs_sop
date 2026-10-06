import { FormEvent, useState } from "react";
import { Category, api, errorMessage } from "../api";
import { Modal } from "./Modal";
export function UploadModal({
  categories,
  categoryId,
  initialFile,
  close,
  success,
}: {
  categories: Category[];
  categoryId: string;
  initialFile?: File;
  close: () => void;
  success: () => void;
}) {
  const [file, setFile] = useState(initialFile);
  const [title, setTitle] = useState(
    initialFile?.name.replace(/\.[^.]+$/, "") || "",
  );
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const flatten = (
    nodes: Category[],
    prefix = "",
  ): { id: string; name: string }[] =>
    nodes.flatMap((n) => [
      { id: n.id, name: prefix + n.name },
      ...flatten(n.children, prefix + n.name + " / "),
    ]);
  function choose(f?: File) {
    setFile(f);
    if (f) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Выберите файл");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("Максимальный размер — 100 МБ");
      return;
    }
    const data = new FormData(e.currentTarget);
    data.set("file", file);
    data.set("title", title);
    data.set("tags", tags);
    setBusy(true);
    setError("");
    try {
      await api.post("/documents", data, {
        onUploadProgress: (p) =>
          setProgress(Math.round((p.progress || 0) * 100)),
        timeout: 180000,
      });
      success();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Добавить документ"
      close={() => {
        if (!busy) close();
      }}
    >
      <form onSubmit={submit}>
        <label>
          Папка
          <select name="categoryId" defaultValue={categoryId} required>
            {flatten(categories).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label
          className="file-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            choose(e.dataTransfer.files[0]);
          }}
        >
          PDF, DOC или DOCX · до 100 МБ
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => choose(e.target.files?.[0])}
          />
          {file?.name}
        </label>
        <label>
          Название
          <input
            value={title}
            maxLength={300}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label>
          Теги через запятую
          <input
            value={tags}
            maxLength={1000}
            onChange={(e) => setTags(e.target.value)}
            placeholder="безопасность, инструкция"
          />
        </label>
        <div className="tags">
          {tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t, i) => (
              <span key={i}>#{t}</span>
            ))}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? progress < 100
              ? `Загрузка ${progress}%`
              : "Конвертация и сохранение…"
            : "Загрузить документ"}
        </button>
      </form>
    </Modal>
  );
}
