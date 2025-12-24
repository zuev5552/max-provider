import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Сервис для взаимодействия с системой IdMax — управления связями сотрудников (staff) и их идентификаторов в IdMax.
 *
 * Предоставляет методы для проверки наличия записи по staffId и создания новых связей между сотрудниками и idMax.
 * Использует PrismaService для выполнения запросов к базе данных.
 *
 * @class IdMaxService
 */
@Injectable()
export class IdMaxService {
  private readonly logger = new Logger(IdMaxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Проверяет, существует ли запись для указанного staffId в системе IdMax.
   *
   * Выполняет запрос к таблице `staffMax` для поиска записи по полю `staffId`.
   * При возникновении ошибки логирует сообщение и возвращает `false`.
   *
   * @param {string} staffId — идентификатор сотрудника, для которого выполняется проверка
   * @returns {Promise<boolean>} `true`, если запись найдена; `false` в случае отсутствия записи или ошибки
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
   * Создаёт связь между сотрудником (staffId) и его идентификатором в системе IdMax (idMax).
   *
   * Добавляет новую запись в таблицу `staffMax`. При успешном создании логирует информацию,
   * при ошибке — записывает сообщение об ошибке и возвращает `false`.
   *
   * @param {string} staffId — идентификатор сотрудника
   * @param {number} idMax — идентификатор сотрудника в системе IdMax
   * @returns {Promise<boolean>} `true` при успешном создании связи; `false` при ошибке
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
