import { useEffect, useState } from "react";

type UploadInfo = {
  name: string;
  contentType: string;
  signedUrl: string;
};

type Status = "loading" | "ready" | "notfound" | "error";

export function Viewer({ id, apiUrl }: { id: string; apiUrl: string }) {
  const [data, setData] = useState<UploadInfo | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");

    fetch(`${apiUrl}/uploads/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 404) return setStatus("notfound");
        if (!res.ok) throw new Error("request failed");
        setData(await res.json());
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setStatus("error");
      });

    return () => controller.abort();
  }, [id, apiUrl]);

  if (status !== "ready" || !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-5 font-sans text-zinc-400">
        <p className="text-sm">
          {status === "loading" && "Carregando…"}
          {status === "notfound" && "Arquivo não encontrado."}
          {status === "error" && "Não foi possível carregar o arquivo."}
        </p>
      </main>
    );
  }

  const { name, contentType, signedUrl } = data;

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8 font-sans text-zinc-100">
      <section className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="truncate text-lg font-medium text-white">{name}</h1>
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            Abrir original
          </a>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50">
          {contentType.startsWith("image/") ? (
            <img
              src={signedUrl}
              alt={name}
              className="mx-auto max-h-[80vh] w-auto object-contain"
            />
          ) : contentType.startsWith("video/") ? (
            <video
              src={signedUrl}
              controls
              className="mx-auto max-h-[80vh] w-full bg-black"
            />
          ) : contentType === "application/pdf" ? (
            <iframe
              src={signedUrl}
              title={name}
              className="h-[80vh] w-full bg-white"
            />
          ) : (
            <p className="p-10 text-center text-sm text-zinc-400">
              Não é possível visualizar este tipo de arquivo aqui.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
