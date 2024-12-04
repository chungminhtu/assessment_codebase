import {
  Controller,
  INestApplication,
  Module,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import {
  getRepositoryToken,
  InjectRepository,
  TypeOrmModule,
} from '@nestjs/typeorm';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { parse as json2csvParse } from 'json2csv';
import multer from 'multer';
import path from 'path';
import request from 'supertest';
import {
  Column,
  Connection,
  Entity,
  PrimaryGeneratedColumn,
  Repository,
} from 'typeorm';
import XLSX from 'xlsx';
describe('Import E2E', () => {
  @Entity()
  class MyEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    value: string;
  }

  @Controller('import')
  class ImportController {
    constructor(
      @InjectRepository(MyEntity)
      private readonly repository: Repository<MyEntity>,
      private readonly connection: Connection,
    ) {}

    @Post()
    @UseInterceptors(
      FileInterceptor('file', {
        storage: multer.memoryStorage(),
      }),
    )
    async importFile(@UploadedFile() file: Express.Multer.File) {
      const queryRunner = this.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const fileExtension = path.extname(file.originalname).toLowerCase();
        let records = [];

        if (fileExtension === '.xlsx') {
          const workbook = XLSX.read(file.buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          records = XLSX.utils.sheet_to_json(sheet);
        } else if (fileExtension === '.csv') {
          records = parse(file.buffer.toString(), { columns: true });
        }

        const batchSize = 5000;
        let batch = [];
        let totalInserted = 0;

        for (const record of records) {
          const { name, value } = record;
          if (!name || !value) {
            throw new Error('Invalid record found in the file');
          }
          batch.push(record);

          if (batch.length >= batchSize) {
            await queryRunner.manager.save(MyEntity, batch);
            totalInserted += batch.length;
            batch = [];
          }
        }

        if (batch.length) {
          await queryRunner.manager.save(MyEntity, batch);
          totalInserted += batch.length;
        }

        await queryRunner.commitTransaction();
        return { message: `${totalInserted} records imported successfully` };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error('Error importing file:', error);
        throw error;
      } finally {
        await queryRunner.release();
      }
    }
  }

  @Module({
    imports: [
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        dropSchema: true,
        synchronize: true,
        entities: [MyEntity],
      }),
      TypeOrmModule.forFeature([MyEntity]),
    ],
    controllers: [ImportController],
  })
  class ImportModule {}

  let app: INestApplication;
  let repository: Repository<MyEntity>;
  const xlsxFilePath = path.resolve(__dirname, 'data.xlsx');
  const csvFilePath = path.resolve(__dirname, 'data.csv');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ImportModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    repository = moduleFixture.get(getRepositoryToken(MyEntity));
    await app.init();
  });

  beforeEach(async () => {
    await repository.clear();
  });

  it('should import 100,000 records from XLSX', async () => {
    const data = Array.from({ length: 100000 }, (_, i) => ({
      name: `Item${i + 1}`,
      value: `Value${i + 1}`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, xlsxFilePath);

    await request(app.getHttpServer())
      .post('/import')
      .attach('file', xlsxFilePath)
      .expect(201);

    const count = await repository.count();
    expect(count).toBe(100000);

    if (fs.existsSync(xlsxFilePath)) {
      fs.unlinkSync(xlsxFilePath);
    }
  }, 360000);

  it('should import 100,000 records from CSV', async () => {
    const data = Array.from({ length: 100000 }, (_, i) => ({
      name: `Item${i + 1}`,
      value: `Value${i + 1}`,
    }));

    const csv = json2csvParse(data);
    fs.writeFileSync(csvFilePath, csv);

    await request(app.getHttpServer())
      .post('/import')
      .attach('file', csvFilePath)
      .expect(201);

    const count = await repository.count();
    expect(count).toBe(100000);

    if (fs.existsSync(csvFilePath)) {
      fs.unlinkSync(csvFilePath);
    }
  }, 360000);

  afterAll(async () => {
    await app.close();
  });
});
