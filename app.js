import express from "express";
import 'express-async-errors'
import 'dotenv/config'

import usersRouter from "./routes/users.js";
import indexRouter from "./routes/index.js";
import logger from "morgan";
import cookieParser from "cookie-parser";
import path from "node:path";

var app = express();

const __dirname = import.meta.dirname;

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

export default app;
