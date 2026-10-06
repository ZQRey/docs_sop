import { FormEvent, useState } from "react";
import { Admin, api, errorMessage } from "../api";
import { Modal } from "./Modal";
export function AdminModal({
  close,
  success,
}: {
  close: () => void;
  success: (admin: Admin) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      success(
        (
          await api.post<Admin>("/auth/login", {
            username: form.get("username"),
            password: form.get("password"),
          })
        ).data,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Вход для администратора" close={close}>
      <form onSubmit={submit}>
        <p>Управляйте папками и документами библиотеки.</p>
        <label>
          Логин
          <input name="username" autoComplete="username" required autoFocus />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Вход…" : "Войти"}
        </button>
      </form>
    </Modal>
  );
}
