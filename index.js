"use strict";
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api'); //Библиотека для TelegramAPI
const nodemailer = require('nodemailer'); //Библиотека для отправки писем
const express = require('express'); //Библиотека для веб-морды
const fs = require("fs");
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

http.listen(4433, function () {
  console.log(`Веб версия запущена на порту 4433`);
});


app.use(express.static('public'), express.static('public/images'), express.static('public/css'), express.static('public/js'));



io.on('connection', (socket) => {
  coffee.addSocket(socket);
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

  socket.on('auth', (msg) => {
    let auth = coffee.tryWebAuth(msg, socket);
    if(auth) {
      socket.emit('successAuth', msg);
      console.log(`Авторизация ${msg} успешна`);
    } else {
      socket.emit('failedAuth', `Не нашел пользователя с таким id`);
      console.log(`Код ${msg} не найден`);
    }
  });

  socket.on('tgMessage', (msg) => {
    console.log(`Отправлено ${msg.message} для ${msg.id}`);
    bot.sendMessage(msg.id, msg.message);
  });

  socket.on('find_coffee', (msg) => {
    //Ждем от пользователя локацию и ставим в очередь, либо соединяем
    let findId = '';
    let checkFindId = coffee.getPeopleFromLocation(msg);
    checkFindId == undefined ? findId = -1 : findId = checkFindId;
    if(findId == -1) {
    	socket.emit('message', 'Пока в очереди только ты...Как только кто-то захочет выпить - я обязательно тебе напишу!');
      coffee.addPeople({
    		id: socket.handshake.query.token,
    		user: 'WebUser',
        location: msg,
        socket: socket
    	});
    } else {
      socket.emit('message', `Кто-то с твоей локации тоже захотел кофе! Можешь писать прямо сюда и я перешлю ему все твои сообщения!`);
      pair.socket.emit('finded', 'true');
      let pair = coffee.getPeople(findId);
      if(pair.socket) {
        //Пара из Web
        pair.socket.emit('message', `Нашелся коллега из твоей локации, который тоже готов пойти пить кофе! Можешь писать прямо сюда и я перешлю ему все твои сообщения!`);
        pair.socket.emit('finded', 'true');
        coffee.pair({socket: socket},{socket: pair.socket});
        //Спариваем на полчаса
        setTimeout(coffee.unpair({socket: socket},{socket: pair.socket}), 30000 * 60);
      } else {
        //Пара из TG
        bot.sendMessage(pair.id, 'Коллега с веб версии бота хочет попить с тобой кофе!');
        coffee.pair({socket: socket},{tgId: pair.id});
        //Спариваем на полчаса
        setTimeout(coffee.unpair({socket: socket},{tgId: pair.id}), 30000 * 60);
      }
    	//Ставим им обоим state = 3 на 30 минут и отрисовываем кнопки "выйти" и "я тут"

    	coffee.purgeLocation(findId);
    }
  });

  socket.on('drink', (msg) => {
    coffee.drink(msg.id, msg.text);
  });

});
/*
Если нет хостинга с ssl сертификатом, то можно включить polling, но тогда понадобится прокси
https://hidemy.name/ru/proxy-list/
let bot = new TelegramBot(token, { polling: true, request: { proxy: 'http://177.22.225.237:3128', } });
*/

const TOKEN = process.env.TG_TOKEN;

const options = {
  webHook: {
    port: 8443,
    key: `${__dirname}${process.env.SSL_KEY}`,
    cert: `${__dirname}${process.env.SSL_CERT}`,
    has_custom_certificate: false
  }
};

const url = `${process.env.HOST_DOMAIN}:8443`;
const bot = new TelegramBot(TOKEN, options);

/*
bot.setWebHook(`${url}/bot${TOKEN}`, {
  certificate: `@${options.webHook.cert}`,
});
*/

class Coffee {
  constructor() {
    this.people = [];
    this.userStorage = [];
    this.sockets = [];
  }

  drink(id, msg) {
    let sender = getUserById(id);
    if(sender.pair.tgId) {
      //Если у получателя TG
      bot.sendMessage(sender.pair.tgId, msg);
    } else {
      let socket = sender.pair.socket;
      socket.emit('message', msg);
    }
  }

  pair(one, two) {
    let first = this.userStorage[this.findStorageByTgId(one.tgId)];
    let second = this.userStorage[this.findStorageByTgId(two.tgId)];
    first.state = 3;
    second.state = 3;
    one.socket ? second.pair.socket = one.socket : second.pair.tgId = one.tgId;
    two.socket ? first.pair.socket = two.socket : first.pair.tgId = two.tgId;
  }
  unpair(one, two) {
    let first = this.userStorage[this.findStorageByTgId(one.tgId)];
    let second = this.userStorage[this.findStorageByTgId(two.tgId)];
    first.state = 1;
    second.state = 1;
    first.pair = null;
    second.pair = null;
  }

