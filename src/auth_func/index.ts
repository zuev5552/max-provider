// import { Bot, Context } from '@maxhub/max-bot-api';
// import { Logger } from '@nestjs/common';
// import { PrismaService } from '../../prisma/prisma.service';
// import { Staff, StaffMax } from '@prisma/client';

// type Session = {
//   step: 'awaiting_phone' | 'awaiting_fullname' | 'awaiting_code';
//   phone: string | null;
//   fullname: string | null;
//   code: number | null;
//   possibleStaff: Staff[] | null;
//   matchedStaff: Staff | null;
//   createdAt: Date;
//   chatId: number | null;
// };

// const prisma = new PrismaService();

// export function authDialogue(bot: Bot) {
//   const logger = new Logger('authDialogue');
//   const sessions = new Map<number, Session>();

//   const SESSION_TIMEOUT = 600_000;

//   const setupSessionTimeout = (chatId: number) => {
//     setTimeout(() => {
//       if (sessions.has(chatId)) {
//         sessions.delete(chatId);
//         logger.log(`Сессия ${chatId} удалена по таймауту`);
//       }
//     }, SESSION_TIMEOUT);
//   };

//   const isValidPhone = (phone: string): boolean => {
//     return /^\+[1-9]\d{6,14}$/.test(phone.trim());
//   };

//   const findStaffByPhone = async (phone: string): Promise<Staff[]> => {
//     try {
//       return await prisma.staff.findMany({
//         where: {
//           phoneNumber: phone,
//           status: { in: ['Active', 'Suspended'] },
//         },
//         select: {
//           id: true,
//           firstName: true,
//           lastName: true,
//         },
//       });
//     } catch (error) {
//       logger.error(`Ошибка при поиске сотрудников по телефону ${phone}: ${error.message}`);
//       return [];
//     }
//   };

//   const hasIdMax = async (staffId: number): Promise<boolean> => {
//     try {
//       const staffMax = await prisma.staffMax.findUnique({
//         where: { staffId },
//       });
//       return !!staffMax;
//     } catch (error) {
//       logger.error(`Ошибка проверки id_max для staffId ${staffId}: ${error.message}`);
//       return false;
//     }
//   };

//   const generateCode = (): number => {
//     return Math.floor(1000 + Math.random() * 9000);
//   };

//   async function safeReply(ctx: Context, text: string): Promise<void> {
//     try {
//       await ctx.reply(text);
//     } catch (error) {
//       logger.error(`Ошибка отправки сообщения: ${error.message}`);
//     }
//   }

//   bot.action('auth_start', async (ctx: Context) => {
//     const chatId = ctx.chatId ?? null;
//     if (!chatId) {
//       await safeReply(ctx, 'Не удалось определить чат. Попробуйте снова.');
//       return;
//     }

//     sessions.set(chatId, {
//       step: 'awaiting_phone',
//       phone: null,
//       fullname: null,
//       code: null,
//       possibleStaff: null,
//       matchedStaff: null,
//       createdAt: new Date(),
//       chatId,
//     });

//     await safeReply(ctx, 'Для регистрации в системе введите ваш телефон в формате +79991234567');
//     logger.log(`[start] Сессия создана для chatId: ${chatId}`);
//     setupSessionTimeout(chatId);
//   });

//   bot.on('message_created', async (ctx: Context, next) => {
//     const chatId = ctx.chatId ?? null;
//     if (!chatId) {
//       logger.log('[message_created] Не найден chatId');
//       return next();
//     }

//     const session = sessions.get(chatId);
//     if (!session) {
//       return next();
//     }

//     const inputText = ctx.message?.body?.text?.trim();

//     if (!inputText) {
//       await safeReply(ctx, 'Пожалуйста, введите номер телефона текстом в формате +79991234567');
//       return;
//     }

//     try {
//       if (session.step === 'awaiting_phone') {
//         if (!isValidPhone(inputText)) {
//           await safeReply(ctx, 'Введите номер в формате +79991234567');
//           return next();
//         }

//         const staffList = await findStaffByPhone(inputText.replace('+', ''));

//         if (staffList.length === 0) {
//           await safeReply(ctx, 'Такого телефона нет в базе. Обратитесь к управляющему.');
//           sessions.delete(chatId);
//           logger.log(`[phone_not_found] Телефон ${inputText} не найден для chatId: ${chatId}`);
//           return next();
//         }

//         session.possibleStaff = staffList;
//         session.phone = inputText;

//         if (staffList.length === 1) {
//           const singleStaff = staffList[0];
//           const hasIdMaxResult = await hasIdMax(singleStaff.id);

