import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, OrderStatus } from '@prisma/client';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminOrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Get()
    findAll(
        @Query('page') page = '1',
        @Query('limit') limit = '20',
        @Query('status') status?: string,
    ) {
        const validStatuses = Object.values(OrderStatus);
        const parsedStatus = status && validStatuses.includes(status as OrderStatus)
            ? (status as OrderStatus)
            : undefined;
        return this.ordersService.findAll(Number(page), Number(limit), parsedStatus);
    }
}
