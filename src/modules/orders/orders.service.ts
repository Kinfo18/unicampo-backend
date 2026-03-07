import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus } from '@prisma/client';

// Secuencia estricta de avance
const FLOW: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
];

function validateTransition(current: OrderStatus, next: OrderStatus): void {
    // Pedido cancelado: no se puede modificar
    if (current === OrderStatus.CANCELLED) {
        throw new BadRequestException('Un pedido cancelado no puede cambiar de estado.');
    }
    // Pedido entregado: estado final
    if (current === OrderStatus.DELIVERED) {
        throw new BadRequestException('Un pedido entregado no puede cambiar de estado.');
    }
    // Cancelar: solo permitido antes de SHIPPED
    if (next === OrderStatus.CANCELLED) {
        const idx = FLOW.indexOf(current);
        if (idx >= FLOW.indexOf(OrderStatus.SHIPPED)) {
            throw new BadRequestException('No se puede cancelar un pedido que ya fue enviado.');
        }
        return;
    }
    // Avance: solo un paso a la vez
    const currentIdx = FLOW.indexOf(current);
    const nextIdx = FLOW.indexOf(next);
    if (nextIdx !== currentIdx + 1) {
        throw new BadRequestException(
            `Transición inválida: no se puede pasar de "${current}" a "${next}". Solo se permite avanzar un paso.`,
        );
    }
}

@Injectable()
export class OrdersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly usersService: UsersService,
    ) { }

    async create(userId: string, createOrderDto: CreateOrderDto) {
        const { items, shippingAddress, notes, municipality, department } = createOrderDto;

        return this.prisma.$transaction(async (tx) => {
            let total = 0;
            const orderItemsData: { productId: string; quantity: number; unitPrice: number }[] = [];

            for (const item of items) {
                const product = await tx.product.findUnique({
                    where: { id: item.productId, isActive: true },
                    include: { inventory: true },
                });

                if (!product) throw new NotFoundException(`Producto ${item.productId} no encontrado`);

                if (!product.inventory || product.inventory.quantity < item.quantity) {
                    throw new BadRequestException(
                        `Stock insuficiente para "${product.name}". Disponible: ${product.inventory?.quantity ?? 0}`,
                    );
                }

                const unitPrice = Number(product.price);
                total += unitPrice * item.quantity;
                orderItemsData.push({ productId: item.productId, quantity: item.quantity, unitPrice });
            }

            const order = await tx.order.create({
                data: {
                    userId,
                    shippingAddress,
                    notes,
                    total,
                    items: { create: orderItemsData },
                },
                include: {
                    items: { include: { product: { select: { name: true, images: true } } } },
                },
            });

            for (const item of items) {
                await tx.inventory.update({
                    where: { productId: item.productId },
                    data: { quantity: { decrement: item.quantity } },
                });
            }

            return order;
        }).then(async (order) => {
            await this.usersService.saveAddressIfEmpty(userId, shippingAddress, municipality, department);
            return order;
        });
    }

    async findAll(page = 1, limit = 20, status?: OrderStatus) {
        const skip = (page - 1) * limit;
        const where = status ? { status } : {};

        const [orders, total] = await this.prisma.$transaction([
            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    items: { include: { product: { select: { name: true, images: true } } } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.order.count({ where }),
        ]);
        return { data: orders, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    async findByUser(userId: string) {
        return this.prisma.order.findMany({
            where: { userId },
            include: {
                items: { include: { product: { select: { name: true, images: true, slug: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, email: true } },
                items: { include: { product: { select: { name: true, images: true, slug: true } } } },
            },
        });
        if (!order) throw new NotFoundException('Pedido no encontrado');
        return order;
    }

    async updateStatus(id: string, dto: UpdateOrderStatusDto) {
        const order = await this.findOne(id);
        validateTransition(order.status, dto.status);
        return this.prisma.order.update({
            where: { id },
            data: { status: dto.status },
        });
    }
}
