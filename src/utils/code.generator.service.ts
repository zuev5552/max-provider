import { Injectable, Logger } from '@nestjs/common';

/**
 * Сервис для генерации и валидации кодов подтверждения.
 *
 * Предоставляет методы:
 * - генерации 4‑значного числового кода;
 * - проверки формата введённого кода (ровно 4 цифры).
 *
 * @Injectable
 * @class CodeGeneratorService
 */
@Injectable()
export class CodeGeneratorService {
  private readonly logger = new Logger(CodeGeneratorService.name);
  constructor() {}
  /**
   *
   * Генерирует 4‑значный числовой код подтверждения.
   *
   * Создаёт случайное число в диапазоне от 1000 до 9999 (включительно).
   *
   * @returns {number} - сгенерированный 4‑значный код (например, 1234, 5678)
   *
   * @example
   * const code = codeGeneratorService.generateCode();
   * console.log(code); // например, 4287
   */
  generateCode(): number {
    return Math.floor(1000 + Math.random() * 9000);
  }

  /**
   * Проверяет, соответствует ли введённый текст формату 4‑значного кода.
   *
   * Валидирует строку по следующим критериям:
   * - состоит ровно из 4 символов;
   * - все символы — цифры (0–9).
   *
   * @param {string} input - строка для проверки (например, '1234', 'abcd', '12')
   * @returns {boolean} - `true`, если строка соответствует формату 4‑значного кода,
   *   `false` — в противном случае
   *
   * @example
   * console.log(codeGeneratorService.isValidCodeInput('1234')); // true
   * console.log(codeGeneratorService.isValidCodeInput('123'));  // false
   * console.log(codeGeneratorService.isValidCodeInput('abcd')); // false
   */
  isValidCodeInput(input: string): boolean {
    return /^\d{4}$/.test(input);
  }
}
