const formsDiv = document.getElementById('forms');
const addResult = (text) => {
  const nowDate = new Date();
  const editTime = (whole) => whole < 10 ? `0${whole}` : whole;
  const now = `<p><span class="message_time">${editTime(nowDate.getHours())}:${editTime(nowDate.getMinutes())}</span>`;
  const chatWindow = document.getElementById('result');
  chatWindow.innerHTML += `${now + text}</p>`;
  chatWindow.scrollTop = chatWindow.scrollHeight;
};

function setFindButton() {
  formsDiv.innerHTML = `
    <button class="find_coffee">Найти сочашечника</button>
  `;
  document.querySelector('.find_coffee').addEventListener('click', () => {
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
      e.preventDefault();
      const opt = document.forms[0].elements.location.options;
      const selected = opt[opt.selectedIndex].value;
      socket.emit('find_coffee', selected);
      formsDiv.innerHTML = `
        <button class="quit_queue" onclick="location.reload()">Выйти из очереди</button>
      `;
    });
  });
}

let socket = io();

if (localStorage.getItem('token')) {
  socket = io({
    query: {
      token: localStorage.getItem('token'),
    },
  });
  socket.emit('auth', localStorage.getItem('token'));
} else {
  addResult('Привет, я кофебот. Зарегистрируйся в <a href="https://t.me/@OpenCoffee_bot">телеграме</a> и пришли мне код из письма, чтобы начать общение.');
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
  if (!socket.query) location.reload();
  addResult('Ты авторизовался успешно и теперь я могу помочь тебе найти пару для чашечки кофе!');
  setFindButton();
});

socket.on('failedAuth', (msg) => {
  addResult('Не смог тебя авторизовать :( Пришли мне код из письма еще раз.');
});

socket.on('message', (msg) => {
  addResult(`<span class='message__bot'>Бот: ${msg}</span>`);
});

socket.on('finded', (msg) => {
  // Нашлась пара. Отображаем кнопки "Выйти" и "Я тут". Сообщения прокидываем через 'drink'
  formsDiv.innerHTML = `
  <form class="send_message">
    <input class="drink_message" name="drink_message" type="text">
    <button>Отправить cообщение</button>
  </form>
  <button class="iam_here">Я уже тут</button>
  <button class="quit" onclick="location.reload()">Выйти из беседы</button>
  `;
  document.querySelector('.send_message').addEventListener('submit', (e) => {
    e.preventDefault();
    const messageText = document.querySelector('.drink_message').value;
    if (messageText !== '') {
      addResult(`<span class='message__you'>Ты: ${messageText}</span`);
      socket.emit('drink', {
        id: localStorage.getItem('token'),
        text: messageText,
      });
      document.querySelector('.drink_message').value = '';
    } else {
      console.error('Нельзя отправить пустое сообщение');
    }
  });
  document.querySelector('.iam_here').addEventListener('click', (e) => {
    e.preventDefault();
    addResult('<span class=\'message__you\'>Вы сообщили напарнику, что уже на месте</span');
    socket.emit('drink', {
      id: localStorage.getItem('token'),
      text: 'Я уже на месте',
    });
  });
});

socket.on('unpair', () => {
  setFindButton();
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
