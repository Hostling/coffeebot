const fs = require('fs');

class Coffee {
  constructor() {
    this.people = [];
    this.userStorage = [];
    this.sockets = [];
  }

  drink(id, msg) {
    // Тут жуткий костыль. Логика работает только для WEB.
    // Отправка в TG реализована в index.js
    const sender = this.getUserById(id);
    if (sender.pair.web) {
      const { socket } = sender.pair;
      socket.emit('message', msg);
    }
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
    } catch (e) {
      console.error(`Ошибка спаривания ${e.stack}`);
    }
  }

  unpair(one, two) {
    try {
      const first = this.userStorage[this.findStorageByTgId(one.tgId)];
      const second = this.userStorage[this.findStorageByTgId(two.tgId)];
      first.state = 1;
      second.state = 1;
      delete (first.pair);
      delete (second.pair);
      console.log('Пара расформирована');
    } catch (e) {
      console.error(`Ошибка при расформировании пары: ${e.stack}`);
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
    console.log(`Прислан код: ${code}`);
    const user = this.getUserById(code);
    if (user !== '') {
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
    const tempJSONPeople = new Object();
    for(let i = 0; i < this.people.length;i++){
      tempJSONPeople[`${i}`] = this.people[i];
    }
    let tempJSONUs = new Object();
    for(let i = 0; i < this.userStorage.length;i++){
      tempJSONUs[`${i}`] = this.userStorage[i];
    }

    // fs.writeFile('people.db', JSON.stringify(tempJSONPeople));
    // fs.writeFile('us.db', JSON.stringify(tempJSONUs));
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

module.exports = Coffee;
