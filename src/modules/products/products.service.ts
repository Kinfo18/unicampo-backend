import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto, ProductSortBy } from './dto/product-query.dto';

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

    // Construir where
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

    // Ordenamiento
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === ProductSortBy.PRICE_ASC)  orderBy = { price: 'asc' };
    if (sortBy === ProductSortBy.PRICE_DESC) orderBy = { price: 'desc' };
    // best_seller se ordena post-query (ver abajo)

    if (sortBy === ProductSortBy.BEST_SELLER) {
      // Traer todos los que coinciden con los filtros y ordenar por ventas
      const allProducts = await this.prisma.product.findMany({
        where,
        include: {
          category: true,
          inventory: true,
          items: { select: { quantity: true } },
        },
      });

      const sorted = allProducts
        .map((p) => ({
          ...p,
          totalSold: p.items.reduce((acc, i) => acc + i.quantity, 0),
        }))
        .sort((a, b) => b.totalSold - a.totalSold);

      const paginated = sorted.slice(skip, skip + limit).map(({ items: _items, totalSold: _ts, ...p }) => p);

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
    const data: any = { ...updateProductDto };
    if (updateProductDto.name) data.slug = this.generateSlug(updateProductDto.name);
    return this.prisma.product.update({
      where: { id },
      data,
      include: { category: true, inventory: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  /** Devuelve el rango de precios para los sliders del frontend */
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
