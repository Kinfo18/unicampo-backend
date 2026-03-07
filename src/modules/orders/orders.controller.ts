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

/**
 * IMPORTANTE: Las rutas estáticas SIEMPRE deben ir ANTES que las dinámicas (:id).
 * NestJS las registra en orden de declaración.
 */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    /** POST /orders — cliente crea pedido */
    @Post()
    create(
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateOrderDto,
    ) {
        return this.ordersService.create(user.sub, dto);
    }

    /**
     * GET /orders/all — ADMIN lista todos los pedidos
     * DEBE ir antes de :id para que NestJS no lo interprete como id="all"
     */
    @Get('all')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    findAll(
        @Query('page') page = '1',
        @Query('limit') limit = '20',
        @Query('status') status?: string,
    ) {
        const parsedStatus = Object.values(OrderStatus).includes(status as OrderStatus)
            ? (status as OrderStatus)
            : undefined;
        return this.ordersService.findAll(Number(page), Number(limit), parsedStatus);
    }

    /** GET /orders/my-orders — cliente ve sus propios pedidos */
    @Get('my-orders')
    findMyOrders(@CurrentUser() user: JwtPayload) {
        return this.ordersService.findByUser(user.sub);
    }

    /** PATCH /orders/:id/status — ADMIN actualiza estado */
    @Patch(':id/status')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateOrderStatusDto,
    ) {
        return this.ordersService.updateStatus(id, dto);
    }

    /** GET /orders/:id — detalle de un pedido (va AL FINAL) */
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.ordersService.findOne(id);
    }
}
