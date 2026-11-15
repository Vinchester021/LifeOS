# LifeOS — Plan · Track · Improve

**[Русский](#русский) · [English](#english)**

**Сайт / Live:** https://vinchester021.github.io/LifeOS/

---

## Русский

**LifeOS** («Life Operating System») — личный планировщик на год. Вы ставите большие цели, делите их на кварталы, месяцы, недели и дни, отмечаете задачи и записываете результаты — а приложение показывает, как движется прогресс.

Финальный проект по курсу **Web Technologies 1 (Front End)**. Автор: **Vilgelm Feller, SE 2518**.

### Быстрый старт

1. Откройте сайт **в Safari или Chrome** (не внутри WhatsApp или Telegram — там данные могут не сохраниться).
2. Создайте профиль: имя и дата начала личного года. Или нажмите **«Сначала посмотреть пример»** — откроется LifeOS с готовыми данными.
3. Пройдите короткий тур и карточку **«Первые шаги»** на Главной — пять действий, после которых всё понятно.
4. На телефоне добавьте сайт на экран «Домой» (Safari → «Поделиться» → «На экран „Домой“», Chrome → ⋮ → «Добавить на главный экран») — LifeOS будет открываться как приложение.

### Возможности

- **Главная панель** — личный год (даты, кольцо, сколько дней прошло и осталось), задачи на сегодня, фокус недели (отметки дней, когда удалось ему следовать, и прогресс задач недели), большие цели, активность и категории.
- **Цели** — 7 типов прогресса: число, деньги (₸), процент, уровни (A1 → C1), чек-лист, серия дней, измерения. Мастер создания с понятными подписями и примерами, 26 значков и 13 цветов, этапы, шаблоны, архив, поиск и фильтры.
  - **Книжная полка** для целей по книгам: список книг со страницами, статусами («Хочу прочитать», «Читаю», «Прочитана») и темпом чтения.
- **Детали цели** — «Добавить запись» и «История записей», темп («≈ 48 780 ₸ в месяц»), этапы, заметки, связанные задачи; пункты чек-листа можно добавлять и менять прямо на странице.
- **Планировщик** — пять уровней: личный год → квартал → месяц (календарь) → неделя (перетаскивание задач) → сегодня.
- **Прогресс** — показатели с изменением к прошлому периоду, графики, активность по дням года, **итоги личного года** с архивом.
- **Спорт** — план недели, тренировка на сегодня по подходам, журнал, рекорды, замеры тела со сравнением.
- **Настройки** — профиль, язык, тема (светлая / тёмная / как в системе), 11 акцентных цветов, компактный режим, «Экспорт JSON» и «Восстановить из файла», «Годовой отчёт» (CSV), «Сброс профиля», раздел «Помощь».
- **Цитата дня** — 100 цитат, избранное.
- **Обучение** — «Первые шаги», туры по страницам, подсказки «?», режим примера.
- **Что нового** — после обновления сайт показывает, что изменилось; вся история — в Настройках → «Помощь».
- **Отзыв** — кнопка «Оставить отзыв» в меню (Google Форма; передаются только версия, тип устройства и язык).
- Три языка интерфейса: **английский, русский, казахский**. Удобный ввод дат и сумм (точки и разряды ставятся сами). Работает на телефоне, планшете и компьютере.

### Технологии

- HTML5, CSS3 (свои CSS-переменные: цвета, отступы, радиусы), JavaScript ES6+ без сборщиков и фреймворков.
- Bootstrap 5.3.3 и Bootstrap Icons 1.11.3, jQuery 3.7.1 (анимации), Chart.js 4.4.1 (графики; без него показываются таблицы).
- Все библиотеки лежат локально в `vendor/` — сайт работает **без интернета**.
- Переводы, цитаты и список изменений — в `data/*.json` (загружаются через `fetch`), даты и числа — через `Intl`.
- `manifest.json` и иконки — установка на экран телефона и компьютера.

### Где хранятся данные

**Только в вашем браузере** (`localStorage`). Нет сервера, аккаунта и отправки данных куда-либо. Очистка данных браузера удалит их, а на телефоне и компьютере данные разные.

Делайте резервную копию: **Настройки → «Экспорт JSON»**. Чтобы перенести данные на другое устройство — экспорт на одном и **«Восстановить из файла»** на другом.

### Как запустить локально

1. Скачайте или клонируйте репозиторий.
2. Запустите любой локальный сервер в папке проекта, например:
   - VS Code → расширение **Live Server** → «Open with Live Server», или
   - `python -m http.server 8000` и откройте <http://localhost:8000/>.
3. Можно открыть и двойным щелчком по `index.html` (`file://`) — тогда переводы и цитаты берутся из копий `data/*-fallback.js`.

> У `file://`, у `http://localhost` и у сайта на GitHub Pages разные хранилища: данные между ними переносятся через «Экспорт JSON» и «Восстановить из файла».

### Для разработчика

На **`goals.html?debug=1`** есть кнопка **«Заполнить демо-данными»** (заменяет текущие цели и задачи — сначала сделайте экспорт), а в консоли браузера (F12) запускаются самопроверки расчётов (`All … tests passed`).

---

## English

**LifeOS** ("Life Operating System") is a personal planner for a year. You set big goals, split them into quarters, months, weeks and days, tick tasks and record results — and the app shows how your progress goes.

Final project for the **Web Technologies 1 (Front End)** course. Author: **Vilgelm Feller, SE 2518**.

### Quick start

1. Open the site **in Safari or Chrome** (not inside WhatsApp or Telegram — your data may not be saved there).
2. Create a profile: your name and the start date of your personal year. Or press **"See an example first"** to open LifeOS with sample data.
3. Take the short tour and the **"First steps"** card on the Dashboard — five actions that show how everything works.
4. On a phone, add the site to the Home Screen (Safari → Share → "Add to Home Screen", Chrome → ⋮ → "Add to Home screen") and LifeOS opens like an app.

### Features

- **Dashboard** — the personal year (dates, a ring, days passed and left), today's tasks, the focus of the week (mark the days you followed it, and the progress of the week's tasks), big goals, activity and categories.
- **Goals** — 7 progress types: number, money (₸), percent, levels (A1 → C1), checklist, streak, measurements. A creation wizard with clear labels and examples, 26 icons and 13 colors, milestones, templates, archive, search and filters.
  - **Book shelf** for reading goals: a list of books with pages, statuses (Want to read, Reading, Finished) and the reading pace.
