import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Staff } from '@prisma/client'; // Импортируем полный тип Staff

@Injectable()
export class PhoneValidationService {
  private readonly logger = new Logger(PhoneValidationService.name);

  isValidPhone(phone: string): boolean {
    return /^\+[1-9]\d{6,14}$/.test(phone.trim());
  }

  async findStaffByPhone(phone: string): Promise<Staff[]> {
    try {
      return await this.prisma.staff.findMany({
        where: {
          phoneNumber: phone,
          status: { in: ['Active', 'Suspended'] },
        },
      });
    } catch (error) {
      this.logger.error(`Ошибка поиска сотрудников по телефону ${phone}: ${error.message}`);
      return [];
    }
  }

  constructor(private readonly prisma: PrismaService) {}
}