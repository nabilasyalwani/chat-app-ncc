import { Application, Context, Router } from "@oak/oak";
import ChatServer from "./ChatServer.ts";

const app = new Application();
const port = 8080;
const router = new Router();
const server = new ChatServer();

router.get("/start_web_socket", (ctx: Context) => server.handleConnection(ctx));

app.use(router.routes());
app.use(router.allowedMethods());

// app.use(async (context) => {
//   await context.send({
//     root: Deno.cwd(),
//     index: "index.html",
//   });
// });

app.use(async (ctx, next) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  ctx.response.headers.set("Access-Control-Allow-Headers", "*");
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  await next();
});

console.log("Listening at http://localhost:" + port);
await app.listen({ hostname: "0.0.0.0", port });
