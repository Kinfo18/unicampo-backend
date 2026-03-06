import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existingUser) throw new ConflictException('El email ya está registrado');

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.prisma.user.create({
      data: { ...createUserDto, password: hashedPassword },
    });
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findAll() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, address: true, municipality: true,
        department: true, avatarUrl: true, createdAt: true,
      },
    });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateAvatar(id: string, avatarUrl: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarUrl },
    });
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Guarda la dirección del primer pedido si el usuario no tiene una registrada
  async saveAddressIfEmpty(
    userId: string,
    address: string,
    municipality?: string,
    department?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && !user.address) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { address, municipality, department },
      });
    }
  }
}
