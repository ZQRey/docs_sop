import { Document } from "../api";
import { Modal } from "./Modal";
export function DocViewerModal({
  doc,
  close,
}: {
  doc: Document;
  close: () => void;
}) {
  return (
    <Modal title={doc.title} close={close} wide>
      <iframe title={doc.title} src={`/api/documents/${doc.id}/preview`} />
      <a className="download-link" href={`/api/documents/${doc.id}/download`}>
        Скачать оригинал
      </a>
    </Modal>
  );
}
