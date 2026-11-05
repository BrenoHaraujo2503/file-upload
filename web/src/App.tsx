import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from "react";

type UploadFile = {
  id: string;
  file: File;
  error?: string;
  progress: number; // 0–100
  uploading: boolean;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const valid = files.filter((item) => !item.error);
  const isUploading = valid.some((item) => item.uploading);
  const allDone = valid.length > 0 && valid.every((item) => item.progress >= 100);

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

  // Envio SIMULADO. Para envio real, troque este efeito por um XMLHttpRequest
  // e atualize `progress` em `xhr.upload.onprogress` (loaded / total * 100).
  useEffect(() => {
    if (!isUploading) return;

    const timer = window.setInterval(() => {
      setFiles((current) =>
        current.map((item) => {
          if (!item.uploading) return item;
          const step = 100 / (6 + (item.file.size / 1024 / 1024) * 8);
          const progress = Math.min(100, item.progress + step * (0.7 + Math.random() * 0.6));
          return { ...item, progress, uploading: progress < 100 };
        })
      );
    }, 250);

    return () => window.clearInterval(timer);
  }, [isUploading]);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;

    const selected = Array.from(fileList).map((file): UploadFile => {
      let error: string | undefined;

      if (!ACCEPTED_TYPES.includes(file.type)) error = "Formato não suportado";
      else if (file.size === 0) error = "O arquivo está vazio";
      else if (file.size > MAX_FILE_SIZE) error = "O arquivo excede 10 MB";

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
    setFiles((current) => current.filter((item) => item.id !== id));
  }

  function startUpload() {
    setFiles((current) =>
      current.map((item) =>
        item.error || item.progress >= 100 ? item : { ...item, uploading: true }
      )
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-950 px-5 py-10 font-sans text-zinc-100">
      <section className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Enviar arquivos
        </h1>
        <p className="mt-1 text-sm text-zinc-500">PDF, PNG ou JPG · até 10 MB</p>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`mt-6 rounded-2xl border border-dashed px-6 py-10 text-center transition ${
            isDragging
              ? "border-blue-400 bg-blue-500/10"
              : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-500"
          }`}
        >
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            multiple
            onChange={handleInputChange}
          />

          <p className="text-sm text-zinc-300">Arraste arquivos para cá ou</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            Escolher arquivos
          </button>
        </div>

        {files.length > 0 && (
          <>
            <ul className="mt-6 divide-y divide-white/5">
              {files.map(({ id, file, error, progress, uploading }) => {
                const pct = Math.floor(progress);
                const done = progress >= 100;

                return (
                  <li key={id} className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zinc-200">{file.name}</p>
                        <p
                          className={`mt-0.5 text-xs ${
                            error ? "text-red-400" : "text-zinc-500"
                          }`}
                        >
                          {error || formatFileSize(file.size)}
                        </p>
                      </div>

                      {!error && (uploading || done) && (
                        <span
                          className={`font-mono text-xs tabular-nums ${
                            done ? "text-emerald-400" : "text-zinc-400"
                          }`}
                        >
                          {done ? "100%" : `${pct}%`}
                        </span>
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
                  : `Enviar ${valid.length} ${valid.length === 1 ? "arquivo" : "arquivos"}`}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
