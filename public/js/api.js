let formsDiv = document.getElementById('forms');
let addResult = (text) => {
  let nowDate = new Date();
  let editTime = (whole) => whole < 10 ? `0${whole}` : whole;
  let now = `<p><span class="message_time">${editTime(nowDate.getHours())}:${editTime(nowDate.getMinutes())}</span>`;
  document.getElementById('result').innerHTML += now + text + '</p>';
};

let socket = io();

if(localStorage.getItem('token')) {
  socket = io({
    query: {
      token: localStorage.getItem('token')
    }
  });
  socket.emit('auth', localStorage.getItem('token'));
} else {
  addResult(`Привет, я кофебот. Зарегистрируйся в <a href="https://t.me/@OpenCoffee_bot">телеграме</a> и пришли мне код из письма, чтобы начать общение.`);
  formsDiv.innerHTML = `
    <input class="secret_code" name="secret_code" type="text">
    <button class="submit_code">Отправить</button>
  `;
  document.querySelector('.submit_code').addEventListener('click', (e) => {
    e.preventDefault();
    socket.emit('auth', document.querySelector('.secret_code').value);
  });
}



socket.on('successAuth', (msg) => {
  localStorage.setItem('token', msg);
  socket.query.token = msg;
  console.log(socket);

  addResult(`Ты авторизовался удачно и теперь можешь я могу помочь тебе найти пару для чашечки кофе!`);
  formsDiv.innerHTML = `
    <button class="find_coffee">Найти сочашечника</button>
  `;
  document.querySelector('.find_coffee').addEventListener('click', (e) => {
    addResult('Теперь выбери свою локацию из списка');
    formsDiv.innerHTML = `
      <form>
        <select name="location">
          <option value="mos_1">Москва, Летниковская</option>
          <option value="mos_2">Москва, Спартаковская</option>
          <option value="mos_3">Москва, Котельническая</option>
          <option value="mos_4">Москва, Электрозаводская</option>
          <option value="sar_1">Саратов, Орджоникизде</option>
          <option value="sar_2">Саратов, Шелковичная</option>
          <option value="nov_1">Новосибирск, Добролюбова</option>
          <option value="nov_2">Новосибирск, Кирова</option>
          <option value="kaz_1">Казань, Лево-Булачная</option>
          <option value="ekat_1">Екатеринбург, Толмачева</option>
          <option value="hab_1">Хабаровск, Амурский бульвар</option>
          <option value="hant_1">Ханты-Мансийск, Мира</option>
        </select>
        <button class="submit_location">Выбрать</button>
      </form>
    `;
    document.querySelector('.submit_location').addEventListener('click', (e) => {
      let opt = document.forms[0].elements["location"].options;
      let selected = opt[opt.selectedIndex];
      socket.emit('find_coffee', selected);
    });
  });

});

socket.on('failedAuth', (msg) => {
  addResult(`Не смог тебя авторизовать :( Пришли мне код из письма еще раз.`);
  formsDiv.innerHTML = `
    <input class="secret_code" name="secret_code" type="text">
    <button class="submit_code">Отправить</button>
  `;
  document.querySelector('.submit_code').addEventListener('click', (e) => {
    e.preventDefault();
    socket.emit('auth', document.querySelector('.secret_code').value);
  });
});

socket.on('message', (msg) => {
  addResult(msg);
});

socket.on('finded', (msg) => {
  //Нашлась пара. Отображаем кнопки "Выйти" и "Я тут". Сообщения прокидываем через 'drink'
  formsDiv.innerHTML = `
  <input class="drink_message" name="drink_message" type="text">
  <button class="send_message">Отправить cообщение</button>
  <button class="iam_here">Я уже тут</button>
  <button class="quit">Выйти из беседы</button>
  `;
  document.querySelector('.send_message').addEventListener('click', (e) => {
    e.preventDefault();
    socket.emit('drink', document.querySelector('.drink_message').value);
  });

});
/*
let tgId = document.querySelector('.tgId');
let tgMessage = document.querySelector('.tgMessage');
let sendMessage = document.querySelector('.sendMessage');

sendMessage.addEventListener('click', (e) => {
  e.preventDefault();
  socket.emit('tgMessage', {
    id: tgId.value,
    message: tgMessage.value
  });
});
*/
