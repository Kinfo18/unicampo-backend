import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get()
    getMetrics() {
        return this.dashboardService.getMetrics();
    }

    @Get('revenue')
    getRevenueByMonth() {
        return this.dashboardService.getRevenueByMonth();
    }
}
