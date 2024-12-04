import {
    BadRequestException,
    Body,
    Controller,
    INestApplication,
    Module,
    NotFoundException,
    Post,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { PostResponseInterceptor } from 'src/services/post-response.interceptor';
import request from 'supertest';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';


describe('assessment test', () => {

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

        @Column()
        otp: string;

        @Column({ nullable: true })
        cooldown: Date;

        @Column({ default: 0 })
        otpCount: number;
    }

    @Controller('authorization')
    class OtpController {
        constructor(
            @InjectRepository(User)
            private readonly user) {
        }
        @Post('otp/generate')
        async generateOTP(@Body() body: { email: string }): Promise<{ otp: string }> {
            const { email } = body;
            //manually implement generate otp with math module
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            console.log(otp);
            // find user by email
            const user = await this.user.findOne({ where: { email } });
            // to prevent duplicate otp
            // storing otp Expiry to db

            if (!user) {
                throw new NotFoundException('Invalid User');
            }
            user.email = email;
            user.otp = otp;
            user.name = 'John Doe';
            user.createDate = new Date();
            await this.user.save(user);
            return { otp };
        }

        @Post('otp/verify')
        async verifyOTP(@Body() body: { otp: string }): Promise<{ otp: string }> {
            const { otp } = body;
            const user = await this.user.findOne({ where: { otp } });

            // check if otp is expired

            // rate limit
            // cooldown otp verification
            // 1st verify by checking otp count in db
            if (user.otpCount === 0) {
                return { otp: "otp verified" };
            }
            else if (user.otpCount === 1) {
                const cooldown = user.cooldown;
                const currentTime = new Date();
                const timeDifference = currentTime.getTime() - cooldown.getTime();
                const minutesDifference = Math.floor(timeDifference / (1000 * 60));
                if (minutesDifference < 2) {
                    throw new BadRequestException('Too many requests. Please try again later.');
                }
                user.otpCount = 1;
                user.cooldown = null;
                await this.user.save(user);
            }
            else if (user.otpCount === 2) {
                const cooldown = user.cooldown;
                const currentTime = new Date();
                const timeDifference = currentTime.getTime() - cooldown.getTime();
                const minutesDifference = Math.floor(timeDifference / (1000 * 60));
                if (minutesDifference < 5) {
                    throw new BadRequestException('Too many requests. Please try again later.');
                }
                user.otpCount = 2;
                user.cooldown = null;
                await this.user.save(user);
            }
            else {
                throw new NotFoundException('Invalid OTP');
            }
        }
    }

    @Module({
        imports: [
            TypeOrmModule.forRoot({
                type: 'sqlite',
                database: "./database.sqlite",
                entities: [User],
                synchronize: true,
            }),
            TypeOrmModule.forFeature([User]),
        ],
        controllers: [OtpController],
    })
    class AppModule { }
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalInterceptors(new PostResponseInterceptor());
        // app.useGlobalFilters(new AllExceptionsFilter());

        // CORS cross site scripting
        // app.enableCors({
        //     origin: 'https://gov domain',
        //     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        //     preflightContinue: false,
        // });

        // app.use(rateLimit({
        //     windowMs: 15 * 60 * 1000, // 15 minutes
        //     max: 100, // limit each IP to 100 requests per windowMs
        // }));

        await app.init();

        // init db
        const userRepository = moduleFixture.get(getRepositoryToken(User));
        await userRepository.save({
            name: 'John Doe',
            email: 'test@example.com',
            otp: '123'
        });
    });

    afterAll(async () => {
        await app.close();
    });


    it('should generateOTP api 200', async () => {
        const responseOTP = await request(app.getHttpServer())
            .post('/authorization/otp/generate')
            .send({ email: 'test@example.com' })
            .expect(200);
        expect(responseOTP.body).toHaveProperty('otp');

        const otpResponse = responseOTP.body.otp;

        const response = await request(app.getHttpServer())
            .post('/authorization/otp/verify')
            .send({ otp: otpResponse })
            .expect(200);

    });




});