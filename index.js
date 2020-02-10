require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api'); // Библиотека для TelegramAPI
const Coffee = require('./coffee');
const WebController = require('./WebController');
const TGController = require('./TGController');

const TOKEN = process.env.TG_TOKEN;



const coffee = new Coffee();
// const bot = new TelegramBot(TOKEN, { polling: true });
const bot = new TelegramBot(TOKEN, {});
// const bot = new TelegramBot(TOKEN, { polling: true, request: { proxy: 'http://177.22.225.237:3128' } });
bot.on('polling_error', (err) => console.log(coffee.getNow(), 'Ошибка коннекта к серверам телеграма'));
const web = new WebController(coffee, bot);
const tgc = new TGController(coffee, bot);
/*
Если нет хостинга с ssl сертификатом, то можно включить polling, но тогда понадобится прокси
https://hidemy.name/ru/proxy-list/
let bot = new TelegramBot(token, { polling: true, request: { proxy: 'http://177.22.225.237:3128', } });
*/
/*
const options = {
  webHook: {
    port: 8443,
    key: `${__dirname}${process.env.SSL_KEY}`,
    cert: `${__dirname}${process.env.SSL_CERT}`,
    has_custom_certificate: false,
  },
};
if (process.env.ZONE === 'prod') {
  const url = `${process.env.HOST_DOMAIN}:8443`;
  bot.setWebHook(`${url}/bot${TOKEN}`, {
    certificate: `@${options.webHook.cert}`,
  });
}
const bot = new TelegramBot(TOKEN, options);
*/

coffee.readFromDB();

module.exports.bot = bot;
module.exports.coffee = coffee;
