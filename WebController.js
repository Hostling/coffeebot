require('dotenv').config();
const fs = require('fs');
const express = require('express'); // Библиотека для веб-морды
const nodemailer = require('nodemailer'); // Библиотека для отправки писем

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

class WebController {
  constructor(coffee, bot) {
    this.coffee = coffee;
    this.bot = bot;
    this.init();
  }

  init() {
    http.listen(4433, () => {
      console.log('Веб версия запущена на порту 4433');
    });

    //app.use(express.static('public'), express.static('public/images'), express.static('public/css'), express.static('public/js'));

    app.use(express.static('dist'));
    io.on('connection', (socket) => {
      // this.coffee.addSocket(socket);
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
      socket.on('chat', (msg) => {
        console.log(msg);
      });

      socket.on('register', (msg) => {
        this.register(msg, socket);
      });

      socket.on('auth', (msg) => {
        this.auth(msg, socket);
      });

      socket.on('tgMessage', (msg) => {
        this.tgMessage(msg);
      });

      socket.on('find_coffee', (msg) => {
        this.findCoffee(msg, socket);
      });

      socket.on('drink', (msg) => {
        this.drink(msg);
      });

      socket.on('disconnect', () => {
        this.disconnect(socket);
      });
    });
  }

  register(msg, socket) {
    function generateId() {
      let tempId = '';
      for (let i = 0; i < 6; i++) {
        tempId += Math.floor(Math.random() * 9);
      }
      return tempId;
    }

    function genTgId() {
      let tempId = '';
      for (let i = 0; i < 9; i++) {
        tempId += Math.floor(Math.random() * 9);
      }
      return tempId;
    }

    function sendCode(mail, code) {
      const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        secure: false, // Если порт 465, то true
        /*
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
        */
        tls: {
          rejectUnauthorized: false,
        },
      });

      const message = {
        from: `Coffeebot <${process.env.MAIL_USER}>`,
        to: mail,
        subject: 'Код авторизации для кофебота',
        text: `Привет! Твой код ${code}. Отправь его кофеботу для авторизации`,
      };

