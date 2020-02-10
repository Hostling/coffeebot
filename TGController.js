require('dotenv').config();
const nodemailer = require('nodemailer'); // Библиотека для отправки писем

class TGController {
  constructor(coffee, bot) {
    this.bot = bot;
    this.coffee = coffee;
    this.init();
  }

  init() {
    // Проверяем ответы из телеграма
    this.bot.on('message', (msg) => {
      this.message(msg);
    });

    // Парсим ответ от кнопок
    this.bot.on('callback_query', (msg) => {
      this.callbackQuery(msg);
    });
  }

  registerUser(msg) {
    // TODO:
    // Если пользователь уже регистрировался, но указывает другую почту, то удаляем старую запись

    function generateId() {
      let tempId = '';
      for (let i = 0; i < 6; i++) {
        tempId += Math.floor(Math.random() * 9);
      }
      return tempId;
    }

    function sendCode(mail, code) {
      const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        secure: false, // Если порт 465, то true
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        }
      });

      const message = {
        from: `Coffeebot <${process.env.MAIL_USER}>`,
        to: mail,
        subject: 'Код авторизации для кофебота',
        text: `Привет! Твой код ${code}. Отправь его кофеботу для авторизации`,
      };

      const info = transporter.sendMail(message);
      console.log(`Письмо успешно отправлено ${info}`);
    }

    if (msg.text.indexOf('@open.ru') !== -1) {
      if(this.coffee.isMailExists(msg.text)) {
        sendCode(msg.text, this.coffee.isMailExists(msg.text));
        this.coffee.setTrueTgId(this.coffee.isMailExists(msg.text), msg.from.id);
        this.bot.sendMessage(msg.from.id, `На почту ${msg.text} повторно выслал код авторизации. Отправь мне его, пожалуйста.`);
      } else {
        const id = generateId();

        this.coffee.addUser({
          id: id,
          mail: msg.text,
          tgId: msg.from.id,
          state: 0,
          isAdmin: 0,
        });

        sendCode(msg.text, id);
        this.bot.sendMessage(msg.from.id, `Я отправил письмо с кодом авторизации на почту ${msg.text}. Отправь мне его, пожалуйста.`);
      }
    } else if (msg.text.match('[0-9][0-9][0-9][0-9][0-9][0-9]')) {
      if (this.coffee.authUser(msg.from.id, msg.text)) {
        this.coffee.setTrueTgId(msg.text, msg.from.id);
        this.bot.sendMessage(msg.from.id, 'Это именно тот код, который я тебе присылал! Отправь мне любое сообщение, чтобы продолжить');
      } else {
        this.bot.sendMessage(msg.from.id, 'Код неверный :( Попробуй еще раз');
      }
    } else {
      this.bot.sendMessage(msg.from.id, `Привет, ${msg.from.first_name}, я кофебот! Давай зарегистрируемся? Введи, пожалуйста, свою рабочую почту в домене @open.ru или код из письма для авторизации.`);
    }
  }

  findPeople(msg, loc) {
    // Ждем от пользователя локацию и ставим в очередь, либо соединяем
    let findId = '';
    const checkFindId = this.coffee.getPeopleFromLocation(loc);

    checkFindId === undefined ? findId = -1 : findId = checkFindId;
    if (findId === -1) {
      // Если никого в очереди нет, то проверяем, что человека нет в других очередях
      let findId2 = '';
      const checkFindId2 = this.coffee.getPeopleFromTgId(msg.from.id);
      checkFindId2 === undefined ? findId2 = -1 : findId2 = checkFindId2;
      if (findId2 === -1) {
        try {
          this.bot.sendMessage(msg.from.id, 'Пока в очереди только ты...Как только кто-то захочет выпить - я обязательно тебе напишу!');
        } catch (e) {
          console.error(`Ошибка отправки сообщения в TG: ${e.stack}`);
        }
        try {
          this.coffee.addPeople({
            id: msg.from.id,
            user: msg.from.username,
            location: loc,
          });
        } catch (e) {
          console.error(`Ошибка добавления пользователя в очередь ${e.stack}`);
        }
      } else {
        // this.coffee.purgeLocation(myLocation);
        // TODO: добавить отрисовку кнопки выхода
        const options = {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: 'Выйти', callback_data: `quit#${findId2}` }],
            ],
          }),
        };
        this.bot.sendMessage(msg.from.id, `Ты уже стоишь в очереди в ${findId2}`, options);
      }
    } else {
      // TODO: отрисовать кнопки выйти и я тут
      // Если человек в очереди есть
      // Получаем информацию о напарнике
      const pair = this.coffee.getPeople(findId);
      // Получаем информацию о себе
      const first = this.coffee.getUserByTgId(msg.from.id);

      if (msg.from.id === pair.id) {
        this.bot.sendMessage(msg.from.id, 'В очереди все еще только ты..');
      } else {
        if (pair.socket) {
          // Пара из web
          const second = this.coffee.getUserById(pair.id);
          pair.socket.emit('finded', 'true');
          pair.socket.emit('message', 'Я нашел тебе пару для кофе! Пиши сюда, и общайся напрямую с коллегой');
          const exitButton = {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Выйти', callback_data: 'exit' }],
              ],
            }),
          };
          this.bot.sendMessage(msg.from.id, 'Я нашел тебе пару для кофе! Пиши сюда, и общайся напрямую с коллегой. Только, пожалуйста, без фото :)');
          this.bot.sendMessage(msg.from.id, 'Чтобы выйти из этого чата, напиши мне "Выйти" без кавычек или нажми на эту кнопку: ', exitButton);
          this.coffee.pair(
            { tgId: first.tgId },
            { tgId: second.tgId, socket: pair.socket },
          );
          // Спариваем на полчаса
          /*
          setTimeout(() => {
            if (this.coffee.getUserByTgId(first.tgId).pair) {
              pair.socket.emit('message', 'Ваша пара расформирована');
              pair.socket.emit('unpair', '');
              this.bot.sendMessage(msg.from.id, 'Ваша пара расформирована');
              this.coffee.unpair(
                { tgId: first.tgId },
                { tgId: second.tgId },
              );
            }
          }, 30000 * 60);
          */
        } else {
          // Пара из TG
          const second = this.coffee.getUserByTgId(pair.id);
          // Шлем себе и напарнику уведомление
          const exitButton = {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Выйти', callback_data: 'exit' }],
              ],
            }),
          };
          this.bot.sendMessage(pair.id, 'Я нашел тебе пару для кофе! Пиши сюда, и общайся напрямую с коллегой. Только, пожалуйста, без фото :)');
          this.bot.sendMessage(pair.id, 'Чтобы выйти из этого чата, напиши мне "Выйти" без кавычек или нажми на эту кнопку: ', exitButton);
          this.bot.sendMessage(msg.from.id, 'Я нашел тебе пару для кофе! Пиши сюда, и общайся напрямую с коллегой. Только, пожалуйста, без фото :)');
          this.bot.sendMessage(msg.from.id, 'Чтобы выйти из этого чата, напиши мне "Выйти" без кавычек или нажми на эту кнопку: ', exitButton);
          this.coffee.pair(
            { tgId: first.tgId },
            { tgId: second.tgId },
          );
          // Спариваем на полчаса
          /*
          setTimeout(() => {
            if (this.coffee.getUserByTgId(first.tgId).pair) {
              this.bot.sendMessage(pair.id, 'Ваша пара расформирована');
              this.bot.sendMessage(msg.from.id, 'Ваша пара расформирована');
              this.coffee.unpair(
                { tgId: first.tgId },
                { tgId: second.tgId },
              );
            }
          }, 30000 * 60);
          */
        }
        this.coffee.purgeLocation(findId);
      }
    }
  }

  inSearch(msg) {
    const options = {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: 'Да', callback_data: 'yes_0' }],
          [{ text: 'Нет', callback_data: 'no' }],
        ],
      }),
    };
    this.bot.sendMessage(msg.from.id, `Привет, ${msg.from.first_name}, я кофебот! Найти тебе сочашечника?`, options);
  }

  drink(msg) {
    const sender = this.coffee.getUserByTgId(msg.from.id);
    this.coffee.drink(sender.id, msg.text);
    // Жуткий костыль с реализацией части с отправкой в TG в этом файле
    // Перенести в класс this.coffee при рефакторинге
    if(sender.pair !== undefined) {
      if (!sender.pair.web) {
        try {
          this.bot.sendMessage(sender.pair.tgId, msg.text);
        } catch (e) {
          console.error(`Ошибка отправки в TG: ${e.stack}`);
        }
      }
    }
  }

  exitPair(msg) {
    const sender = this.coffee.getUserByTgId(msg.from.id);
    if (sender.state !== 3) this.bot.sendMessage(msg.from.id, 'Вы не находитесь в паре');
    if(sender.pair !== undefined) {
      if (sender.pair.web) {
        sender.pair.socket.emit('unpair', '');
        this.bot.sendMessage(msg.from.id, 'Чат закончен. Чтобы найти еще одного сочашечника, напиши мне любое сообщение.');
        this.coffee.unpair(
          { tgId: sender.tgId },
          { tgId: sender.pair.tgId },
        );
      } else {
        this.bot.sendMessage(msg.from.id, 'Чат закончен. Чтобы найти еще одного сочашечника, напиши мне любое сообщение.');
        this.bot.sendMessage(sender.pair.tgId, 'Чат закончен. Чтобы найти еще одного сочашечника, напиши мне любое сообщение.');
        this.coffee.unpair(
          { tgId: sender.tgId },
          { tgId: sender.pair.tgId },
        );
      }
    }
  }

  message(msg) {
    if (msg.text.toUpperCase() === 'ВЫЙТИ') {
      this.exitPair(msg);
    } else {
      /*
          state 0 = Регистрация.
            Только TG.
          state 1 = Зарегистрирован. Авторизован(Web). Выбор локации.
            Только TG.
          state 2 = Стоит в очереди.
            TG: заглушка "Ты уже в очереди" и кнопка "выйти"
            Web: кнопка "Выйти из очереди"
          state 3 = Разговаривают
            Длительность 30 минут, либо до выхода одного из очереди.
            Перенаправление сообщений через кофебота
            TG: кнопка "я тут", кнопка "Выйти"
            Web: кнопка "я тут", кнопка "Выйти"
      */
      let state = 0;
      const checkState = this.coffee.getUserState(msg);
      checkState ? state = checkState : state = 0;

      switch (state) {
        case 1:
          this.inSearch(msg);
          break;
        case 2:
          this.findPeople(msg);
          break;
        case 3:
          this.drink(msg);
          break;
        default:
          this.registerUser(msg);
          break;
      }
    }
  }

  callbackQuery(msg) {
    const goToLocation = (msg, location) => {
      this.coffee.setUserLocation(msg.from.id, location);
      const options = {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: 'Сейчас', callback_data: 'rightnow' }],
            // [{ text: 'Есть пожелания', callback_data: 'now_1_0_0_0' }],
          ],
        }),
      };
      this.bot.sendMessage(msg.from.id, 'Готов прямо сейчас?', options);
    }
    switch (msg.data) {
      case 'yes_0':
        const options = {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: 'Москва, Летниковская', callback_data: 'mos_1' }],
              [{ text: 'Москва, Спартаковская', callback_data: 'mos_2' }],
              [{ text: 'Москва, Котельническая', callback_data: 'mos_3' }],
              [{ text: 'Москва, Электрозаводская', callback_data: 'mos_4' }],
              [{ text: 'Саратов, Орджоникизде', callback_data: 'sar_1' }],
              [{ text: 'Саратов, Шелковичная', callback_data: 'sar_2' }],
              [{ text: 'Саратов, Мирный переулок', callback_data: 'sar_3' }],
              [{ text: 'Казань, Лево-Булачная', callback_data: 'kaz_1' }],
              [{ text: 'Ханты-Мансийск, Мира', callback_data: 'hant_1' }],
            //  [{ text: 'Новосибирск, Добролюбова', callback_data: 'nov_1' }],
            //  [{ text: 'Новосибирск, Кирова', callback_data: 'nov_2' }],
            //  [{ text: 'Екатеринбург, Толмачева', callback_data: 'ekat_1' }],
            //  [{ text: 'Хабаровск, Амурский бульвар', callback_data: 'hab_1' }],
            //  [{ text: 'Ханты-Мансийск, Мира', callback_data: 'hant_1' }],
            ],
          }),
        };
        this.bot.sendMessage(msg.from.id, 'В какой локации искать сочашечника?', options);
        break;
      case 'no':
        this.bot.sendMessage(msg.from.id, 'Жаль. Ты можешь написать мне в любое время, когда захочешь кофе.');
        break;
      case 'mos_1':
        goToLocation(msg, 'mos_1');
        break;
      case 'mos_2':
        goToLocation(msg, 'mos_2');
        break;
      case 'mos_3':
        goToLocation(msg, 'mos_3');
        break;
      case 'mos_4':
        goToLocation(msg, 'mos_4');
        break;
      case 'sar_1':
        goToLocation(msg, 'sar_1');
        break;
      case 'sar_2':
        goToLocation(msg, 'sar_2');
        break;
      case 'sar_3':
        goToLocation(msg, 'sar_3');
        break;
      case 'nov_1':
        goToLocation(msg, 'nov_1');
        break;
      case 'nov_2':
        goToLocation(msg, 'nov_2');
        break;
      case 'kaz_1':
        goToLocation(msg, 'kaz_1');
        break;
      case 'ekat_1':
        goToLocation(msg, 'ekat_1');
        break;
      case 'hab_1':
        goToLocation(msg, 'hab_1');
        break;
      case 'hant_1':
        goToLocation(msg, 'hant_1');
        break;
      case 'rightnow':
        this.findPeople(msg, this.coffee.getUserByTgId(msg.from.id).location);
        break;
      case 'exit':
        exitPair(msg);
        break;
    }

    // Обработка выхода из очереди
    if (msg.data.substr(0, 4) === 'quit') {
      const location = msg.data.split('#')[1];
      this.coffee.purgeLocation(location);
      this.bot.sendMessage(msg.from.id, `Ты вышел из очереди ${location}. Напиши мне, когда захочешь кофе.`);
    }
    // Отдельная логика для расширенного сценария
    /*
    if (msg.data.substr(0, 5) === 'now_1') {
      // Разбираем строку по параметрам

      const answers = msg.data.split('_');
      let options = {};
      switch (true) {
        case answers[2] === 0 && answers[3] === 0 && answers[4] === 0:
          // now_1_0_0_0 Первый запрос "Когда будет удобно?"
          // now_1_1_0_0 = сейчас
            // now_1_2_0_0 = 10 минут
            // now_1_3_0_0 = 30 минут
            // now_1_4_0_0 = 60 минут
            options = {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Сейчас', callback_data: 'now_1_1_0_0' }],
                  [{ text: 'Через 10 минут', callback_data: 'now_1_2_0_0' }],
                  [{ text: 'Через 30 минут', callback_data: 'now_1_3_0_0' }],
                  [{ text: 'Через час', callback_data: 'now_1_4_0_0' }],
                ],
              }),
            };
            this.bot.sendMessage(msg.from.id, 'Когда будет удобно?', options);
            break;
          case answers[2] !== 0 && answers[3] === 0 && answers[4] === 0:
            // Второй запрос "О чем хотелось бы пообщаться?"
            // now_1_х_1_0 = Обо всем понемногу
            // now_1_x_2_0 = О работе
            // now_1_x_3_0 = Определимся на месте
            options = {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Обо всем понемногу', callback_data: `now_1_${answers[2]}_1_0` }],
                  [{ text: 'О работе', callback_data: `now_1_${answers[2]}_2_0` }],
                  [{ text: 'Определимся на месте', callback_data: `now_1_${answers[2]}_3_0` }],
                ],
              }),
            };
            this.bot.sendMessage(msg.from.id, 'О чем хотелось бы пообщаться?', options);
            break;
          case answers[2] !== 0 && answers[3] !== 0 && answers[4] === 0:
            // Третий запрос "Кто платит?"
            // now_1_x_x_1 = Каждый за себя
            // now_1_x_x_2 = Подбросить монетку
            options = {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Каждый за себя', callback_data: `now_1_${answers[2]}_${answers[3]}_1` }],
                  [{ text: 'Подбросить монетку', callback_data: `now_1_${answers[2]}_${answers[3]}_2` }],
                ],
              }),
            };
            this.bot.sendMessage(msg.from.id, 'Кто платит?', options);
            break;
          default:
            // Пришел запрос со всеми данными
            const time = {
              1: 'сейчас',
              2: 'через 10 минут',
              3: 'через 30 минут',
              4: 'через час',
            };
            const about = {
              1: 'обо всем понемногу',
              2: 'о работе',
              3: 'определимся на месте',
            };
            const pay = {
              1: 'каждый за себя',
              2: 'подбросить монетку',
            };
            this.bot.sendMessage(msg.from.id, `Ты хочешь встретиться ${time[answers[2]]}, поговорить ${about[answers[3]]} и платит ${pay[answers[4]]}`);
            break;
        }
      }
      */
  }
}

module.exports = TGController;
