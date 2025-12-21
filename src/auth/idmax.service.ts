import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Сервис для работы с идентификаторами пользователей в системе (id_max).
 *
 * Обеспечивает:
 * - проверку наличия привязки id_max к сотруднику;
 * - создание новой привязки id_max к сотруднику.
 *
 * Использует Prisma ORM для взаимодействия с базой данных.
 *
 * @Injectable
 * @class IdMaxService
 */
@Injectable()
export class IdMaxService {
  private readonly logger = new Logger(IdMaxService.name);

  /**
   * Проверяет, существует ли привязка id_max для указанного сотрудника.
   *
   * Выполняет запрос к таблице staffMax для поиска записи по staffId.
   *
   * @param {string} staffId - уникальный идентификатор сотрудника в системе
   * @returns {Promise<boolean>} - `true`, если привязка существует, `false` в противном случае
   *   или при возникновении ошибки
   *
   * @example
   * const isLinked = await idMaxService.hasIdMax('staff123');
   * if (isLinked) {
   *   // id_max уже привязан
   * }
   *
   * @throws {Error} - при ошибке выполнения запроса к БД записывает ошибку в лог
   *   и возвращает `false`
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
   * Создаёт привязку id_max к указанному сотруднику.
   *
   * Добавляет новую запись в таблицу staffMax с указанными staffId и idMax.
   *
   * @param {string} staffId - уникальный идентификатор сотрудника в системе
   * @param {number} idMax - идентификатор пользователя в мессенджере (id_max)
   * @returns {Promise<boolean>} - `true` при успешном создании записи,
   *   `false` при возникновении ошибки
   *
   * @example
   * const success = await idMaxService.linkIdMax('staff123', 12345);
   * if (success) {
   *   // Привязка успешно создана
   * }
   *
   * @throws {Error} - при ошибке выполнения запроса к БД записывает ошибку в лог
   *   и возвращает `false`
   */
  async linkIdMax(staffId: string, idMax: number): Promise<boolean> {
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
