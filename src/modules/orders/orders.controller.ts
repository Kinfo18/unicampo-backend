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

    // ---- Rutas estáticas primero ----

    // ADMIN: todos los pedidos (con filtro opcional por estado)
    @Get()
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
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

    // Cliente: sus propios pedidos
    @Get('my-orders')
    findMyOrders(@CurrentUser() user: JwtPayload) {
        return this.ordersService.findByUser(user.sub);
    }

    // Cliente crea pedido
    @Post()
    create(
        @CurrentUser() user: JwtPayload,
        @Body() createOrderDto: CreateOrderDto,
    ) {
        return this.ordersService.create(user.sub, createOrderDto);
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

    // ---- Rutas dinámicas al final ----

    // Detalle de un pedido (por id)
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.ordersService.findOne(id);
    }
}
