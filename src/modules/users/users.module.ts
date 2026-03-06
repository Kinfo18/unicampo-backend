import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MulterModule } from '@nestjs/platform-express';
import { join } from 'path';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'unicampo-secret-2026',
      signOptions: { expiresIn: '7d' },
    }),
    MulterModule.register({
      dest: join(process.cwd(), 'uploads', 'avatars'),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
  exports: [UsersService],
})
export class UsersModule {}
