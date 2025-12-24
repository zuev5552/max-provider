import { Injectable, Logger } from '@nestjs/common';
import { Staff } from '@prisma/client'; // Импортируем полный тип Staff

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PhoneValidationService {
  private readonly logger = new Logger(PhoneValidationService.name);

  constructor(private readonly prisma: PrismaService) {}


  isValidPhone(phone: string): boolean {
    return /^7\d{10}$/.test(phone.trim());
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
}