- **Goal Details** — "Add an entry" and "History of entries", pace ("≈ ₸48,780 a month"), milestones, notes, related tasks; checklist items can be added and edited right on the page.
- **Planner** — five levels: personal year → quarter → month (calendar) → week (drag and drop) → today.
- **Progress** — numbers compared with the previous period, charts, activity by day of the year, and the **Summary of the personal year** with an archive.
- **Sport** — a week plan, today's workout set by set, a journal, records, body measurements with a comparison.
- **Settings** — profile, language, theme (Light / Dark / As in the system), 11 accent colors, compact mode, "Export JSON" and "Restore from a file", "Yearly report" (CSV), "Reset profile", a Help section.
- **Quote of the day** — 100 quotes and favorites.
- **Onboarding** — "First steps", page tours, "?" hints, example mode.
- **What's new** — after an update the site shows what changed; the full history is in Settings → Help.
- **Feedback** — a "Leave feedback" button in the menu (a Google Form; only the version, device type and language are sent).
- Three interface languages: **English, Russian, Kazakh**. Easy date and amount input (dots and thousand separators are added for you). Works on phones, tablets and computers.

### Technologies

- HTML5, CSS3 (own CSS variables for colors, spacing and radii), JavaScript ES6+ with no build tools or frameworks.
- Bootstrap 5.3.3 and Bootstrap Icons 1.11.3, jQuery 3.7.1 (animations), Chart.js 4.4.1 (charts; tables are shown without it).
- All libraries are local copies in `vendor/` — the site works **offline**.
- Translations, quotes and the changelog are in `data/*.json` (loaded with `fetch`); dates and numbers use `Intl`.
- `manifest.json` and icons — install on a phone or computer.

### Where the data is stored

**Only in your browser** (`localStorage`). There is no server, no account, and nothing is sent anywhere. Clearing the browser data deletes it, and your phone and computer keep separate data.

Make a backup: **Settings → "Export JSON"**. To move your data to another device, export it on one and use **"Restore from a file"** on the other.

### Run locally

1. Download or clone the repository.
2. Start any local server in the project folder, for example:
   - VS Code → the **Live Server** extension → "Open with Live Server", or
   - `python -m http.server 8000` and open <http://localhost:8000/>.
3. You can also double-click `index.html` (`file://`) — then translations and quotes come from the copies in `data/*-fallback.js`.

> `file://`, `http://localhost` and the GitHub Pages site have separate storage: move the data between them with "Export JSON" and "Restore from a file".

### For developers

**`goals.html?debug=1`** has a **"Fill with demo data"** button (it replaces your current goals and tasks — export first), and the browser console (F12) runs self-tests of the calculations (`All … tests passed`).

---

© 2026 Vilgelm Feller, SE 2518. Libraries in `vendor/` keep their own licenses (MIT): Bootstrap, Bootstrap Icons, jQuery, Chart.js.
