const formsDiv = document.getElementById('result');
const addResult = (text, user) => {
  const nowDate = new Date();
  const editTime = (whole) => whole < 10 ? `0${whole}` : whole;
  const now = `<span class="message_time">${editTime(nowDate.getHours())}:${editTime(nowDate.getMinutes())}</span>`;
  const chatWindow = document.getElementById('chatbox');
  let sender = 'bot';
  if (user) sender = 'user';
  chatWindow.innerHTML += `<p class="chat_message_${sender}">${text + now}</p>`;
  chatWindow.scrollTop = chatWindow.scrollHeight;
};

let socket = io();

const formsStorage = {
  registration: `
    <p class="result_title">Привет, я кофебот!</p>
    <p class="result_label">Пройди авторизацию и пойдем пить кофе :)</p>
    <form class="reg_form">
          <label class="reg_label">
            Email
            <input class="reg_input" type="email" name="register"></input>
          <label>
          <button class="reg_button">Далее</button>
    </form>
    <a class="code" href="#">У меня уже есть код</a>
  `,
  code: `
    <p class="result_title">Отлично, я почти готов!</p>
    <p class="result_label">Введи код авторизации</p>
    <form class="auth_form">
        <label class="auth_label">
          Код авторизации
          <input class="auth_input" type="number" name="register"></input>
        <label>
        <button class="auth_button">Далее</button>
    </form>
  `,
  location: `
    <p class="result_title">Чувствуешь запах кофе?</p>
    <p class="result_label">Выбери локацию и погнали :)</p>
    <form class="loc_form">
        <label class="loc_label">
          Локация
          <select class="loc_select" name="location">
            <option value="mos_1">Москва, Летниковская</option>
            <option value="mos_2">Москва, Спартаковская</option>
            <option value="mos_3">Москва, Котельническая</option>
            <option value="mos_4">Москва, Электрозаводская</option>
            <option value="sar_1">Саратов, Орджоникизде</option>
            <option value="sar_2">Саратов, Шелковичная</option>
            <option value="sar_3">Саратов, Мирный переулок</option>
            <option value="kaz_1">Казань, Лево-Булачная</option>
            <option value="hant_1">Ханты-Мансийск, Мира</option>
          </select>
        <label>
        <button class="loc_button">Далее</button>
    </form>
  `,
  search: `
    <p class="searching">... ищу сокофейника</p>
    <button class="reg_button" onclick="location.reload()">Отмена</button>
  `,
  chat: `
    <p class="chat_header">Кофебот</p>
    <div id="chatbox"></div>
    <form class="chatform">
      <input class="chat_input" type="text" name="chat_input" placeholder="Сообщение..."></input>
    </form>
  `,
};

function setFindButton() {
  formsDiv.innerHTML = formsStorage.location;

  document.querySelector('.loc_form').addEventListener('submit', (e) => {
    e.preventDefault();
    const opt = document.forms[0].elements.location.options;
    const selected = opt[opt.selectedIndex].value;
    socket.emit('find_coffee', selected);
    formsDiv.innerHTML = formsStorage.search;
  });
}

if (localStorage.getItem('token')) {
  socket = io({
    query: {
      token: localStorage.getItem('token'),
    },
  });
  socket.emit('auth', localStorage.getItem('token'));
} else {
  formsDiv.innerHTML = formsStorage.registration;

  document.querySelector('.reg_form').addEventListener('submit', (e) => {
    e.preventDefault();
    const mail = document.querySelector('.reg_input').value;
    socket.emit('register', mail);
  });

  document.querySelector('.code').addEventListener('click', (e) => {
    e.preventDefault();
    formsDiv.innerHTML = formsStorage.code;
    document.querySelector('.auth_form').addEventListener('submit', (e) => {
      e.preventDefault();
      const code = document.querySelector('.auth_input').value;
      socket.emit('auth', code);
    });
  });
}

socket.on('successRegister', (msg) => {
  formsDiv.innerHTML = formsStorage.code;
  document.querySelector('.auth_form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.querySelector('.auth_input').value;
    socket.emit('auth', code);
  });
});

socket.on('successAuth', (msg) => {
  localStorage.setItem('token', msg);
  if (!socket.query) location.reload();
  setFindButton();
});

socket.on('failedAuth', (msg) => {
  localStorage.clear();
  location.reload();
});

socket.on('setBest', (msg) => {
  const points = JSON.parse(msg);
  const bestContainer = document.querySelector('.best_container');
  function generateItem(item) {
    let stars = '';
    switch(item.stars) {
      case 3:
        stars = '3stars.jpg';
        break;
      case 4:
        stars = '4stars.jpg';
        break;
      case 5:
        stars = '5stars.jpg';
        break;
    }
    return `
      <div class='best_item'>
        <img class='stars' src='img/${stars}' alt='stars'>
        <img class='best_logo' src='img/${item.logo}' alt='best_logo'>
        <span class='best_title'>${item.name}</span>
        <span class='best_prop'>${item.address}</span>
        <span class='best_prop'>~${item.distance}</span>
        <span class='best_prop'>~${item.price}</span>
      </div>
    `;
  }
  let items = '';
  for(let i = 0; i < 3; i++) {
    items += generateItem(points[i]);
  }
  bestContainer.innerHTML = items;
});

socket.on('message', (msg) => {
  addResult(msg);
});

socket.on('finded', (msg) => {
  // Нашлась пара. Отображаем кнопки "Выйти" и "Я тут". Сообщения прокидываем через 'drink'
  formsDiv.innerHTML = formsStorage.chat;
  document.getElementById('result').style.padding = 0;
  document.getElementById('result').style.position = 'relative';
  document.querySelector('.chatform').addEventListener('submit', (e) => {
    e.preventDefault();
    const messageText = document.querySelector('.chat_input').value;
    if (messageText !== '') {
      addResult(messageText, 'user');
      socket.emit('drink', {
        id: localStorage.getItem('token'),
        text: messageText,
      });
      document.querySelector('.chat_input').value = '';
    } else {
      console.error('Нельзя отправить пустое сообщение');
    }
  });
});

socket.on('unpair', () => {
  location.reload();
  setFindButton();
});