//           if (hasIdMaxResult) {
//             await safeReply(
//               ctx,
//               `Этот номер уже привязан к учётной записи ${singleStaff.firstName} ${singleStaff.lastName}.`,
//             );
//             sessions.delete(chatId);
//             logger.log(`[already_registered] Номер привязан к staffId ${singleStaff.id} для chatId: ${chatId}`);
//             return;
//           }

//           session.matchedStaff = singleStaff;
//           session.step = 'awaiting_code';
//           session.code = generateCode();

//           await safeReply(ctx, `Код отправлен на ${session.phone}. Введите 4 цифры. У вас одна попытка.`);
//           logger.log(`[awaiting_code] Код сгенерирован для chatId: ${chatId}`);
//         } else {
//           session.step = 'awaiting_fullname';
//           const namesList = staffList.map(s => `${s.firstName} ${s.lastName}`).join(', ');
//           await safeReply(
//             ctx,
//             `Найден(ы) сотрудник(ы): ${namesList}.\nУкажите ваше полное имя (ФИО) точно как в системе.`,
//           );
//           logger.log(`[awaiting_fullname] Запрошено ФИО для chatId: ${chatId}`);
//         }

//         setupSessionTimeout(chatId);
//       } else if (session.step === 'awaiting_fullname') {
//         const fullname = inputText.toLowerCase();
//         const matchedStaff = session.possibleStaff?.find(
//           staff => `${staff.firstName} ${staff.lastName}`.toLowerCase() === fullname,
//         );

//         if (!matchedStaff) {
//           await safeReply(
//             ctx,
//             'Имя не найдено среди сотрудников с этим телефоном. Проверьте написание и попробуйте снова.',
//           );
//           return;
//         }

//         const hasIdMaxResult = await hasIdMax(matchedStaff.id);
//         if (hasIdMaxResult) {
//           await safeReply(
//             ctx,
//             `Этот номер уже привязан к учётной записи ${matchedStaff.firstName} ${matchedStaff.lastName}.`,
//           );
//           sessions.delete(chatId);
//           logger.log(`[already_registered] Номер привязан к staffId ${matchedStaff.id} для chatId: ${chatId}`);
//           return;
//         }

//         session.fullname = inputText;
//         session.matchedStaff = matchedStaff;
//         session.step = 'awaiting_code';
//         session.code = generateCode();

//         await safeReply(ctx, `Код отправлен на ${session.phone}. Введите 4 цифры. У вас одна попытка.`);
//         logger.log(`[awaiting_code] Код сгенерирован для chatId: ${chatId}`);
//         setupSessionTimeout(chatId);
//       } else if (session.step === 'awaiting_code') {
//         if (!/^\d{4}$/.test(inputText)) {
//           await safeReply(ctx, 'Введите 4 цифры кода');
//           return;
//         }

//         const code = parseInt(inputText, 10);
//         if (isNaN(code)) {
//           await safeReply(ctx, 'Ошибка обработки кода');
//           return;
//         }

//         if (code === session.code) {
//           try {
//             // Сохраняем связь staffId с idMax (chatId) в базу
//             await prisma.staffMax.create({
//               data: {
//                 staffId: session.matchedStaff.id,
//                 idMax: chatId,
//               },
//             });

//             await safeReply(ctx, `Успешно! Номер ${session.phone} зарегистрирован.`);
//             sessions.delete(chatId);
//             logger.log(`[success] Регистрация завершена для chatId: ${chatId}, staffId: ${session.matchedStaff.id}`);
//           } catch (saveError) {
//             logger.error(`Ошибка сохранения id_max для staffId ${session.matchedStaff.id}: ${saveError.message}`);
//             await safeReply(ctx, 'Произошла ошибка при сохранении данных. Попробуйте позже.');
//             sessions.delete(chatId);
//           }
//         } else {
//           await safeReply(ctx, 'Неверный код. Регистрация отменена. Начните заново с /auth_start');
//           sessions.delete(chatId);
//           logger.log(`[failed] Неверный код для chatId: ${chatId}`);
//         }
//       } else {
//         logger.warn(`Неизвестная стадия сессии для chatId ${chatId}: ${session.step}`);
//         await safeReply(ctx, 'Произошла ошибка состояния. Начните заново с /auth_start');
//         sessions.delete(chatId);
//       }
//     } catch (error) {
//       logger.error(`Ошибка обработки сообщения: ${error.message}`);
//       await safeReply(ctx, 'Произошла ошибка, попробуйте позже');
//       sessions.delete(chatId); // При критической ошибке — завершаем сессию
//     }
//   });
// }
