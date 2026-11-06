import { Elysia } from "elysia";
import { uploadRoute } from "./routes/upload";
import { getUploadRoute } from "./routes/get";

const app = new Elysia()
  .use(uploadRoute)
  .use(getUploadRoute)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
