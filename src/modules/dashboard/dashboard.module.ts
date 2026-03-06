import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'unicampo-secret-2026',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, PrismaService, JwtAuthGuard, RolesGuard],
})
export class DashboardModule { }
