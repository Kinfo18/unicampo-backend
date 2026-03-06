import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

@Injectable()
export class InventoryService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        const inventory = await this.prisma.inventory.findMany({
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        price: true,
                        category: { select: { name: true } },
                    },
                },
            },
            orderBy: { quantity: 'asc' },
        });

        return inventory.map((item) => ({
            ...item,
            isLowStock: item.quantity <= item.minStock,
        }));
    }

    async findLowStock() {
        const allInventory = await this.prisma.inventory.findMany({
            include: {
                product: {
                    select: { id: true, name: true, slug: true },
                },
            },
        });

        return allInventory
            .filter((item) => item.quantity <= item.minStock)
            .map((item) => ({
                ...item,
                isLowStock: true,
                alertMessage: `⚠️ ${item.product.name} tiene solo ${item.quantity} unidades (mínimo: ${item.minStock})`,
            }));
    }

    async findByProduct(productId: string) {
        const inventory = await this.prisma.inventory.findUnique({
            where: { productId },
            include: { product: true },
        });

        if (!inventory) throw new NotFoundException('Inventario no encontrado');

        return {
            ...inventory,
            isLowStock: inventory.quantity <= inventory.minStock,
        };
    }

    async update(productId: string, updateInventoryDto: UpdateInventoryDto) {
        const inventory = await this.prisma.inventory.findUnique({
            where: { productId },
        });

        if (!inventory) throw new NotFoundException('Inventario no encontrado');

        return this.prisma.inventory.update({
            where: { productId },
            data: updateInventoryDto,
            include: { product: { select: { name: true } } },
        });
    }

    async adjustStock(productId: string, quantity: number) {
        const inventory = await this.prisma.inventory.findUnique({
            where: { productId },
        });

        if (!inventory) throw new NotFoundException('Inventario no encontrado');

        const newQuantity = inventory.quantity + quantity;

        return this.prisma.inventory.update({
            where: { productId },
            data: { quantity: newQuantity < 0 ? 0 : newQuantity },
        });
    }
}
