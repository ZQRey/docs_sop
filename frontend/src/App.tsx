import { useEffect, useState } from "react";
import {
  BookOpen,
  Search,
  Plus,
  LogOut,
  ShieldCheck,
  FolderOpen,
  LockKeyhole,
} from "lucide-react";
import { Admin, Category, Document, api, errorMessage } from "./api";
import { useDebounce } from "./hooks/useDebounce";
import { SidebarTree } from "./components/SidebarTree";
import { DocumentCard } from "./components/DocumentCard";
import { AdminModal } from "./components/AdminModal";
import { UploadModal } from "./components/UploadModal";
import { DocViewerModal } from "./components/DocViewerModal";
export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [login, setLogin] = useState(false);
  const [upload, setUpload] = useState(false);
  const [file, setFile] = useState<File>();
  const [view, setView] = useState<Document>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const query = useDebounce(search);
  const refresh = () => setRevision((r) => r + 1);
  useEffect(() => {
    api
      .get<Admin>("/auth/me")
      .then((r) => setAdmin(r.data))
      .catch(() => {});
  }, []);
  useEffect(() => {
    let live = true;
    api
      .get<Category[]>("/categories/tree")
      .then((r) => {
        if (live) setCategories(r.data);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [revision]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .get<Document[]>("/documents", {
        params: {
          categoryId: selected || undefined,
          search: query || undefined,
          tag: tag || undefined,
        },
        signal: controller.signal,
      })
      .then((r) => setDocs(r.data))
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selected, query, tag, revision]);
  function findPath(nodes: Category[], id: string): Category[] {
    for (const n of nodes) {
      if (n.id === id) return [n];
      const child = findPath(n.children, id);
      if (child.length) return [n, ...child];
    }
    return [];
  }
  const breadcrumbs = findPath(categories, selected);
  const current = breadcrumbs.at(-1);
  const popular = [...new Set(docs.flatMap((d) => d.tags))].slice(0, 8);
  async function categoryAction(
    mode: "create" | "rename" | "delete",
    category?: Category,
  ) {
    try {
      if (mode === "delete") {
        if (
          !confirm(
            `Удалить «${category?.name}» и все вложенные документы без возможности восстановления?`,
          )
        )
          return;
        await api.delete(`/categories/${category!.id}`);
        setSelected("");
      } else {
        const name = prompt(
          mode === "rename" ? "Новое название папки" : "Название новой папки",
          mode === "rename" ? category?.name : "",
        );
        if (!name?.trim()) return;
        if (mode === "rename")
          await api.patch(`/categories/${category!.id}`, { name });
        else await api.post("/categories", { name, parentId: category?.id });
      }
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function remove(doc: Document) {
    if (!confirm(`Удалить документ «${doc.title}»?`)) return;
    try {
      await api.delete(`/documents/${doc.id}`);
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <div className="app">
      <aside>
        <a className="brand" href="/">
          <span>
            <BookOpen size={23} />
          </span>
          <div>
            Регламент<span>БИБЛИОТЕКА ДОКУМЕНТОВ</span>
          </div>
        </a>
        <p className="nav-caption">КАТАЛОГ</p>
        <button
          className={`all-docs ${!selected ? "active" : ""}`}
          onClick={() => setSelected("")}
        >
          <BookOpen size={17} />
          Все документы
          <span>{categories.reduce((n, c) => n + c.count, 0)}</span>
        </button>
        <SidebarTree
          nodes={categories}
          selected={selected}
          select={setSelected}
          admin={!!admin}
          action={categoryAction}
        />
        {admin && (
          <button
            className="add-folder"
            onClick={() => categoryAction("create")}
          >
            <Plus size={15} />
            Добавить раздел
          </button>
        )}
        <div className="sidebar-bottom">
          <p>
            Единая база знаний
            <br />
            <span>Актуальные документы под рукой</span>
          </p>
          {admin ? (
            <span>
              <ShieldCheck size={15} /> {admin.username}
            </span>
          ) : (
            <button onClick={() => setLogin(true)}>
              <LockKeyhole size={14} />
              Вход для администратора
            </button>
          )}
        </div>
      </aside>
      <main>
        {admin && (
          <div className="admin-banner">
            <span>
              <ShieldCheck size={16} />
              Режим редактирования
            </span>
            <button
              onClick={async () => {
                try {
                  await api.post("/auth/logout");
                  setAdmin(null);
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              <LogOut size={15} />
              Выйти
            </button>
          </div>
        )}
        <div className="topbar">
          <span>База знаний организации</span>
          <span className="status-dot">Общий доступ</span>
        </div>
        <section className="content">
          <div className="breadcrumbs">
            <button onClick={() => setSelected("")}>Библиотека</button>
            {breadcrumbs.map((c) => (
              <span key={c.id}>
                {" "}
                / <button onClick={() => setSelected(c.id)}>{c.name}</button>
              </span>
            ))}
          </div>
          <div className="heading">
            <div>
              <p className="eyebrow">ДОКУМЕНТЫ И СТАНДАРТЫ</p>
              <h1>{current?.name || "Библиотека регламентов"}</h1>
              <p>СОП, нормативные акты и приказы — в одном месте.</p>
            </div>
            {admin && (
              <button
                className="primary"
                disabled={!categories.length}
                onClick={() => {
                  setFile(undefined);
                  setUpload(true);
                }}
              >
                <Plus size={18} />
                Добавить документ
              </button>
            )}
          </div>
          <div className="search-box">
            <Search size={20} />
            <input
              aria-label="Поиск документов"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Найти документ по названию…"
            />
            {search && <button onClick={() => setSearch("")}>Очистить</button>}
          </div>
          <div className="filter-tags">
            <span>Теги:</span>
            <button className={!tag ? "chosen" : ""} onClick={() => setTag("")}>
              Все
            </button>
            {[...new Set([...popular, ...(tag ? [tag] : [])])].map((t) => (
              <button
                key={t}
                className={tag === t ? "chosen" : ""}
                onClick={() => setTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {admin && current && (
            <div
              className="drop-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) {
                  setFile(e.dataTransfer.files[0]);
                  setUpload(true);
                }
              }}
            >
              <Plus size={18} />
              Перетащите документ сюда, чтобы добавить в «{current.name}»
            </div>
          )}
          <div className="results-heading">
            <h2>
              {search || tag ? "Результаты поиска" : "Документы"}
              <span>{docs.length}</span>
            </h2>
            <span>По дате обновления</span>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={refresh}>Повторить</button>
            </div>
          )}
          {loading ? (
            <div className="empty">Загрузка документов…</div>
          ) : docs.length ? (
            <div className="grid">
              {docs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  admin={!!admin}
                  remove={() => remove(doc)}
                  view={() => setView(doc)}
                  tag={setTag}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <FolderOpen size={42} />
              <h3>
                {search || tag
                  ? "Документы не найдены"
                  : "Здесь пока нет документов"}
              </h3>
              <p>
                {search || tag
                  ? "Попробуйте другое название или тег."
                  : admin
                    ? "Добавьте первый документ в библиотеку."
                    : "Документы появятся после загрузки администратором."}
              </p>
            </div>
          )}
          <p className="catalog-note">
            Показано до 500 документов. Для уточнения используйте папку и поиск.
          </p>
        </section>
      </main>
      {login && (
        <AdminModal
          close={() => setLogin(false)}
          success={(a) => {
            setAdmin(a);
            setLogin(false);
          }}
        />
      )}
      {upload && (
        <UploadModal
          categories={categories}
          categoryId={selected || categories[0]?.id}
          initialFile={file}
          close={() => setUpload(false)}
          success={() => {
            setUpload(false);
            refresh();
          }}
        />
      )}
      {view && <DocViewerModal doc={view} close={() => setView(undefined)} />}
    </div>
  );
}
