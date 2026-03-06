import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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
            // Total de pedidos
            this.prisma.order.count(),

            // Total de usuarios
            this.prisma.user.count({ where: { role: 'CUSTOMER' } }),

            // Total de productos activos
            this.prisma.product.count({ where: { isActive: true } }),

            // Últimos 5 pedidos
            this.prisma.order.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { name: true, email: true } },
                    items: { include: { product: { select: { name: true } } } },
                },
            }),

            // Top 5 productos más vendidos
            this.prisma.orderItem.groupBy({
                by: ['productId'],
                _sum: { quantity: true },
                orderBy: { _sum: { quantity: 'desc' } },
                take: 5,
            }),

            // Productos con stock bajo
            this.prisma.inventory.findMany({
                include: {
                    product: { select: { name: true, slug: true } },
                },
            }),

            // Ingresos totales
            this.prisma.order.aggregate({
                _sum: { total: true },
                where: { paymentStatus: 'APPROVED' },
            }),
        ]);

        // Enriquecer top productos con nombres
        const topProductsWithNames = await Promise.all(
            topProducts.map(async (item) => {
                const product = await this.prisma.product.findUnique({
                    where: { id: item.productId },
                    select: { name: true, slug: true },
                });
                return {
                    product,
                    totalSold: item._sum?.quantity ?? 0,
                };
            }),
        );

        // Filtrar stock bajo
        const lowStock = lowStockItems.filter(
            (item) => item.quantity <= item.minStock,
        );

        return {
            summary: {
                totalOrders,
                totalUsers,
                totalProducts,
                totalRevenue: Number(revenueData._sum.total ?? 0),
            },
            recentOrders,
            topProducts: topProductsWithNames,
            lowStockAlerts: lowStock.map((item) => ({
                productName: item.product.name,
                currentStock: item.quantity,
                minStock: item.minStock,
                alertMessage: `⚠️ ${item.product.name}: ${item.quantity} unidades restantes`,
            })),
        };
    }

    async getRevenueByMonth() {
        const orders = await this.prisma.order.findMany({
            where: { paymentStatus: 'APPROVED' },
            select: { total: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });

        // Agrupar por mes
        const revenueByMonth: Record<string, number> = {};

        orders.forEach((order) => {
            const month = order.createdAt.toISOString().slice(0, 7); // "2026-03"
            revenueByMonth[month] = (revenueByMonth[month] ?? 0) + Number(order.total);
        });

        return Object.entries(revenueByMonth).map(([month, revenue]) => ({
            month,
            revenue,
        }));
    }
}
