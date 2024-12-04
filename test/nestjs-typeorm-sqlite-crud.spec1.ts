import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  INestApplication,
  InternalServerErrorException,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { Column, Entity, PrimaryGeneratedColumn, Repository } from 'typeorm';

describe('nestjs-typeorm-sqlite-crud.spec e2e', () => {
  @Entity()
  class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    email: string;

    @Column({ nullable: true })
    createDate: Date;
  }

  @Controller('users')
  class UserController {
    constructor(
      @InjectRepository(User)
      private userRepository: Repository<User>,
    ) {}

    @Get()
    async findAll(): Promise<User[]> {
      return this.userRepository.find();
    }

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<User> {
      if (isNaN(Number(id))) {
        throw new BadRequestException('Invalid ID');
      }
      const user = await this.userRepository.findOne({
        where: { id: parseInt(id) },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    }

    @Post()
    async create(@Body() userData: Partial<User>): Promise<User> {
      if (!userData.name || !userData.email) {
        throw new BadRequestException('Name and email are required');
      }
      const newUser = this.userRepository.create(userData);
      return this.userRepository.save(newUser);
    }

    @Put(':id')
    async update(
      @Param('id') id: string,
      @Body() userData: Partial<User>,
    ): Promise<User> {
      if (isNaN(Number(id))) {
        throw new BadRequestException('Invalid ID');
      }
      const result = await this.userRepository.update(id, userData);
      if (result.affected === 0) {
        throw new NotFoundException('User not found');
      }
      return this.findOne(id);
    }

    @Delete(':id')
    async remove(@Param('id') id: string): Promise<void> {
      if (isNaN(Number(id))) {
        throw new BadRequestException('Invalid ID');
      }
      const result = await this.userRepository.delete(id);
      if (result.affected === 0) {
        throw new NotFoundException('User not found');
      }
    }

    @Get('error/500')
    async triggerInternalError(): Promise<void> {
      throw new InternalServerErrorException('Simulated internal server error');
    }
  }

  @Module({
    imports: [
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        entities: [User],
        synchronize: true,
      }),
      TypeOrmModule.forFeature([User]),
    ],
    controllers: [UserController],
  })
  class AppModule {}

  async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    await app.listen(3000);
  }

  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a new user (200 OK)', async () => {
    const newUser = { name: 'John Doe', email: 'john@example.com' };
    const response = await request(app.getHttpServer())
      .post('/users')
      .send(newUser)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(newUser.name);
    expect(response.body.email).toBe(newUser.email);
  });

  it('should get all users (200 OK)', async () => {
    const response = await request(app.getHttpServer())
      .get('/users')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should get a specific user (200 OK)', async () => {
    const newUser = { name: 'Jane Doe', email: 'jane@example.com' };
    const createResponse = await request(app.getHttpServer())
      .post('/users')
      .send(newUser)
      .expect(201);

    const userId = createResponse.body.id;

    const getResponse = await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .expect(200);

    expect(getResponse.body).toHaveProperty('id', userId);
    expect(getResponse.body.name).toBe(newUser.name);
    expect(getResponse.body.email).toBe(newUser.email);
  });

  it('should update a user (200 OK)', async () => {
    const newUser = { name: 'Bob Smith', email: 'bob@example.com' };
    const createResponse = await request(app.getHttpServer())
      .post('/users')
      .send(newUser)
      .expect(201);

    const userId = createResponse.body.id;

    const updatedUser = { name: 'Robert Smith', email: 'robert@example.com' };
    const updateResponse = await request(app.getHttpServer())
      .put(`/users/${userId}`)
      .send(updatedUser)
      .expect(200);

    expect(updateResponse.body).toHaveProperty('id', userId);
    expect(updateResponse.body.name).toBe(updatedUser.name);
    expect(updateResponse.body.email).toBe(updatedUser.email);
  });

  it('should delete a user (200 OK)', async () => {
    const newUser = { name: 'Alice Johnson', email: 'alice@example.com' };
    const createResponse = await request(app.getHttpServer())
      .post('/users')
      .send(newUser)
      .expect(201);

    const userId = createResponse.body.id;

    await request(app.getHttpServer()).delete(`/users/${userId}`).expect(200);

    await request(app.getHttpServer()).get(`/users/${userId}`).expect(404);
  });

  it('should return 400 when creating a user with missing data', async () => {
    const invalidUser = { name: 'Invalid User' };
    await request(app.getHttpServer())
      .post('/users')
      .send(invalidUser)
      .expect(400);
  });

  it('should return 400 when updating a user with invalid ID', async () => {
    await request(app.getHttpServer())
      .put('/users/invalid-id')
      .send({ name: 'Updated Name' })
      .expect(400);
  });

  it('should return 400 when getting a user with invalid ID', async () => {
    await request(app.getHttpServer()).get('/users/invalid-id').expect(400);
  });

  it('should return 400 when deleting a user with invalid ID', async () => {
    await request(app.getHttpServer()).delete('/users/invalid-id').expect(400);
  });

  it('should return 404 when getting a non-existent user', async () => {
    await request(app.getHttpServer()).get('/users/9999').expect(404);
  });

  it('should return 404 when updating a non-existent user', async () => {
    await request(app.getHttpServer())
      .put('/users/9999')
      .send({ name: 'Updated Name' })
      .expect(404);
  });

  it('should return 404 when deleting a non-existent user', async () => {
    await request(app.getHttpServer()).delete('/users/9999').expect(404);
  });

  it('should return 500 for internal server error', async () => {
    await request(app.getHttpServer()).get('/users/error/500').expect(500);
  });

  if (process.env.NODE_ENV !== 'test') {
    bootstrap();
  }
});
