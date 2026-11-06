import Elysia, { t } from "elysia";
import { eq } from "drizzle-orm";
import { r2 } from "../lib/cloudflare";
import { db } from "../database/client";
import { file } from "../database/schema/file";

export const getUploadRoute = new Elysia().get(
  "/uploads/:id",
  async ({ params, status }) => {
    const [returnedFile] = await db
      .select()
      .from(file)
      .where(eq(file.id, params.id))
      .limit(1);

    if (!returnedFile?.key) {
      return status(404, "Not Found");
    }

    const signedUrl = r2.file(returnedFile.key).presign({
      expiresIn: 3600,
    });

    return {
      name: returnedFile.name,
      contentType: returnedFile.contentType,
      signedUrl,
    };
  },
  {
    params: t.Object({
      id: t.String(),
    }),
  }
);
