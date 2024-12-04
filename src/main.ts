import {
  INestApplication,
  NestApplicationOptions,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import { AppModule } from './app.module';
import { getDbConfig } from './orm.config';

export const viteNodeApp = NestFactory.create(AppModule);

export async function createApp(
  options?: NestApplicationOptions,
): Promise<INestApplication> {
  const app = await viteNodeApp;
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      validationError: {
        target: false,
      },
    }),
  );
  console.log(` 🚀 Server ready at: http://localhost:3000`);
  return app;
}

async function main() {
  const app = await createApp();
  await app.listen(3000, () => {});
  await setupDB(app);
}

main();
async function setupDB(app: INestApplication) {
  const configService = app.get(ConfigService);
  const dbConfig = getDbConfig(configService);
  const dataSource = new DataSource(dbConfig);
  await dataSource.initialize();
  await runSeeders(dataSource);
}
