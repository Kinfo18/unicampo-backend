import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

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
    if (existing) {
      throw new ConflictException('Ya existe un producto con ese nombre');
    }

    const { initialStock = 0, minStock = 5, ...productData } = createProductDto;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { ...productData, slug },
        include: { category: true },
      });

      await tx.inventory.create({
        data: {
          productId: product.id,
          quantity: initialStock,
          minStock,
        },
      });

      return product;
    });
  }

  async findAll(query: ProductQueryDto) {
    const { search, categoryId, page = 1, limit = 12 } = query;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          inventory: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(idOrSlug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        isActive: true,
      },
      include: { category: true, inventory: true },
    });

    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);

    const data: any = { ...updateProductDto };
    if (updateProductDto.name) {
      data.slug = this.generateSlug(updateProductDto.name);
    }

    return this.prisma.product.update({
      where: { id },
      data,
      include: { category: true, inventory: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