      const info = transporter.sendMail(message).then(() => { console.log(`Письмо на ${mail} успешно отправлено`) }).catch((err) => console.log('Ошибка отправки ', err));

    }

    if (msg.indexOf('@open.ru') !== -1) {
      if(this.coffee.isMailExists(msg)) {
        sendCode(msg, this.coffee.isMailExists(msg));
        socket.emit('successRegister', `Я отправил письмо с кодом авторизации на почту ${msg}. Отправь мне его, пожалуйста.`);
      } else {
        const id = generateId();

        this.coffee.addUser({
          id,
          mail: msg,
          tgId: genTgId(),
          state: 0,
          isAdmin: 0,
        });

        sendCode(msg, id);
        socket.emit('successRegister', `Я отправил письмо с кодом авторизации на почту ${msg}. Отправь мне его, пожалуйста.`);
      }
    }
  }

  auth(msg, socket) {
    const auth = this.coffee.tryWebAuth(msg, socket);
    if (auth) {
      socket.emit('successAuth', msg);
      if(this.coffee.getUserById(socket.handshake.query.token).location !== undefined) socket.emit('setbest', this.setBest(socket));
    } else {
      socket.emit('failedAuth', 'Не нашел пользователя с таким id');
    }
  }

  setBest(socket){
    const locations = JSON.parse(fs.readFileSync('locations.json', 'utf8'));
    const userLocation = this.coffee.getUserById(socket.handshake.query.token).location;
    const locationProps = locations[userLocation];
    socket.emit('setBest', JSON.stringify(locationProps));
  }

  tgMessage(msg) {
    try {
      this.bot.sendMessage(msg.id, msg.message);
      console.log(this.coffee.getNow(), `Отправлено ${msg.message} для ${msg.id}`);
    } catch (e) {
      console.error(this.coffee.getNow(), `Ошибка отправки сообщения ${e.stack}`);
    }
  }

  drink(msg) {
    this.coffee.drink(msg.id, msg.text);
    // Жуткий костыль с реализацией части логики тут
    // Перенести в класс this.coffee при рефакторинге
    const sender = this.coffee.getUserById(msg.id);
    if(sender.pair !== undefined) {
      if (!sender.pair.web) {
        try {
          this.bot.sendMessage(sender.pair.tgId, msg.text);
        } catch (e) {
          console.error(this.coffee.getNow(), `Ошибка отправки в TG: ${e.stack}`);
        }
      }
    }
  }

  findCoffee(msg, socket) {
    // Ждем от пользователя локацию и ставим в очередь, либо соединяем
    let findId = '';
    const checkFindId = this.coffee.getPeopleFromLocation(msg);
    this.coffee.setUserLocation(this.coffee.getUserById(socket.handshake.query.token).tgId, msg);

    checkFindId === undefined ? findId = -1 : findId = checkFindId;
    if (findId === -1) {
      // Если никого в очереди нет
      // socket.emit('message', 'Пока в очереди только ты...Как только кто-то захочет выпить - я обязательно тебе напишу!');
      try {
        this.coffee.addPeople({
          id: socket.handshake.query.token,
          user: 'WebUser',
          location: msg,
          socket,
        });
      } catch (e) {
        console.error(`Ошибка добавления пользователя в очередь: ${e.stack}`);
      }
    } else {
      // Получаем информацию о напарнике
      const pair = this.coffee.getPeople(findId);
      // Получаем информацию о себе
      const first = this.coffee.getUserById(socket.handshake.query.token);
      // Если человек в очереди есть, проверяем, что это не он сам
      if (first.id === pair.id) {
        socket.emit('message', 'В очереди все еще только ты..');
      } else {
        if (pair.socket) {
          // Пара из Web
          const second = this.coffee.getUserById(pair.id);
          try {
            // Шлем напарнику уведомление и отрисовываем кнопки в Web
            pair.socket.emit('finded', 'true');
            pair.socket.emit('message', 'Я нашел тебе пару для кофе! Пиши сюда, и общайся напрямую с коллегой');
          } catch (e) {
            console.error(`Ошибка отправки сообщения первому пользователю ${e.stack}`);
          }
          try {
            // Шлем себе уведомление и отрисовываем кнопки в Web
            socket.emit('finded', 'true');
            socket.emit('message', 'Я нашел тебе пару для кофе! Пиши сюда, и общайся напрямую с коллегой');
          } catch (e) {
            console.error(`Ошибка отправки сообщения второму пользователю ${e.stack}`);
          }
          this.coffee.pair(
            { tgId: first.tgId, socket },
            { tgId: second.tgId, socket: pair.socket },
          );
          // Спариваем на полчаса
          /*
          setTimeout(() => {
            if (socket.disconnected !== true) {
              socket.emit('message', 'Ваша пара расформирована');
              socket.emit('unpair', '');
              pair.socket.emit('message', 'Ваша пара расформирована');
              pair.socket.emit('unpair', '');
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

          try {
            // Шлем себе и напарнику уведомление
            socket.emit('finded', 'true');
            socket.emit('message', 'Я нашел тебе пару для кофе! Пиши сюда, и общайся напрямую с коллегой');
          } catch (e) {
            console.error(`Ошибка отправка сообщения первому пользователю ${e.stack}`);
          }
          try {
            this.bot.sendMessage(pair.id, 'Я нашел тебе пару для кофе! Пиши сюда, и общайся напрямую с коллегой. Только, пожалуйста, без фото :)');
            const exitButton = {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Выйти', callback_data: 'exit' }],
                ],
              }),
            };
            this.bot.sendMessage(pair.id, 'Чтобы выйти из этого чата, напиши мне "Выйти" без кавычек или нажми на эту кнопку: ', exitButton);
          } catch (e) {
            console.error(`Ошибка отправки сообщения второму пользователю ${e.stack}`);
          }

          this.coffee.pair(
            { tgId: first.tgId, socket },
            { tgId: second.tgId },
          );
          // Спариваем на полчаса
          /*
          setTimeout(() => {
            if (socket.disconnected !== true) {
              socket.emit('message', 'Ваша пара расформирована');
              socket.emit('unpair', '');
              bot.sendMessage(pair.id, 'Ваша пара расформирована');
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

  disconnect(socket) {
    const me = this.coffee.getUserById(socket.handshake.query.token);
    let secondTg = 0;
    // Расформировываем пару, если она была
    if (me.pair !== undefined) {
      try {
        if (me.pair.socket) {
          me.pair.socket.emit('unpair', '');
          secondTg = this.coffee.getUserById(me.pair.socket.handshake.query.token).tgId;
        } else {
          this.bot.sendMessage(me.pair.tgId, 'Чат закончен. Чтобы найти еще одного сочашечника, напиши мне любое сообщение.');
          secondTg = me.pair.tgId;
        }
        this.coffee.unpair(
          { tgId: me.tgId },
          { tgId: secondTg },
        );
        console.log(this.coffee.getNow(), `Пара ${socket.handshake.query.token} расформирована дисконнектом`);
      } catch (e) {
        console.error(`Ошибка расформирования пары ${e.stack}`);
      }
    }

    // Очищаем очередь, если в дисконнектнутый в ней был
    let findId = '';
    const checkFindId = this.coffee.getPeopleFromLocation(me.location);
    checkFindId === undefined ? findId = -1 : findId = checkFindId;
    if (findId !== -1) {
      const finded = this.coffee.getPeople(findId);
      if (finded.id === me.id || finded.tgIg === me.tgId) this.coffee.purgeLocation(me.location);
    }
  }
}

module.exports = WebController;
