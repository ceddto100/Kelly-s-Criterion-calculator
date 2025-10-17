import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import connectDB from './config/db';
import apiRouter from './routes/api';
import errorHandler, { notFoundHandler } from './middleware/errorHandler';

dotenv.config();

const PORT = process.env.PORT || 5000;

const bootstrap = async () => {
  await connectDB();

  const app = express();

  const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim());
  app.use(
    cors({
      origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : '*',
      credentials: true,
    })
  );

  app.use(helmet());
  app.use(morgan('combined'));
  app.use(express.json());

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
};

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
