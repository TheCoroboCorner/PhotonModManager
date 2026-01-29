import express from 'express';
import { config } from './config.js';
import { cookieMiddleware, securityHeadersMiddleware } from './middleware.js';

import mainRoutes from './routes/main.js';
import submitRoutes from './routes/submit.js';
import favouriteRoutes from './routes/favourite.js';
import wikiRoutes from './routes/wiki.js';
import modpackRoutes from './routes/modpack.js';
import analyticsRoutes from './routes/analytics.js';
import apiRoutes from './routes/api.js';
import imageUploadRouter from './routes/imageUpload.js';

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(config.paths.public));
app.use('/wiki-data', express.static(config.paths.wikiData, { maxAge: '1d', immutable: true }));

app.use(cookieMiddleware);
app.use(securityHeadersMiddleware);

app.use('/', mainRoutes);
app.use('/', submitRoutes);
app.use('/', favouriteRoutes);
app.use('/', wikiRoutes);
app.use('/', modpackRoutes);
app.use('/', analyticsRoutes);
app.use('/', apiRoutes);
app.use('/', imageUploadRouter)

app.listen(config.port, () => console.log(`Listening on port ${config.port}`));

export default app;