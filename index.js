"use strict";
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api'); //Библиотека для TelegramAPI
const nodemailer = require('nodemailer'); //Библиотека для отправки писем
const express = require('express'); //Библиотека для веб-морды
const fs = require("fs");

let app = express();

app.get('/', function (req, res) {
  res.send(`<html>
              <head>
              </head>
              <body>Привет, я кофебот, а ты нет.</body>
            </html>`);
});


app.listen(4433, function () {
  console.log(`Веб версия запущена на порту 4433`);
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

bot.setWebHook(`${url}/bot${TOKEN}`, {
  certificate: `@${options.webHook.cert}`,
});

class Coffee {
  constructor() {
    this.people = [];
    this.userStorage = [];
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
    console.log(`storageId: ${this.findStorageByTgId(tg)}`);
    if(this.findStorageByTgId(tg) !== '') {
      console.log(`Правильный код ${this.userStorage[this.findStorageByTgId(tg)].id}`);
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

bot.on('message', function (msg) {
    if(msg.text == 'SecretRebootMessage'){
      notExistedFunction();
    } else {
      //state 0 = Регистрация
      //state 1 = Поиск пары
      //state 2 = В очереди
      //state 3 = Пьет
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
});

function registerUser(msg) {
  //TODO: Если пользователь уже регистрировался, но указывает другую почту, то удаляем старую запись
  if(msg.text.indexOf('@open.ru') != -1) {
    if(coffee.findStorageByTgId(msg.from.id) !== '') {
      bot.sendMessage(msg.from.id, `Ты уже регистрировался с почтой ${coffee.getUserByTgId(msg.from.id).mail}. Отправь мне код, чтобы я тебя авторизовал.`);
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
      bot.sendMessage(msg.from.id, `Письмо с кодом отправлено на почту ${msg.text}. Отправь мне код, чтобы я тебя авторизовал.`);
      }
    } else if(msg.text.match('[0-9][0-9][0-9][0-9][0-9][0-9]')){
        if(coffee.authUser(msg.from.id, msg.text)){
          bot.sendMessage(msg.from.id, `Ты прислал правильный код! Отправь мне любое сообщение, чтобы продолжить`);
        } else {
          bot.sendMessage(msg.from.id, `Код неверный :( Попробуй еще раз`);
        }
    } else {
       bot.sendMessage(msg.from.id, `Привет, ${msg.from.first_name}, я кофебот!	Давайте зарегистрируемся? Введите, пожалуйста, свою рабочую почту в домене @open.ru или код из письма для авторизации`);
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
    console.log('Message sent successfully %s', info.messageId);
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

//Разруливаем ответы
bot.on('callback_query', function (msg) {
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
    case 'now':
      let loc = coffee.getUserByTgId(msg.from.id);
      findPeople(msg, loc.location);
      break;


    function goToLocation(msg, location) {
      coffee.setUserLocation(msg.from.id, location);
      let options = {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{text: 'Сейчас', callback_data: 'now'}],
            [{text: 'Есть пожелания', callback_data: 'now_1'}]
          ]
        })
      };
      bot.sendMessage(msg.from.id, `Готов прямо сейчас или есть пожелания?`, options);
    }

  }

});