  addSocket(socket) {
    this.sockets.push(socket);
    //console.log('Массив сокетов' + this.sockets);
    //console.log('Хендшейк первого:' + this.sockets[0].handshake)
    //this.sockets[0].emit('message', 'Ты первый');
  }

  getSockets() {
    return this.sockets;
  }

  tryWebAuth(code, socket) {
    console.log(`Прислан код: ${code}`);
    let user = this.getUserById(code);
    if(user != '') {
      user.socket = socket;
      return user;
    } else {
      return false;
    }
  }

  getUserById(id) {
    let trueId = '';
    for(let i = 0; i < this.userStorage.length; i++){
        if(this.userStorage[i].id == id){
          trueId = this.userStorage[i];
        }
    }
    return trueId;
  }

  readFromDB() {
    let tempJSONPeople = JSON.parse(fs.readFileSync('people.db', 'utf8'));
    let tempJSONUs = JSON.parse(fs.readFileSync('us.db', 'utf8'));

    this.people = Object.keys(tempJSONPeople).map(e => tempJSONPeople[e]);
    this.userStorage = Object.keys(tempJSONUs).map(e => tempJSONUs[e]);
  }
  writeToDB() {
    let tempJSONPeople = new Object();
    for(let i = 0; i < this.people.length;i++){
      tempJSONPeople[`${i}`] = this.people[i];
    }
    let tempJSONUs = new Object();
    for(let i = 0; i < this.userStorage.length;i++){
      tempJSONUs[`${i}`] = this.userStorage[i];
    }

    fs.writeFile('people.db', JSON.stringify(tempJSONPeople));
    fs.writeFile('us.db', JSON.stringify(tempJSONUs));
  }

  getUserState(msg) {
    if(this.userStorage.length > 0) {
      if(this.findStorageByTgId(msg.from.id) !== '') {
        return this.userStorage[this.findStorageByTgId(msg.from.id)].state;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  addUser(user) {
    this.userStorage.push(user);
    this.writeToDB();
    console.log(this.userStorage);
  }

  getPeopleFromLocation(loc) {
    let match = undefined;
    for(let i = 0; i < this.people.length; i++){
        if(this.people[i].location == loc){
          match = i;
        }
    }
    return match;
  }

  addPeople(people) {
    this.people.push(people);
    this.writeToDB();
    console.log(this.people);
  }

  purgeLocation(id) {
    this.people.splice(id, 1);
    this.writeToDB();
  }

  getPeople(id) {
    return this.people[id];
  }

  findStorageByTgId(tg) {
    let storageId = '';
    for(let i = 0; i < this.userStorage.length; i++){
        if(this.userStorage[i].tgId == tg){
          storageId = i;
        }
    }
    return storageId;
  }

  getUserByTgId(tg) {
    return this.userStorage[this.findStorageByTgId(tg)];
  }
  setUserLocation(tg, loc) {
    this.userStorage[this.findStorageByTgId(tg)].location = loc;
  }

  authUser(tg, code) {
    if(this.findStorageByTgId(tg) !== '') {
      if(this.userStorage[this.findStorageByTgId(tg)].id == code){
        this.userStorage[this.findStorageByTgId(tg)].state = 1;
        this.writeToDB();
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
}


let coffee = new Coffee();
coffee.readFromDB();

let sendToZero = (zero) => zero == undefined ? true : zero.emit('message', `54321 ${JSON.stringify(coffee.getSockets())}`);

setInterval(sendToZero, 2000, coffee.getSockets[0]);

function registerUser(msg) {
  //TODO: Если пользователь уже регистрировался, но указывает другую почту, то удаляем старую запись
  if(msg.text.indexOf('@open.ru') != -1) {
    if(coffee.findStorageByTgId(msg.from.id) !== '') {
      bot.sendMessage(msg.from.id, `На почту ${coffee.getUserByTgId(msg.from.id).mail} я уже отправлял код авторизации. Отправь мне его, пожалуйста.`);
    } else {
      let id = generateId();

      coffee.addUser({
        id: id,
        mail: msg.text,
        tgId: msg.from.id,
        state: 0,
        isAdmin: 0
      });

      sendCode(msg.text, id);
      bot.sendMessage(msg.from.id, `Я отправил письмо с кодом авторизации на почту ${msg.text}. Отправь мне его, пожалуйста.`);
      }
    } else if(msg.text.match('[0-9][0-9][0-9][0-9][0-9][0-9]')){
        if(coffee.authUser(msg.from.id, msg.text)){
          bot.sendMessage(msg.from.id, `Это именно тот код, который я тебе присылал! Отправь мне любое сообщение, чтобы продолжить`);
        } else {
          bot.sendMessage(msg.from.id, `Код неверный :( Попробуй еще раз`);
        }
    } else {
       bot.sendMessage(msg.from.id, `Привет, ${msg.from.first_name}, я кофебот!	Давай зарегистрируемся? Введи, пожалуйста, свою рабочую почту в домене @open.ru или код из письма для авторизации.`);
     }

  function generateId() {
      let tempId = '';
      for(let i = 0; i < 6; i++) {
        tempId += Math.floor(Math.random() * 9);
      }
      return tempId;
  }

  function sendCode(mail, code) {

    let transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        secure: true, //Если порт 465, то true
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS
        }
    });

    let message = {
      from: `Coffeebot <${process.env.MAIL_USER}>`,
      to: mail,
      subject: 'Код авторизации для кофебота',
      text: `Привет! Твой код ${code}. Отправь его кофеботу для авторизации`
    };

    let info = transporter.sendMail(message);
    console.log(`Письмо успешно отправлено ${info}`);
  }
}

function findPeople(msg, loc) {
  let findId = '';
  let checkFindId = coffee.getPeopleFromLocation(loc);

  checkFindId == undefined ? findId = -1 : findId = checkFindId;
	if(findId == -1) {
		bot.sendMessage(msg.from.id, 'Пока в очереди только ты...Как только кто-то захочет выпить - я обязательно тебе напишу!');
    coffee.addPeople({
			id: msg.from.id,
			user: msg.from.username,
      location: loc
		});
	} else {
		bot.sendMessage(msg.from.id, `${coffee.getPeople(findId).user} тоже хочет кофе! Найди его по ссылке t.me/${coffee.getPeople(findId).user} Сейчас я его тоже приглашу к тебе!`);
		bot.sendMessage(coffee.getPeople(findId).id, `${msg.from.first_name} хочет попить с тобой кофе! Найди его по ссылке t.me/${msg.from.username}`);
		coffee.purgeLocation(findId);
	}
}

function inSearch(msg){
  let options = {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{text: 'Да', callback_data: 'yes_0'}],
        [{text: 'Нет', callback_data: 'no'}]
      ]
    })
  };
  bot.sendMessage(msg.from.id, `Привет, ${msg.from.first_name}, я кофебот!	Найти тебе сочашечника?`, options);
}

