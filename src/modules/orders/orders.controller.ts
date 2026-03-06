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

    // Cliente crea su pedido
    @Post()
    create(
        @CurrentUser() user: JwtPayload,
        @Body() createOrderDto: CreateOrderDto,
    ) {
        return this.ordersService.create(user.sub, createOrderDto);
    }

    // Cliente ve sus propios pedidos
    @Get('my-orders')
    findMyOrders(@CurrentUser() user: JwtPayload) {
        return this.ordersService.findByUser(user.sub);
    }

    // Cliente ve detalle de un pedido
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.ordersService.findOne(id);
    }

    // ADMIN ve todos los pedidos
    @Get()
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    findAll(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10',
    ) {
        return this.ordersService.findAll(Number(page), Number(limit));
    }

    // ADMIN actualiza estado del pedido
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
