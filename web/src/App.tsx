import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from "react";
import { Viewer } from "./components/Viewer";

type UploadFile = {
  id: string;
  file: File;
  error?: string;
  failed?: boolean;
  progress: number;
  uploading: boolean;
  url?: string;
};

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3333";
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "video/mp4"];

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function App() {
  const match = window.location.pathname.match(/^\/([^/]+)\/?$/);
  if (match) return <Viewer id={decodeURIComponent(match[1])} apiUrl={API_URL} />;
  return <Uploader />;
}

function Uploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrs = useRef<Map<string, XMLHttpRequest>>(new Map());
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const valid = files.filter((item) => !item.error);
  const pending = valid.filter((item) => item.progress < 100);
  const isUploading = valid.some((item) => item.uploading);
  const hasFailed = valid.some((item) => item.failed);
  const allDone = valid.length > 0 && pending.length === 0;

  const totalBytes = valid.reduce((sum, item) => sum + item.file.size, 0);
  const loadedBytes = valid.reduce(
    (sum, item) => sum + (item.file.size * item.progress) / 100,
    0
  );
  const percent = allDone
    ? 100
    : totalBytes === 0
      ? 0
      : Math.min(99, Math.floor((loadedBytes / totalBytes) * 100));

  // Cancela envios em andamento ao sair da página
  useEffect(() => {
    const active = xhrs.current;
    return () => active.forEach((xhr) => xhr.abort());
  }, []);

  function patch(id: string, changes: Partial<UploadFile>) {
    setFiles((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item))
    );
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;

    const selected = Array.from(fileList).map((file): UploadFile => {
      let error: string | undefined;

      if (!ACCEPTED_TYPES.includes(file.type)) error = "Formato não suportado";
      else if (file.size === 0) error = "O arquivo está vazio";
      else if (file.size > MAX_FILE_SIZE)
        error = `O arquivo excede ${MAX_FILE_SIZE / 1024 / 1024} MB`;

      return {
        id: crypto.randomUUID(),
        file,
        error,
        progress: 0,
        uploading: false,
      };
    });

    setFiles((current) => [...current, ...selected]);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function removeFile(id: string) {
    xhrs.current.get(id)?.abort();
    setFiles((current) => current.filter((item) => item.id !== id));
  }

  async function sendFile(item: UploadFile) {
    patch(item.id, { uploading: true, failed: false, progress: 0 });

    try {
      // 1) pede a URL assinada e o id do upload ao backend
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.file.name,
          contentType: item.file.type,
        }),
      });
      if (!res.ok) throw new Error("Falha ao criar o upload");

      const { id: uploadId, signedUrl } = (await res.json()) as {
        id: string;
        signedUrl: string;
      };

      // 2) envia o arquivo direto para o R2, acompanhando o progresso
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrs.current.set(item.id, xhr);

        xhr.open("PUT", signedUrl);
        // precisa ser o mesmo `type` usado ao assinar a URL
        xhr.setRequestHeader("Content-Type", item.file.type);

        let last;
        xhr.upload.onprogress = (event) => {
          const now = performance.now();
          if (!event.lengthComputable || now - last < 100) return;
          last = now;
          patch(item.id, {
            progress: Math.min(99, (event.loaded / event.total) * 100),
          });
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`R2 respondeu ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Erro de rede"));
        xhr.onabort = () => reject(new Error("Cancelado"));

        xhr.send(item.file);
      });

      // 3) concluído: o link é a página de visualização, não a URL assinada
      patch(item.id, {
        progress: 100,
        uploading: false,
        url: `${window.location.origin}/${uploadId}`,
      });
    } catch {
      patch(item.id, { uploading: false, failed: true, progress: 0 });
    } finally {
      xhrs.current.delete(item.id);
    }
  }

  function startUpload() {
    pending.filter((item) => !item.uploading).forEach(sendFile);
  }

  async function copyLink(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback para contextos sem Clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopiedId(id);
    window.setTimeout(() => {
      setCopiedId((current) => (current === id ? null : current));
    }, 2000);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-950 px-5 py-10 font-sans text-zinc-100">
      <section className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Enviar arquivos
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          PDF, PNG, JPG ou MP4 · até {MAX_FILE_SIZE / 1024 / 1024} MB
        </p>

        <div
          role="button"
          tabIndex={0}
          aria-label="Selecionar arquivos"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`mt-6 cursor-pointer rounded-2xl border border-dashed px-6 py-12 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            isDragging
              ? "border-blue-400 bg-blue-500/10"
              : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-500"
          }`}
        >
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.mp4"
            multiple
            onChange={handleInputChange}
          />

          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="mx-auto h-8 w-8 text-zinc-500"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" />
          </svg>
          <p className="mt-3 text-sm text-zinc-300">
            {isDragging ? "Solte para adicionar" : "Clique ou arraste arquivos para cá"}
          </p>
        </div>

        {files.length > 0 && (
          <>
            <ul className="mt-6 divide-y divide-white/5">
              {files.map(({ id, file, error, failed, progress, uploading, url }) => {
                const pct = Math.floor(progress);
                const done = progress >= 100;

                return (
                  <li key={id} className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zinc-200">{file.name}</p>
                        <p
                          className={`mt-0.5 text-xs ${
                            error || failed ? "text-red-400" : "text-zinc-500"
                          }`}
                        >
                          {error || (failed ? "Falha no envio" : formatFileSize(file.size))}
                        </p>
                      </div>

                      {!error && uploading && (
                        <span className="font-mono text-xs tabular-nums text-zinc-400">
                          {pct}%
                        </span>
                      )}

                      {!error && done && url && (
                        <button
                          type="button"
                          onClick={() => copyLink(id, url)}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                            copiedId === id
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {copiedId === id ? (
                            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m5 12.5 4.5 4.5L19 7.5" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="11" height="11" rx="2" />
                              <path d="M5 15V6a2 2 0 0 1 2-2h9" />
                            </svg>
                          )}
                          {copiedId === id ? "Copiado!" : "Copiar link"}
                        </button>
                      )}

                      <button
                        type="button"
                        aria-label={`Remover ${file.name}`}
                        onClick={() => removeFile(id)}
                        className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-4 w-4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="m6 6 12 12M18 6 6 18" />
                        </svg>
                      </button>
                    </div>

                    {!error && (uploading || done) && (
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={done ? 100 : pct}
                        className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"
                      >
                        <div
                          className={`h-full rounded-full transition-[width] duration-300 ${
                            done ? "bg-emerald-400" : "bg-blue-500"
                          }`}
                          style={{ width: `${done ? 100 : progress}%` }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              disabled={valid.length === 0 || isUploading || allDone}
              onClick={startUpload}
              className="relative mt-4 w-full overflow-hidden rounded-xl bg-blue-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-400"
            >
              {allDone
                ? "Envio concluído"
                : isUploading
                  ? `Enviando… ${percent}%`
                  : hasFailed
                    ? "Tentar novamente"
                    : `Enviar ${pending.length} ${pending.length === 1 ? "arquivo" : "arquivos"}`}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