function inQuery(msg) {
  //TODO
}

//Проверяем ответы из телеграма
bot.on('message', function (msg) {
    if(msg.from.id == 214301633 || msg.from.id == 266462121 || msg.from.id == 235937232 || msg.from.id == 143687638) {
      if(msg.text == 'SecretRebootMessage'){
        notExistedFunction();
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
          Длительность 30 секунд, либо до выхода одного из очереди.
          Перенаправление сообщений через кофебота
          TG: кнопка "я тут", кнопка "Выйти"
          Web: кнопка "я тут", кнопка "Выйти"
        */
        let state = 0;
        let checkState = coffee.getUserState(msg);
        checkState ? state = checkState : state = 0;

        switch(state){
          case 1:
            inSearch(msg);
            break;
          case 2:
            findPeople(msg);
            break;
          case 3:
            inQuery(msg);
            break;
          default:
            registerUser(msg);
            break;
        }
      }
    } else {
      console.log(`В заглушку долбится сообщением ${msg.from.first_name} ${msg.from.last_name} с id ${msg.from.id}`);
      bot.sendMessage(msg.from.id, 'Привет, я кофебот, и я немного устал. Скоро я вернусь в улучшенной версии и общаться со мной станет еще удобнее. Я пришлю тебе сообщение, когда обновлюсь.');
    }

});

