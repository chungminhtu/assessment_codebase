/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConfigService } from '@nestjs/config';
import dotenv from 'dotenv';
import { DataSource, DeepPartial, EntityTarget, ObjectLiteral } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { Product } from './modules/product/entities/product.entity';
import CreateProducts from './modules/product/seed/product.seed';
dotenv.config({ path: '.env' });

export const getDbConfig = (configService: ConfigService) => {
  return {
    type: 'sqlite',
    database: ":memory:",
    entities: [Product],
    seeds: [CreateProducts],
    dropSchema: true,
    synchronize: true,
    migrationsRun: false,
    logging: [],
    migrations: [],
    maxQueryExecutionTime: 10000, // 10 seconds,
    namingStrategy: new SnakeNamingStrategy(),
  } as any;
};
export default async function insertDataWithPrimaryKeyId(
  datas: any[],
  dataSource: DataSource,
  entity: EntityTarget<ObjectLiteral>,
) {
  const repo = dataSource.getRepository(entity);
  await repo.save(
    datas.map((data: DeepPartial<ObjectLiteral>[]) => repo.create(data)),
  );
  console.warn(
    '    Seeded ' +
    datas?.length +
    ' records to table: ' +
    repo.metadata.tableName,
  );
}
