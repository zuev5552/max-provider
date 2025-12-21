import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Staff } from '@prisma/client'; // Импортируем полный тип Staff

/**
 * Сервис для валидации телефонных номеров и поиска сотрудников по номеру телефона.
 *
 * Обеспечивает:
 * - проверку формата телефонного номера;
 * - поиск активных/отстраненных сотрудников по номеру телефона.
 *
 * Использует Prisma ORM для взаимодействия с базой данных.
 *
 * @Injectable
 * @class PhoneValidationService
 */
@Injectable()
export class PhoneValidationService {
  private readonly logger = new Logger(PhoneValidationService.name);

  /**
   * Проверяет, соответствует ли телефонный номер заданному формату.
   *
   * Валидирует строку по регулярному выражению:
   * - начинается с символа «+»;
   * - далее идёт цифра от 1 до 9;
   * - затем от 6 до 14 цифр (общая длина номера от 8 до 16 символов с учётом «+»).
   *
   * @param {string} phone - телефонный номер для проверки (например, '+79991234567')
   * @returns {boolean} - `true`, если номер соответствует формату, `false` в противном случае
   *
   * @example
   * console.log(phoneValidationService.isValidPhone('+79991234567')); // true
   * console.log(phoneValidationService.isValidPhone('89991234567'));  // false (нет '+')
   * console.log(phoneValidationService.isValidPhone('+799'));         // false (слишком короткий)
   */
  isValidPhone(phone: string): boolean {
    return /^\+[1-9]\d{6,14}$/.test(phone.trim());
  }

    /**
   * Ищет сотрудников по номеру телефона в базе данных.
   *
   * Выполняет запрос к таблице staff для поиска записей:
   * - с указанным номером телефона;
   * - со статусом «Active» или «Suspended».
   *
   * @param {string} phone - номер телефона для поиска (без пробелов и лишних символов)
   * @returns {Promise<Staff[]>} - массив найденных сотрудников, соответствующих критериям,
   *   или пустой массив при ошибке или отсутствии совпадений
   *
   * @example
   * const staffList = await phoneValidationService.findStaffByPhone('+79991234567');
   * if (staffList.length > 0) {
   *   // Сотрудники найдены
   * }
   *
   * @throws {Error} - при ошибке выполнения запроса к БД записывает ошибку в лог
   *   и возвращает пустой массив
   */
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
