import path from "node:path";
import http from "node:http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { StatusCodes } from "http-status-codes";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { roomsRouter } from "./routes/rooms.js";
import { messagesRouter } from "./routes/messages.js";
import { usersRouter } from "./routes/users.js";
import { directsRouter } from "./routes/directs.js";
import { uploadsRouter } from "./routes/uploads.js";
import { createSocketServer } from "./socket.js";

const app = express();
app.set("trust proxy", 1);

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.use("/auth", authRouter);
app.use("/rooms", roomsRouter);
app.use("/messages", messagesRouter);
app.use("/users", usersRouter);
app.use("/directs", directsRouter);
app.use("/uploads", uploadsRouter);

app.use((_request, response) => {
  response.status(StatusCodes.NOT_FOUND).json({
    message: "Route not found."
  });
});

const server = http.createServer(app);
createSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`server listening on http://localhost:${env.PORT}`);
});
