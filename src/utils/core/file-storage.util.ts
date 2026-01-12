/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable perfectionist/sort-classes */
import { Logger } from '@nestjs/common';
import crypto from 'crypto';
import * as fs from 'fs';
import * as Minio from 'minio';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import { env } from '../../config/env';

// Типы
interface PhotoAttachment {
  type: 'image';
  url?: string;
  file_id?: string;
  [key: string]: any; // для других возможных полей
}

interface UploadResult {
  success: boolean;
  url?: string;
  error?: Error;
}

// Настройка клиента MinIO
const minioClient = new Minio.Client({
  endPoint: env.S3_ENDPOINT,
  accessKey: env.S3_ACCESS_KEY,
  secretKey: env.S3_SECRET_KEY,
});

// Путь до папки с временными файлами
const TMP_DIR = path.join(__dirname, '../../../tmp');

export class FileStorageUtil {
  private logger = new Logger(FileStorageUtil.name);

  async ensureTempDir(): Promise<void> {
    await fs.promises.mkdir(TMP_DIR, { recursive: true });
  }

  private async saveStreamToFile(stream: ReadableStream<Uint8Array>, filePath: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeStream = Readable.fromWeb(stream as any);
    const fileStream = fs.createWriteStream(filePath);
    try {
      await pipeline(nodeStream, fileStream);
    } finally {
      fileStream.end();
    }
  }

  private async uploadToMinIO(fileName: string, filePath: string): Promise<void> {
    await minioClient.fPutObject(env.S3_BUCKET_NAME, fileName, filePath);
  }

  private getObjectUrl(objectName: string): string {
    return `${env.S3_BASE_URL}/${objectName}`;
  }

  private generateUniqueId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Формирует URL для загрузки фото на основе доступных данных
   * @param photo Объект фото с возможными полями url/file_id
   * @returns URL для скачивания или undefined, если данных недостаточно
   */
  private buildDownloadUrl(photo: PhotoAttachment): string | undefined {
    if (photo.url) return photo.url;

    if (photo.file_id) {
      // Замените на актуальный шаблон URL для вашего мессенджера
      return `https://api.messenger.com/file/bot${env.BOT_TOKEN}/${photo.file_id}`;
    }

    return undefined;
  }

  /**
   * Загружает одно фото в MinIO и возвращает результат
   * @param photo Объект фото для загрузки
   * @param orderId ID заказа для группировки в хранилище
   * @returns Результат загрузки (успех/ошибка + URL)
   */
  private async uploadSinglePhoto(photo: PhotoAttachment, orderId: string): Promise<UploadResult> {
    const downloadUrl = this.buildDownloadUrl(photo);

    if (!downloadUrl) {
      return {
        success: false,
        error: new Error('No valid URL or file_id provided for photo'),
      };
    }

    try {
      const uniqueId = this.generateUniqueId();
      const fileName = `courier-photos/${orderId}/${uniqueId}.jpg`;

      await this.ensureTempDir();
      const tempFilePath = path.join(TMP_DIR, `${uniqueId}.jpg`);

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch photo: ${response.status} ${response.statusText}`);
      }

      await this.saveStreamToFile(response.body!, tempFilePath);
      await this.uploadToMinIO(fileName, tempFilePath);

      const publicUrl = this.getObjectUrl(fileName);

      // Удаляем временный файл
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (cleanupError) {
        this.logger.warn(`Не удалось удалить временный файл ${tempFilePath}:`, cleanupError);
      }

      return { success: true, url: publicUrl };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Загружает фото в MinIO и возвращает массив публичных URL
   * @param photos Массив объектов фото (с полями url или file_id)
   * @param orderId ID заказа для группировки в хранилище
   * @returns Массив URL успешно загруженных фото
   */
  async uploadPhotos(photos: PhotoAttachment[], orderId: string): Promise<string[]> {
    const results = await Promise.all(photos.map(photo => this.uploadSinglePhoto(photo, orderId)));

    const successfulUrls = results
      .filter(result => result.success && result.url)
      .map(result => result.url!) as string[];

    // Логируем ошибки для диагностики
    const failedCount = results.filter(result => !result.success).length;
    if (failedCount > 0) {
      this.logger.warn(`${failedCount} фото не удалось загрузить для заказа ${orderId}`);
    }

    return successfulUrls;
  }
}
