import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class IdMaxService {
  private readonly logger = new Logger(IdMaxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Проверяет, существует ли запись для staffId в системе IdMax
   */
  async hasIdMax(staffId: string): Promise<boolean> {
    try {
      const record = await this.prisma.staffMax.findUnique({ where: { staffId } });
      return !!record;
    } catch (error) {
      this.logger.error(`Ошибка проверки id_max для staffId ${staffId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Создаёт связь сотрудника с IdMax (idMax)
   */
  async linkIdMax(staffId: string, idMax: number): Promise<boolean> {
    try {
      await this.prisma.staffMax.create({ data: { staffId, idMax } });
      this.logger.log(`[link_idmax_success] staffId ${staffId} связан с idMax ${idMax}`);
      return true;
    } catch (error) {
      this.logger.error(`Ошибка сохранения id_max для staffId ${staffId}: ${error.message}`);
      return false;
    }
  }
}
