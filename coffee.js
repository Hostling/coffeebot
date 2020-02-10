const fs = require('fs');

class Coffee {
  constructor() {
    this.people = [];
    this.userStorage = [];
    this.sockets = [];
  }

  isMailExists(mail) {
    let id = 0;
    for(let item of this.userStorage) {
      if(item.mail.toUpperCase() === mail.toUpperCase()) id = item.id;
    }
    return id === 0 ? false : id;
  }

  setTrueTgId(id, tgId) {
    const user = this.getUserById(id);
    user.tgId = tgId;
  }

  drink(id, msg) {
    // Тут жуткий костыль. Логика работает только для WEB.
    // Отправка в TG реализована в index.js
    const sender = this.getUserById(id);
    if (sender.pair !== undefined){
      if (sender.pair.web) {
        const { socket } = sender.pair;
        socket.emit('message', msg);
      }
    }
  }

  getNow() {
    const nowDate = new Date();
    const editTime = (whole) => whole < 10 ? `0${whole}` : whole;
    return `[${nowDate.getFullYear()}.${nowDate.getMonth() + 1}.${nowDate.getDate()} ${editTime(nowDate.getHours())}:${editTime(nowDate.getMinutes())}] `;
  }

  pair(one, two) {
    try {
      const first = this.userStorage[this.findStorageByTgId(one.tgId)];
      const second = this.userStorage[this.findStorageByTgId(two.tgId)];
      first.state = 3;
      second.state = 3;
      first.pair = {};
      second.pair = {};
      if (one.socket) {
        second.pair.socket = one.socket;
        second.pair.web = true;
      } else {
        second.pair.tgId = one.tgId;
      }
      if (two.socket) {
        first.pair.socket = two.socket;
        first.pair.web = true;
      } else {
        first.pair.tgId = two.tgId;
      }
      console.log(this.getNow(), `Сформирована пара ${first.id} с ${second.id}`);
    } catch (e) {
      console.log(this.getNow(), `Ошибка спаривания ${e.stack}`);
    }
  }

  unpair(one, two) {
    try {
      const first = this.userStorage[this.findStorageByTgId(one.tgId)];
      const second = this.userStorage[this.findStorageByTgId(two.tgId)];
      first.state = 1;
      second.state = 1;
      console.log(this.getNow(), `Пара ${first.id} с ${second.id} расформирована`);
      delete (first.pair);
      delete (second.pair);
    } catch (e) {
      console.log(this.getNow(), `Ошибка при расформировании пары: ${e.stack}`);
    }
  }

  addSocket(socket) {
    this.sockets.push(socket);
    // console.log('Массив сокетов' + this.sockets);
    // console.log('Хендшейк первого:' + this.sockets[0].handshake)
    // this.sockets[0].emit('message', 'Ты первый');
  }

  getSockets() {
    return this.sockets;
  }

  tryWebAuth(code, socket) {
    const user = this.getUserById(code);
    if (user !== '') {
      user.socket = socket;
      console.log(this.getNow(), `Авторизация с кодом ${code} успешна`);
      return user;
    } else {
      console.log(this.getNow(), `Авторизация с кодом ${code} неуспешна`);
      return false;
    }
  }

  getUserById(id) {
    let trueId = '';
    for (let i = 0; i < this.userStorage.length; i++) {
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
    /*
    const tempJSONPeople = new Object();
    for (let i = 0; i < this.people.length;i++) {
      tempJSONPeople[`${i}`] = this.people[i];
    }
    */
    const tempJSONUs = new Object();
    for (let i = 0; i < this.userStorage.length; i++) {
      let current = {};
      for (const key in this.userStorage[i]) {
        current[key] = this.userStorage[i][key];
      }
      if (current.state === 3) current.state = 1;
      if (current.pair) delete (current.pair);
      if (current.socket) delete (current.socket);
      tempJSONUs[`${i}`] = current;
    }

    // fs.writeFile('people.db', JSON.stringify(tempJSONPeople));
    fs.writeFileSync('us.db', JSON.stringify(tempJSONUs, null, '\t'));
  }

  getUserState(msg) {
    if (this.userStorage.length > 0) {
      if (this.findStorageByTgId(msg.from.id) !== '') {
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
    console.log(this.getNow(), 'Зарегистрирован пользователь ', user);
  }

  getPeopleFromLocation(loc) {
    let match = undefined;
    for (let i = 0; i < this.people.length; i++){
      if(this.people[i].location == loc){
        match = i;
      }
    }
    return match;
  }

  getPeopleFromTgId(tgId) {
    let match = undefined;
    for (let i = 0; i < this.people.length; i++) {
      if (this.people[i].id == tgId) {
        match = this.people[i].location;
      }
    }
    return match;
  }

  addPeople(people) {
    this.people.push(people);
    this.writeToDB();
    console.log(this.getNow(), `Пользователь ${people.id} встал в очередь ${people.location}`);
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

module.exports = Coffee;
