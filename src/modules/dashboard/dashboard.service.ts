import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) { }

    async getMetrics() {
        const [
            totalOrders,
            totalUsers,
            totalProducts,
            recentOrders,
            topProducts,
            lowStockItems,
            revenueData,
        ] = await this.prisma.$transaction([
            this.prisma.order.count(),
            this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
            this.prisma.product.count({ where: { isActive: true } }),
            this.prisma.order.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { name: true, email: true } },
                    items: { include: { product: { select: { name: true } } } },
                },
            }),
            this.prisma.orderItem.groupBy({
                by: ['productId'],
                _sum: { quantity: true },
                orderBy: { _sum: { quantity: 'desc' } },
                take: 5,
            }),
            this.prisma.inventory.findMany({
                include: { product: { select: { name: true, slug: true } } },
            }),
            this.prisma.order.aggregate({
                _sum: { total: true },
            }),
        ]);

        // Pedidos por estado
        const ordersByStatus = await Promise.all(
            Object.values(OrderStatus).map(async (status) => ({
                status,
                count: await this.prisma.order.count({ where: { status } }),
            }))
        );

        const topProductsWithNames = await Promise.all(
            topProducts.map(async (item) => {
                const product = await this.prisma.product.findUnique({
                    where: { id: item.productId },
                    select: { name: true, slug: true },
                });
                return { product, totalSold: item._sum?.quantity ?? 0 };
            }),
        );

        const lowStock = lowStockItems.filter((item) => item.quantity <= item.minStock);

        return {
            summary: {
                totalOrders,
                totalUsers,
                totalProducts,
                totalRevenue: Number(revenueData._sum.total ?? 0),
            },
            ordersByStatus,
            recentOrders,
            topProducts: topProductsWithNames,
            lowStockAlerts: lowStock.map((item) => ({
                productName: item.product.name,
                currentStock: item.quantity,
                minStock: item.minStock,
            })),
        };
    }

    async getRevenueByMonth() {
        // Últimos 6 meses
        const since = new Date();
        since.setMonth(since.getMonth() - 5);
        since.setDate(1);
        since.setHours(0, 0, 0, 0);

        const orders = await this.prisma.order.findMany({
            where: { createdAt: { gte: since } },
            select: { total: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });

        const revenueByMonth: Record<string, number> = {};
        orders.forEach((order) => {
            const month = order.createdAt.toISOString().slice(0, 7);
            revenueByMonth[month] = (revenueByMonth[month] ?? 0) + Number(order.total);
        });

        return Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue }));
    }
}
