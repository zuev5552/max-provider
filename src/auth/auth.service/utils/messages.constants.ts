export const MESSAGES = {
  SMS_COOLDOWN: (minutesLeft: number) => `Код уже был отправлен. Повторно можно запросить через ${minutesLeft} мин.`,
  SMS_SENT: (phone: string) => `Код отправлен на ${phone}. Введите 4 цифры. Повторно запросить код можно через 30 мин.`,
  NEW_SMS_SENT: (phone: string) =>
    `Новый код отправлен на ${phone}. Введите 4 цифры. Повторно запросить код можно через 30 мин.`,
  PHONE: 'Введите номер в формате 79991234567',
  PHONE_NOT_FOUND: 'Такого телефона нет в базе. Обратитесь к управляющему.',
  FULLNAME_NOT_FOUND: 'Имя не найдено среди сотрудников с этим телефоном. Проверьте написание и попробуйте снова.',
  CODE_INVALID: 'Введите 4 цифры кода',
  CODE_ERROR: 'Ошибка обработки кода',
  STAFF_NOT_FOUND: 'Произошла ошибка: не найден сотрудник. Начните заново.',
  REGISTRATION_FAILED: 'Произошла ошибка при сохранении данных. Попробуйте позже.',
  ATTEMPTS_EXCEEDED: 'Вы использовали все 10 попыток. Регистрация отменена. Начните заново с /auth_start',
  ATTEMPT_FAILED: (remaining: number) => `Неверный код. Осталось попыток: ${remaining}. Введите 4 цифры.`,
  ALREADY_REGISTERED: (firstName: string, lastName: string) =>
    `Этот номер уже привязан к учётной записи ${firstName} ${lastName}.`,
  SESSION_NOT_FOUND: 'Нет активной сессии аутентификации. Начните с /auth_start',
  STEP_MISMATCH: 'Сейчас нельзя запросить новый код. Следуйте инструкциям.',
  SMS_SEND_ERROR: 'Не удалось отправить код подтверждения. Попробуйте позже.',
  AUTH_START_COOLDOWN: (minutesLeft: number) =>
    `Вы недавно запрашивали код подтверждения. Повторно начать авторизацию можно через ${minutesLeft} мин.`,
  AUTH_START_INSTRUCTIONS: 'Для регистрации в системе введите ваш телефон в формате +79991234567',
  FULLNAME_PROMPT: (namesList: string) =>
    `Найден(ы) сотрудник(ы): ${namesList}.\nУкажите ваше полное имя (ФИО) точно как в системе.`,
  SUCCESS_AUTH: (lastName: string, firstName: string) =>
    `Успешно! ${lastName} ${firstName} успешно авторизован. 
Для запуска введите команду /start`,
};
