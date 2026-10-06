import axios from "axios";
export const api = axios.create({ baseURL: "/api", withCredentials: true });
export type Category = {
  id: string;
  name: string;
  parentId: string | null;
  count: number;
  children: Category[];
};
export type Document = {
  id: string;
  categoryId: string;
  title: string;
  tags: string[];
  fileSize: number;
  originalFilename: string;
  updatedAt: string;
};
export type Admin = { id: string; username: string };
export function errorMessage(e: unknown) {
  return axios.isAxiosError(e)
    ? e.response?.data?.error || "Не удалось связаться с сервером"
    : e instanceof Error
      ? e.message
      : "Ошибка";
}
