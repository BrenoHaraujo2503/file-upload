import { randomUUIDv7 } from "bun";
import Elysia, { t } from "elysia";
import { r2 } from "../lib/cloudflare";
import { db } from "../database/client";
import { file } from "../database/schema/file";

const ALLOWED_FILES_TYPES = ["application/pdf", "image/png", "image/jpeg", "video/mp4"];

export const uploadRoute = new Elysia().post(
  "/upload",
  async ({ body, status }) => {
    const { contentType, name } = body;

    if (!ALLOWED_FILES_TYPES.includes(contentType)) {
      return status(400, "Tipo de arquivo não suportado");
    }

    // Evita barras/espaços/caracteres estranhos na chave do objeto
    const safeName = name.replace(/[^\w.\-]+/g, "_");
    const key = `${randomUUIDv7()}-${safeName}`;

    const signedUrl = r2.file(key).presign({
      method: "PUT",
      type: contentType, // o front precisa enviar o mesmo Content-Type
      expiresIn: 600, // segundos
    });

    const [created] = await db
      .insert(file)
      .values({ key, name, contentType })
      .returning({ id: file.id });

    // O front usa o `id` para montar o link de visualização (upload.breno/<id>)
    return { id: created.id, signedUrl };
  },
  {
    body: t.Object({
      name: t.String(),
      contentType: t.String(),
    }),
  }
);
