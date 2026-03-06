import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
    constructor(private readonly prisma: PrismaService) { }

    async create(userId: string, createOrderDto: CreateOrderDto) {
        const { items, shippingAddress, notes } = createOrderDto;

        // Usar transacción para garantizar consistencia
        return this.prisma.$transaction(async (tx) => {
            let total = 0;
            const orderItemsData: { productId: string; quantity: number; unitPrice: number }[] = [];

            // Verificar stock y calcular total
            for (const item of items) {
                const product = await tx.product.findUnique({
                    where: { id: item.productId, isActive: true },
                    include: { inventory: true },
                });

                if (!product) {
                    throw new NotFoundException(
                        `Producto ${item.productId} no encontrado`,
                    );
                }

                if (!product.inventory || product.inventory.quantity < item.quantity) {
                    throw new BadRequestException(
                        `Stock insuficiente para "${product.name}". Disponible: ${product.inventory?.quantity ?? 0}`,
                    );
                }

                const unitPrice = Number(product.price);
                total += unitPrice * item.quantity;

                orderItemsData.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice,
                });
            }

            // Crear el pedido con sus items
            const order = await tx.order.create({
                data: {
                    userId,
                    shippingAddress,
                    notes,
                    total,
                    items: { create: orderItemsData },
                },
                include: {
                    items: {
                        include: { product: { select: { name: true, images: true } } },
                    },
                },
            });

            // Descontar stock de cada producto
            for (const item of items) {
                await tx.inventory.update({
                    where: { productId: item.productId },
                    data: { quantity: { decrement: item.quantity } },
                });
            }

            return order;
        });
    }

    async findAll(page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [orders, total] = await this.prisma.$transaction([
            this.prisma.order.findMany({
                skip,
                take: limit,
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    items: {
                        include: { product: { select: { name: true } } },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.order.count(),
        ]);

        return {
            data: orders,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async findByUser(userId: string) {
        return this.prisma.order.findMany({
            where: { userId },
            include: {
                items: {
                    include: {
                        product: { select: { name: true, images: true, slug: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, email: true } },
                items: {
                    include: {
                        product: { select: { name: true, images: true, slug: true } },
                    },
                },
            },
        });

        if (!order) throw new NotFoundException('Pedido no encontrado');
        return order;
    }

    async updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto) {
        await this.findOne(id);

        return this.prisma.order.update({
            where: { id },
            data: { status: updateOrderStatusDto.status },
        });
    }
}