//Парсим ответ от кнопок
bot.on('callback_query', function (msg) {
  if(msg.from.id == 214301633 || msg.from.id == 266462121 || msg.from.id == 235937232 || msg.from.id == 143687638) {
    switch(msg.data) {
      case 'yes_0':
        let options = {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{text: 'Москва, Летниковская', callback_data: 'mos_1'}],
              [{text: 'Москва, Спартаковская', callback_data: 'mos_2'}],
              [{text: 'Москва, Котельническая', callback_data: 'mos_3'}],
              [{text: 'Москва, Электрозаводская', callback_data: 'mos_4'}],
              [{text: 'Саратов, Орджоникизде', callback_data: 'sar_1'}],
              [{text: 'Саратов, Шелковичная', callback_data: 'sar_2'}],
              [{text: 'Новосибирск, Добролюбова', callback_data: 'nov_1'}],
              [{text: 'Новосибирск, Кирова', callback_data: 'nov_2'}],
              [{text: 'Казань, Лево-Булачная', callback_data: 'kaz_1'}],
              [{text: 'Екатеринбург, Толмачева', callback_data: 'ekat_1'}],
              [{text: 'Хабаровск, Амурский бульвар', callback_data: 'hab_1'}],
              [{text: 'Ханты-Мансийск, Мира', callback_data: 'hant_1'}]
            ]
          })
        };
        bot.sendMessage(msg.from.id, `В какой локации искать сочашечника?`, options);
        break
      case 'no':
        bot.sendMessage(msg.from.id, 'Жаль. Ты можешь написать мне в любое время, когда захочешь кофе.');
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
        let loc = coffee.getUserByTgId(msg.from.id);
        findPeople(msg, loc.location);
        break;
    }

    //Отдельная логика для расширенного сценария
    if(msg.data.substr(0, 5) == 'now_1') {
      //Разбираем строку по параметрам

      let answers = msg.data.split('_');
      let options = {};
      switch(true) {
        case answers[2] == 0 && answers[3] == 0 && answers[4] == 0:
          //now_1_0_0_0 Первый запрос "Когда будет удобно?"
          //now_1_1_0_0 = сейчас
          //now_1_2_0_0 = 10 минут
          //now_1_3_0_0 = 30 минут
          //now_1_4_0_0 = 60 минут
          options = {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{text: 'Сейчас', callback_data: 'now_1_1_0_0'}],
                [{text: 'Через 10 минут', callback_data: 'now_1_2_0_0'}],
                [{text: 'Через 30 минут', callback_data: 'now_1_3_0_0'}],
                [{text: 'Через час', callback_data: 'now_1_4_0_0'}]
              ]
            })
          };
          bot.sendMessage(msg.from.id, `Когда будет удобно?`, options);
          break;
        case answers[2] != 0 && answers[3] == 0 && answers[4] == 0:
          //Второй запрос "О чем хотелось бы пообщаться?"
          //now_1_х_1_0 = Обо всем понемногу
          //now_1_x_2_0 = О работе
          //now_1_x_3_0 = Определимся на месте
          options = {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{text: 'Обо всем понемногу', callback_data: `now_1_${answers[2]}_1_0`}],
                [{text: 'О работе', callback_data: `now_1_${answers[2]}_2_0`}],
                [{text: 'Определимся на месте', callback_data: `now_1_${answers[2]}_3_0`}]
              ]
            })
          };
          bot.sendMessage(msg.from.id, `О чем хотелось бы пообщаться?`, options);
          break;
        case answers[2] != 0 && answers[3] != 0 && answers[4] == 0:
          //Третий запрос "Кто платит?"
          //now_1_x_x_1 = Каждый за себя
          //now_1_x_x_2 = Подбросить монетку
          options = {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{text: 'Каждый за себя', callback_data: `now_1_${answers[2]}_${answers[3]}_1`}],
                [{text: 'Подбросить монетку', callback_data: `now_1_${answers[2]}_${answers[3]}_2`}]
              ]
            })
          };
          bot.sendMessage(msg.from.id, `Кто платит?`, options);
          break;
        default:
          //Пришел запрос со всеми данными
          let time = {
            1: 'сейчас',
            2: 'через 10 минут',
            3: 'через 30 минут',
            4: 'через час'
          };
          let about = {
            1: 'обо всем понемногу',
            2: 'о работе',
            3: 'определимся на месте'
          };
          let pay = {
            1: 'каждый за себя',
            2: 'подбросить монетку'
          };
          bot.sendMessage(msg.from.id, `Ты хочешь встретиться ${time[answers[2]]}, поговорить ${about[answers[3]]} и платит ${pay[answers[4]]}`);
          break;
      }
    }
    function goToLocation(msg, location) {
      coffee.setUserLocation(msg.from.id, location);
      let options = {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{text: 'Сейчас', callback_data: 'rightnow'}],
            [{text: 'Есть пожелания', callback_data: 'now_1_0_0_0'}]
          ]
        })
      };
      bot.sendMessage(msg.from.id, `Готов прямо сейчас или есть пожелания?`, options);
    }
  } else {
    console.log(`В заглушку долбится кнопкой ${msg.from.first_name} ${msg.from.last_name} с id ${msg.from.id}`);
    bot.sendMessage(msg.from.id, 'Привет, я кофебот, и я немного устал. Скоро я вернусь в улучшенной версии и общаться со мной станет еще удобнее. Я пришлю тебе сообщение, когда обновлюсь.');
  }
});
