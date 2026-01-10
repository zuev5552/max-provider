/* eslint-disable perfectionist/sort-classes */
// utils/message-chunker.service.ts
import { Injectable } from '@nestjs/common';

/** Интерфейс настроек для разбивки сообщений на чанки */
export interface ChunkOptions {
  /** Максимальная длина одного сообщения в символах. @default 3800 */
  maxLength?: number;
  /** Разделитель между элементами в сообщении. @default '\n' + 20 дефисов + '\n' */
  separator?: string;
  /** Флаг включения нумерации страниц. Если true и количество чанков > 1, к каждому добавляется футер с нумерацией. @default false */
  addPagination?: boolean;
  /** Функция форматирования нумерации страниц. Принимает текущий номер и общее количество страниц, возвращает строку. @default '\n\n--- Страница ${current} из ${total} ---' */
  paginationFormat?: (current: number, total: number) => string;
}

@Injectable()
export class MessageChunkService {
  private readonly DEFAULT_MAX_LENGTH = 3800;
  private readonly DEFAULT_SEPARATOR = '\n' + '-'.repeat(20) + '\n';
  private readonly DEFAULT_PAGINATION_FORMAT = (current: number, total: number) =>
    `\n\n--- Страница ${current} из ${total} ---`;

  /**
   * Разбивает массив элементов на сообщения с учётом лимита длины и добавляет нумерацию страниц (если включено).
   * Алгоритм: 1) добавляет элементы в чанк до превышения maxLength; 2) при превышении начинает новый чанк; 3) если addPagination = true и чанков > 1, добавляет нумерацию.
   * @template T — тип элементов массива items
   * @param items — массив элементов для форматирования и разбивки на чанки
   * @param formatItem — функция, преобразующая элемент типа T в строку (принимает элемент и его порядковый номер, начиная с 1)
   * @param options — необязательные настройки разбивки (см. интерфейс ChunkOptions)
   * @returns {string[]} Массив строк: каждая не превышает maxLength, содержит элементы с separator, может иметь футер с нумерацией (если addPagination = true и чанков > 1)
   * @example
   * ```typescript
   * const chunks = messageChunker.chunkMessages(
   *   ['Item 1', 'Item 2', 'Item 3'],
   *   (item, index) => `${index}. ${item}`,
   *   { addPagination: true, maxLength: 50 }
   * );
   * // Результат: ['1. Item 1\n2. Item 2\n\n\n--- Страница 1 из 2 ---', '3. Item 3\n\n\n--- Страница 2 из 2 ---']
   * ```
   */
  chunkMessages<T>(items: T[], formatItem: (item: T, index: number) => string, options: ChunkOptions = {}): string[] {
    const {
      maxLength = this.DEFAULT_MAX_LENGTH,
      separator = this.DEFAULT_SEPARATOR,
      addPagination = false,
      paginationFormat = this.DEFAULT_PAGINATION_FORMAT,
    } = options;

    const chunks: string[] = [];
    let currentChunk = '';
    let currentIndex = 1;

    for (const item of items) {
      const itemMessage = formatItem(item, currentIndex++);
      const messageWithSeparator = currentChunk ? separator + itemMessage : itemMessage;

      if (currentChunk.length + messageWithSeparator.length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = itemMessage;
      } else {
        currentChunk += messageWithSeparator;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // Добавляем нумерацию страниц, если включено
    if (addPagination && chunks.length > 1) {
      return chunks.map((chunk, index) => chunk + paginationFormat(index + 1, chunks.length));
    }

    return chunks;
  }
}
