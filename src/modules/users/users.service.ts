import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import * as bcrypt from 'bcryptjs';

const USER_SELECT = {
  id: true, name: true, email: true, role: true, isActive: true,
  phone: true, address: true, municipality: true,
  department: true, avatarUrl: true, createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: createUserDto.email } });
    if (existing) throw new ConflictException('El email ya está registrado');
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.prisma.user.create({
      data: { ...createUserDto, password: hashedPassword },
    });
    const { password, ...rest } = user;
    return rest;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { password, ...rest } = user;
    return rest;
  }

  /** Admin: lista paginada con búsqueda y filtro por rol/estado */
  async findAll(page = 1, limit = 20, search?: string, role?: string, active?: string) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (active !== undefined) where.isActive = active === 'true';

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, meta: { total, page, totalPages: Math.ceil(total / limit) } };
  }

  /** Admin: actualizar rol o estado activo */
  async adminUpdate(id: string, dto: AdminUpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    const { password, ...rest } = user;
    return rest;
  }

  async updateAvatar(id: string, avatarUrl: string) {
    const user = await this.prisma.user.update({ where: { id }, data: { avatarUrl } });
    const { password, ...rest } = user;
    return rest;
  }

  async saveAddressIfEmpty(userId: string, address: string, municipality?: string, department?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && !user.address) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { address, municipality, department },
      });
    }
  }
}
