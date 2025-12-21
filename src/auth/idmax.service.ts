import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdMaxService {
  private readonly logger = new Logger(IdMaxService.name);

  async hasIdMax(staffId: number): Promise<boolean> {
    try {
      const record = await this.prisma.staffMax.findUnique({ where: { staffId } });
      return !!record;
    } catch (error) {
      this.logger.error(`Ошибка проверки id_max для staffId ${staffId}: ${error.message}`);
      return false;
    }
  }

  async linkIdMax(staffId: number, idMax: number): Promise<boolean> {
    try {
      await this.prisma.staffMax.create({ data: { staffId, idMax } });
      return true;
    } catch (error) {
      this.logger.error(`Ошибка сохранения id_max для staffId ${staffId}: ${error.message}`);
      return false;
    }
  }

  constructor(private readonly prisma: PrismaService) {}
}
