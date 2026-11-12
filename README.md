# LifeOS — Plan · Track · Improve

**[Русский](#русский) · [English](#english)**

**Демо / Live demo:** ` https://vinchester021.github.io/LifeOS/` ← *ссылка на GitHub Pages / GitHub Pages link*

---

## Русский

**LifeOS** («Life Operating System») — личный планировщик на год. Вы ставите большие цели, делите их на кварталы, месяцы, недели и дни, отмечаете задачи и записываете результаты — а приложение показывает, как движется прогресс.

Финальный проект по курсу **Web Technologies 1 (Front End)**. Автор: **Vilgelm Feller, SE 2518**.

### Возможности

- **Главная панель** — личный год (прошло / осталось), задачи на сегодня, фокус недели, большие цели, активность и категории.
- **Цели** — 7 типов прогресса: число, деньги (₸), проценты, уровни (A1 → C1), чеклист, серия дней, измерения. Мастер создания из 7 шагов, этапы, шаблоны, архив, поиск и фильтры.
- **Детали цели** — записи результатов, история, темп («≈ 48 780 ₸ в месяц»), этапы, заметки, связанные задачи.
- **Планировщик** — пять уровней: личный год → квартал → месяц (календарь) → неделя (перетаскивание задач) → сегодня.
- **Прогресс** — показатели с изменением к прошлому периоду, графики (вес, накопления, задачи по неделям), активность по дням года, **итоги личного года** с архивом.
- **Спорт** — план недели, тренировка на сегодня по подходам, журнал, рекорды, замеры тела со сравнением.
- **Настройки** — профиль, язык, тема (светлая / тёмная / системная), акцентный цвет, компактный режим, экспорт и импорт JSON, отчёт CSV, сброс.
- Три языка интерфейса: **английский, русский, казахский**. Светлая и тёмная тема. Работает на телефоне, планшете и компьютере.

### Технологии

- HTML5, CSS3 (свои CSS-переменные: цвета, отступы, радиусы), JavaScript ES6+ без сборщиков и фреймворков.
- Bootstrap 5.3.3 и Bootstrap Icons 1.11.3, jQuery 3.7.1 (анимации), Chart.js 4.4.1 (графики; без него показываются таблицы).
- Все библиотеки лежат локально в `vendor/` — сайт работает **без интернета**.
- Переводы и цитаты — в `data/*.json` (загружаются через `fetch`), даты и числа — через `Intl`.

### Где хранятся данные

**Только в вашем браузере** (`localStorage`). Нет сервера, аккаунта и отправки данных куда-либо. Очистка данных браузера удалит их — делайте резервную копию: **Настройки → Экспорт JSON** (и **Импорт** для восстановления или переноса на другое устройство).

### Как запустить локально

1. Скачайте или клонируйте репозиторий.
2. Запустите любой локальный сервер в папке проекта, например:
   - VS Code → расширение **Live Server** → «Open with Live Server», или
   - `python -m http.server 8000` и откройте <http://localhost:8000/>.
3. Можно открыть и двойным щелчком по `index.html` (`file://`) — тогда переводы и цитаты берутся из копий `data/*-fallback.js`.

> У `file://` и у `http://localhost` разные хранилища: данные между ними переносятся через Экспорт / Импорт JSON.

### Как посмотреть демо

1. Откройте приложение и создайте профиль (имя и начало личного года).
2. Перейдите на **`goals.html?debug=1`** и нажмите **«Заполнить демо-данными»** — появятся цели всех типов, задачи, записи и тренировки.
3. Демо-данные **заменяют** текущие цели и задачи. Если у вас есть свои данные — сначала сделайте Экспорт JSON.

На страницах с `?debug=1` в консоли браузера (F12) запускаются самопроверки расчётов (`All … tests passed`).

---

## English

**LifeOS** ("Life Operating System") is a personal planner for a year. You set big goals, split them into quarters, months, weeks and days, tick tasks and record results — and the app shows how your progress goes.

Final project for the **Web Technologies 1 (Front End)** course. Author: **Vilgelm Feller, SE 2518**.

### Features

- **Dashboard** — the personal year (passed / left), today's tasks, the focus of the week, big goals, activity and categories.
- **Goals** — 7 progress types: number, money (₸), percent, levels (A1 → C1), checklist, day streak, measurements. A 7-step wizard, milestones, templates, archive, search and filters.
- **Goal details** — result entries, history, pace ("≈ ₸48,780 a month"), milestones, notes, related tasks.
- **Planner** — five levels: personal year → quarter → month (calendar) → week (drag and drop) → today.
- **Progress** — numbers compared with the previous period, charts (weight, savings, tasks by week), activity by day of the year, and the **personal year summary** with an archive.
- **Sport** — a week plan, today's workout set by set, a journal, records, body measurements with a comparison.
- **Settings** — profile, language, theme (light / dark / system), accent color, compact mode, JSON export and import, CSV report, reset.
- Three interface languages: **English, Russian, Kazakh**. Light and dark theme. Works on phones, tablets and computers.

### Technologies

- HTML5, CSS3 (own CSS variables for colors, spacing and radii), JavaScript ES6+ with no build tools or frameworks.
- Bootstrap 5.3.3 and Bootstrap Icons 1.11.3, jQuery 3.7.1 (animations), Chart.js 4.4.1 (charts; tables are shown without it).
- All libraries are local copies in `vendor/` — the site works **offline**.
- Translations and quotes are in `data/*.json` (loaded with `fetch`); dates and numbers use `Intl`.

### Where the data is stored

**Only in your browser** (`localStorage`). There is no server, no account, and nothing is sent anywhere. Clearing the browser data deletes it — make a backup: **Settings → Export JSON** (and **Import** to restore it or move it to another device).

### Run locally

1. Download or clone the repository.
2. Start any local server in the project folder, for example:
   - VS Code → the **Live Server** extension → "Open with Live Server", or
   - `python -m http.server 8000` and open <http://localhost:8000/>.
3. You can also double-click `index.html` (`file://`) — then translations and quotes come from the copies in `data/*-fallback.js`.

> `file://` and `http://localhost` have separate storage: move the data between them with JSON Export / Import.

### Demo data

1. Open the app and create a profile (your name and the start of your personal year).
2. Go to **`goals.html?debug=1`** and press **"Fill with demo data"** — goals of every type, tasks, entries and workouts appear.
3. Demo data **replaces** your current goals and tasks. If you have your own data, export it first.

With `?debug=1` the pages also run self-tests of the calculations in the browser console (F12: `All … tests passed`).

---

© 2026 Vilgelm Feller, SE 2518. Libraries in `vendor/` keep their own licenses (MIT): Bootstrap, Bootstrap Icons, jQuery, Chart.js.
