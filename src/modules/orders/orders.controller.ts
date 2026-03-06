import {
    Controller, Get, Post, Patch,
    Param, Body, UseGuards, Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, OrderStatus } from '@prisma/client';

interface JwtPayload {
    sub: string;
    email: string;
    role: string;
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post()
    create(
        @CurrentUser() user: JwtPayload,
        @Body() createOrderDto: CreateOrderDto,
    ) {
        return this.ordersService.create(user.sub, createOrderDto);
    }

    @Get('my-orders')
    findMyOrders(@CurrentUser() user: JwtPayload) {
        return this.ordersService.findByUser(user.sub);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.ordersService.findOne(id);
    }

    @Get()
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    findAll(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
        @Query('status') status?: OrderStatus,
    ) {
        return this.ordersService.findAll(Number(page), Number(limit), status);
    }

    @Patch(':id/status')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    updateStatus(
        @Param('id') id: string,
        @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    ) {
        return this.ordersService.updateStatus(id, updateOrderStatusDto);
    }
}
