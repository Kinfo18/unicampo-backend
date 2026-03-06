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
import { Role } from '@prisma/client';

interface JwtPayload {
    sub: string;
    email: string;
    role: string;
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    // Cliente crea pedido
    @Post()
    create(
        @CurrentUser() user: JwtPayload,
        @Body() createOrderDto: CreateOrderDto,
    ) {
        return this.ordersService.create(user.sub, createOrderDto);
    }

    // Cliente: sus propios pedidos
    @Get('my-orders')
    findMyOrders(@CurrentUser() user: JwtPayload) {
        return this.ordersService.findByUser(user.sub);
    }

    // ADMIN actualiza estado
    @Patch(':id/status')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    updateStatus(
        @Param('id') id: string,
        @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    ) {
        return this.ordersService.updateStatus(id, updateOrderStatusDto);
    }

    // Detalle de un pedido
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.ordersService.findOne(id);
    }
}
