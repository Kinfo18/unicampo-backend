import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto, ProductSortBy } from './dto/product-query.dto';
import { RestockProductDto } from './dto/restock-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  async create(createProductDto: CreateProductDto) {
    const slug = this.generateSlug(createProductDto.name);
    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Ya existe un producto con ese nombre');

    const { initialStock = 0, minStock = 5, ...productData } = createProductDto;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { ...productData, slug },
        include: { category: true },
      });
      await tx.inventory.create({
        data: { productId: product.id, quantity: initialStock, minStock },
      });
      return product;
    });
  }

  async findAll(query: ProductQueryDto) {
    const {
      search, categoryId, minPrice, maxPrice,
      sortBy = ProductSortBy.NEWEST, inStock,
      page = 1, limit = 12,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }
    if (inStock === true) {
      where.inventory = { quantity: { gt: 0 } };
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === ProductSortBy.PRICE_ASC)  orderBy = { price: 'asc' };
    if (sortBy === ProductSortBy.PRICE_DESC) orderBy = { price: 'desc' };

    if (sortBy === ProductSortBy.BEST_SELLER) {
      const allProducts = await this.prisma.product.findMany({
        where,
        include: {
          category: true,
          inventory: true,
          orderItems: { select: { quantity: true } },
        },
      });

      const sorted = allProducts
        .map((p) => ({
          ...p,
          totalSold: p.orderItems.reduce((acc, i) => acc + i.quantity, 0),
        }))
        .sort((a, b) => b.totalSold - a.totalSold);

      const paginated = sorted
        .slice(skip, skip + limit)
        .map(({ orderItems: _oi, totalSold: _ts, ...p }) => p);

      return {
        data: paginated,
        meta: { total: sorted.length, page, limit, totalPages: Math.ceil(sorted.length / limit) },
      };
    }

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: true, inventory: true },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(idOrSlug: string) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], isActive: true },
      include: { category: true, inventory: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);
    // initialStock y minStock NO se procesan aquí — usar /stock para reabastecer
    const { initialStock: _i, minStock: _m, ...productFields } = updateProductDto as any;
    const data: any = { ...productFields };
    if (updateProductDto.name) data.slug = this.generateSlug(updateProductDto.name);
    return this.prisma.product.update({
      where: { id },
      data,
      include: { category: true, inventory: true },
    });
  }

  /**
   * Reabastecimiento incremental: suma `units` al stock actual.
   * Opcionalmente actualiza el stock mínimo de alerta.
   * Usa prisma.inventory.update con `increment` para evitar race conditions.
   */
  async restock(id: string, dto: RestockProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (!product.inventory) throw new BadRequestException('El producto no tiene inventario registrado');

    return this.prisma.$transaction(async (tx) => {
      const inventoryData: any = { quantity: { increment: dto.units } };
      if (dto.minStock !== undefined) inventoryData.minStock = dto.minStock;

      const inventory = await tx.inventory.update({
        where: { productId: product.id },
        data: inventoryData,
      });

      return {
        productId: product.id,
        name: product.name,
        previousStock: inventory.quantity - dto.units,
        addedUnits: dto.units,
        currentStock: inventory.quantity,
        minStock: inventory.minStock,
      };
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  async getPriceRange() {
    const result = await this.prisma.product.aggregate({
      where: { isActive: true },
      _min: { price: true },
      _max: { price: true },
    });
    return {
      min: Number(result._min.price ?? 0),
      max: Number(result._max.price ?? 0),
    };
  }
}
