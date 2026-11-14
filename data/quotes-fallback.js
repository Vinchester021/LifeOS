// LifeOS — copy of the quotes for opening the site as file:// (double click on an HTML file).
// Browsers do not allow fetch() to read local files there, so app.js uses this copy instead.
// Through a server (Live Server, http://) the real file data/quotes.json is loaded with fetch().
// The content MUST be the same as data/quotes.json: after changing the JSON, copy it here.
// (With ?debug=1 or on every load through http, app.js warns in the Console if they differ.)
window.LIFEOS_QUOTES = [
  { "id": "q01", "author": "Seneca", "text": {
    "en": "While we are postponing, life speeds by.",
    "ru": "Пока мы откладываем, жизнь проходит.",
    "kk": "Біз кейінге қалдырып жүргенде, өмір өтіп кетеді." } },
  { "id": "q02", "author": "Seneca", "text": {
    "en": "It is not that we have a short time to live, but that we waste a lot of it.",
    "ru": "Не то чтобы нам было дано мало времени, просто мы много его теряем.",
    "kk": "Бізге берілген уақыт аз емес, біз оның көбін босқа жоғалтамыз." } },
  { "id": "q03", "author": "Seneca", "text": {
    "en": "We suffer more often in imagination than in reality.",
    "ru": "Мы чаще страдаем в воображении, чем в действительности.",
    "kk": "Біз шындықтан гөрі қиялда жиі азап шегеміз." } },
  { "id": "q04", "author": "Seneca", "text": {
    "en": "No man was ever wise by chance.",
    "ru": "Никто не стал мудрым случайно.",
    "kk": "Ешкім кездейсоқ дана болған емес." } },
  { "id": "q05", "author": "Seneca", "text": {
    "en": "Begin at once to live.",
    "ru": "Начинай жить немедленно.",
    "kk": "Өмір сүруді дереу баста." } },
  { "id": "q06", "author": "Seneca", "text": {
    "en": "As long as you live, keep learning how to live.",
    "ru": "Пока живёшь, учись жить.",
    "kk": "Тірі жүргенде, өмір сүруді үйрене бер." } },
  { "id": "q07", "author": "Marcus Aurelius", "text": {
    "en": "Waste no more time arguing what a good man should be. Be one.",
    "ru": "Хватит рассуждать о том, каким должен быть хороший человек. Будь им.",
    "kk": "Жақсы адам қандай болуы керек деп таласуды доғар. Сондай бол." } },
  { "id": "q08", "author": "Marcus Aurelius", "text": {
    "en": "What stands in the way becomes the way.",
    "ru": "То, что стоит на пути, становится путём.",
    "kk": "Жолыңа кедергі болған нәрсе жолыңның өзіне айналады." } },
  { "id": "q09", "author": "Marcus Aurelius", "text": {
    "en": "Very little is needed to make a happy life.",
    "ru": "Для счастливой жизни нужно совсем немного.",
    "kk": "Бақытты өмір үшін өте аз нәрсе керек." } },
  { "id": "q10", "author": "Marcus Aurelius", "text": {
    "en": "Do every act of your life as though it were the last.",
    "ru": "Совершай каждое дело так, будто оно последнее в твоей жизни.",
    "kk": "Әр ісіңді өміріңдегі соңғы іс сияқты атқар." } },
  { "id": "q11", "author": "Marcus Aurelius", "text": {
    "en": "Confine yourself to the present.",
    "ru": "Ограничь себя настоящим.",
    "kk": "Тек осы сәтпен өмір сүр." } },
  { "id": "q12", "author": "Epictetus", "text": {
    "en": "First say to yourself what you would be; and then do what you have to do.",
    "ru": "Сначала скажи себе, кем ты хочешь быть, а затем делай то, что должен.",
    "kk": "Алдымен кім болғың келетінін өзіңе айт, содан кейін істеуге тиіс нәрсені істе." } },
  { "id": "q13", "author": "Epictetus", "text": {
    "en": "No man is free who is not master of himself.",
    "ru": "Не свободен тот, кто не владеет собой.",
    "kk": "Өзін-өзі билей алмаған адам еркін емес." } },
  { "id": "q14", "author": "Confucius", "text": {
    "en": "To know what you know and to know what you do not know — that is true knowledge.",
    "ru": "Знать, что знаешь, и знать, чего не знаешь, — вот истинное знание.",
    "kk": "Білетініңді білу және білмейтініңді білу — нағыз білім осы." } },
  { "id": "q15", "author": "Confucius", "text": {
    "en": "Learning without thought is labour lost; thought without learning is perilous.",
    "ru": "Учиться и не размышлять — напрасно терять время; размышлять и не учиться — опасно.",
    "kk": "Ойланбай оқу — бос еңбек, оқымай ойлану — қауіпті." } },
  { "id": "q16", "author": "Lao Tzu", "text": {
    "en": "A journey of a thousand miles begins with a single step.",
    "ru": "Путь в тысячу ли начинается с первого шага.",
    "kk": "Мың шақырымдық сапар бір қадамнан басталады." } },
  { "id": "q17", "author": "Lao Tzu", "text": {
    "en": "He who conquers others is strong; he who conquers himself is mighty.",
    "ru": "Побеждающий других силён, побеждающий себя могуществен.",
    "kk": "Өзгені жеңген — күшті, өзін жеңген — қуатты." } },
  { "id": "q18", "author": "Aristotle", "text": {
    "en": "Well begun is half done.",
    "ru": "Хорошее начало — половина дела.",
    "kk": "Жақсы бастау — істің жартысы." } },
  { "id": "q19", "author": "Aristotle", "text": {
    "en": "The roots of education are bitter, but the fruit is sweet.",
    "ru": "Корни учения горьки, но плоды его сладки.",
    "kk": "Білімнің тамыры ащы, бірақ жемісі тәтті." } },
  { "id": "q20", "author": "Heraclitus", "text": {
    "en": "No man ever steps in the same river twice.",
    "ru": "Нельзя дважды войти в одну и ту же реку.",
    "kk": "Бір өзенге екі рет түсуге болмайды." } },
  { "id": "q21", "author": "Heraclitus", "text": {
    "en": "Character is destiny.",
    "ru": "Характер человека — его судьба.",
    "kk": "Мінез — тағдыр." } },
  { "id": "q22", "author": "Socrates", "text": {
    "en": "The unexamined life is not worth living.",
    "ru": "Жизнь без размышления о ней не стоит того, чтобы жить.",
    "kk": "Ой елегінен өткізілмеген өмір сүруге тұрмайды." } },
  { "id": "q23", "author": "Plato", "text": {
    "en": "The beginning is the most important part of the work.",
    "ru": "Начало — самая важная часть работы.",
    "kk": "Бастама — жұмыстың ең маңызды бөлігі." } },
  { "id": "q24", "author": "Abai Kunanbaev", "text": {
    "en": "Be a true human being!",
    "ru": "Будь человеком!",
    "kk": "Адам бол!" } },
  { "id": "q25", "author": "Abai Kunanbaev", "text": {
    "en": "Do not boast until you have gained knowledge.",
    "ru": "Не хвались, пока не обрёл знания.",
    "kk": "Ғылым таппай мақтанба." } },
  { "id": "q26", "author": "Abai Kunanbaev", "text": {
    "en": "If you work without laziness, you will be fed without begging.",
    "ru": "Если трудишься без лени, будешь сыт, ни у кого не прося.",
    "kk": "Еңбек етсең ерінбей, тояды қарның тіленбей." } },
  { "id": "q27", "author": "Abai Kunanbaev", "text": {
    "en": "Light falls upon the one who strives.",
    "ru": "На стремящегося нисходит свет.",
    "kk": "Талапты ерге нұр жауар." } },
  { "id": "q28", "author": "Abai Kunanbaev", "text": {
    "en": "When you meet a learned person, try to be like them, even if you are not one yet.",
    "ru": "Встретив учёного человека, старайся быть похожим на него, даже если ты ещё не такой.",
    "kk": "Болмасаң да ұқсап бақ, бір ғалымды көрсеңіз." } },
  { "id": "q29", "author": "Benjamin Franklin", "text": {
    "en": "Well done is better than well said.",
    "ru": "Хорошо сделанное лучше хорошо сказанного.",
    "kk": "Жақсы істелген іс жақсы айтылған сөзден артық." } },
  { "id": "q30", "author": "Benjamin Franklin", "text": {
    "en": "Lost time is never found again.",
    "ru": "Потерянное время никогда не вернуть.",
    "kk": "Жоғалған уақыт ешқашан қайта табылмайды." } },
  { "id": "q31", "author": "Ovid", "text": {
    "en": "Dripping water hollows out stone.",
    "ru": "Капля камень точит.",
    "kk": "Тамшы тас тесер." } },
  { "id": "q32", "author": "Horace", "text": {
    "en": "Seize the day.",
    "ru": "Лови день.",
    "kk": "Күніңді бос жіберме." } },
  { "id": "q33", "author": "Horace", "text": {
    "en": "He who has begun is half done. Dare to be wise.",
    "ru": "Кто начал — уже сделал половину. Решись быть мудрым.",
    "kk": "Бастаған адам істің жартысын бітірді. Дана болуға батыл бол." } },
  { "id": "q34", "author": "Publilius Syrus", "text": {
    "en": "Practice is the best of all instructors.",
    "ru": "Практика — лучший из учителей.",
    "kk": "Тәжірибе — ұстаздардың ең жақсысы." } },
  { "id": "q35", "author": "Cicero", "text": {
    "en": "The beginnings of all things are small.",
    "ru": "Начало всех вещей невелико.",
    "kk": "Барлық нәрсенің бастауы кішкентай." } },
  { "id": "q36", "author": "Hippocrates", "text": {
    "en": "Life is short, art is long.",
    "ru": "Жизнь коротка, искусство вечно.",
    "kk": "Өмір қысқа, өнер ұзақ." } },
  { "id": "q37", "author": "LifeOS", "text": {
    "en": "Small steps create lasting progress.",
    "ru": "Маленькие шаги дают прочный прогресс.",
    "kk": "Кішкентай қадамдар берік прогресс береді." } },
  { "id": "q38", "author": "LifeOS", "text": {
    "en": "A big goal is just many small days.",
    "ru": "Большая цель — это много маленьких дней.",
    "kk": "Үлкен мақсат — көп кішкентай күндер." } },
  { "id": "q39", "author": "LifeOS", "text": {
    "en": "Plan the week, win the day.",
    "ru": "Спланируй неделю — выиграй день.",
    "kk": "Аптаны жоспарла — күнді ұт." } },
  { "id": "q40", "author": "LifeOS", "text": {
    "en": "Progress, not perfection.",
    "ru": "Прогресс, а не совершенство.",
    "kk": "Мінсіздік емес, прогресс." } },
  { "id": "q41", "author": "LifeOS", "text": {
    "en": "Write it down, then do it.",
    "ru": "Запиши, а потом сделай.",
    "kk": "Жазып ал, сосын орында." } },
  { "id": "q42", "author": "LifeOS", "text": {
    "en": "Today's effort is tomorrow's result.",
    "ru": "Сегодняшнее усилие — завтрашний результат.",
    "kk": "Бүгінгі еңбек — ертеңгі нәтиже." } },
  { "id": "q43", "author": "LifeOS", "text": {
    "en": "Consistency beats intensity.",
    "ru": "Постоянство важнее рывков.",
    "kk": "Тұрақтылық серпіннен маңызды." } },
  { "id": "q44", "author": "LifeOS", "text": {
    "en": "One good habit can change a whole year.",
    "ru": "Одна хорошая привычка может изменить весь год.",
    "kk": "Бір жақсы әдет бүкіл жылды өзгерте алады." } },
  { "id": "q45", "author": "LifeOS", "text": {
    "en": "Measure what matters to you.",
    "ru": "Измеряй то, что важно для тебя.",
    "kk": "Өзіңе маңызды нәрсені өлше." } },
  { "id": "q46", "author": "LifeOS", "text": {
    "en": "Rest is part of the plan.",
    "ru": "Отдых — тоже часть плана.",
    "kk": "Демалыс та — жоспардың бір бөлігі." } },
  { "id": "q47", "author": "LifeOS", "text": {
    "en": "Every finished task is a small victory.",
    "ru": "Каждая выполненная задача — маленькая победа.",
    "kk": "Әр орындалған тапсырма — кішкентай жеңіс." } },
  { "id": "q48", "author": "LifeOS", "text": {
    "en": "Choose one focus for this week.",
    "ru": "Выбери один фокус на эту неделю.",
    "kk": "Осы аптаға бір басты бағыт таңда." } },
  { "id": "q49", "author": "LifeOS", "text": {
    "en": "Look back to see how far you have come.",
    "ru": "Оглянись, чтобы увидеть, как далеко ты прошёл.",
    "kk": "Қаншалықты алға жылжығаныңды көру үшін артыңа қара." } },
  { "id": "q50", "author": "LifeOS", "text": {
    "en": "Your future is built on ordinary days.",
    "ru": "Будущее строится в обычные дни.",
    "kk": "Болашақ қарапайым күндерде құрылады." } },
  { "id": "q51", "author": "Seneca", "text": {
    "en": "Nothing is ours except time.",
    "ru": "Ничто нам не принадлежит, только время.",
    "kk": "Бізге ештеңе тиесілі емес, тек уақыт қана." } },
  { "id": "q52", "author": "Seneca", "text": {
    "en": "It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult.",
    "ru": "Не потому мы не решаемся, что трудно; потому и трудно, что не решаемся.",
    "kk": "Қиын болғандықтан батылымыз бармайды емес, батылымыз бармағандықтан қиын болады." } },
  { "id": "q53", "author": "Seneca", "text": {
    "en": "If you do not know which port you are sailing to, no wind is favourable.",
    "ru": "Кто не знает, в какую гавань плывёт, для того нет попутного ветра.",
    "kk": "Қай айлаққа жүзіп бара жатқанын білмейтінге ешбір жел оңды емес." } },
  { "id": "q54", "author": "Seneca", "text": {
    "en": "While we teach, we learn.",
    "ru": "Обучая, мы учимся.",
    "kk": "Үйрете жүріп, өзіміз үйренеміз." } },
  { "id": "q55", "author": "Marcus Aurelius", "text": {
    "en": "The soul becomes dyed with the colour of its thoughts.",
    "ru": "Душа окрашивается в цвет своих мыслей.",
    "kk": "Жан өз ойларының түсіне боялады." } },
  { "id": "q56", "author": "Marcus Aurelius", "text": {
    "en": "Do not live as if you had ten thousand years. While you live, while it is in your power, be good.",
    "ru": "Не живи так, будто впереди у тебя десять тысяч лет. Пока живёшь, пока это в твоей власти, будь хорошим.",
    "kk": "Алда он мың жыл бар сияқты өмір сүрме. Тірі кезіңде, қолыңнан келгенде — жақсы бол." } },
  { "id": "q57", "author": "Marcus Aurelius", "text": {
    "en": "Look within. Within is the fountain of good.",
    "ru": "Загляни внутрь себя. Внутри — источник добра.",
    "kk": "Ішіңе үңіл. Жақсылықтың бұлағы — ішіңде." } },
  { "id": "q58", "author": "Marcus Aurelius", "text": {
    "en": "The universe is change; our life is what our thoughts make it.",
    "ru": "Мир — это изменение, жизнь — то, какой её делают наши мысли.",
    "kk": "Әлем — өзгеріс, ал өміріміз — ойларымыз оны қандай етсе, сондай." } },
  { "id": "q59", "author": "Epictetus", "text": {
    "en": "People are disturbed not by things, but by their opinions about things.",
    "ru": "Людей мучают не вещи, а представления о вещах.",
    "kk": "Адамдарды заттар емес, заттар туралы пікірлері мазалайды." } },
  { "id": "q60", "author": "Epictetus", "text": {
    "en": "No great thing is created suddenly, any more than a bunch of grapes or a fig.",
    "ru": "Ничто великое не рождается сразу — как и гроздь винограда или смоква.",
    "kk": "Ешбір ұлы нәрсе бірден пайда болмайды — жүзім шоғыры мен інжір сияқты." } },
  { "id": "q61", "author": "Epictetus", "text": {
    "en": "Some things are within our power, and some are not.",
    "ru": "Одно в нашей власти, другое — нет.",
    "kk": "Бір нәрсе біздің еркімізде, бір нәрсе — жоқ." } },
  { "id": "q62", "author": "Epictetus", "text": {
    "en": "Every habit and faculty is preserved and increased by its corresponding actions.",
    "ru": "Всякая привычка и способность сохраняется и растёт от соответствующих дел.",
    "kk": "Әрбір әдет пен қабілет сәйкес істер арқылы сақталып, күшейеді." } },
  { "id": "q63", "author": "Confucius", "text": {
    "en": "To make a mistake and not correct it — that is the real mistake.",
    "ru": "Совершить ошибку и не исправить её — вот это и есть ошибка.",
    "kk": "Қателесіп, оны түзетпеу — нағыз қателік осы." } },
  { "id": "q64", "author": "Confucius", "text": {
    "en": "Review the old to understand the new.",
    "ru": "Повторяй старое, чтобы узнавать новое.",
    "kk": "Жаңаны тану үшін ескіні қайтала." } },
  { "id": "q65", "author": "Confucius", "text": {
    "en": "What you do not wish for yourself, do not do to others.",
    "ru": "Не делай другим того, чего не желаешь себе.",
    "kk": "Өзіңе тілемегенді өзгеге жасама." } },
  { "id": "q66", "author": "Confucius", "text": {
    "en": "When you see a worthy person, think of becoming their equal; when you see an unworthy one, look within yourself.",
    "ru": "Видя достойного, думай о том, как сравняться с ним; видя недостойного, загляни в себя.",
    "kk": "Лайықты адамды көрсең, оған теңелуді ойла; лайықсызды көрсең, өзіңе үңіл." } },
  { "id": "q67", "author": "Lao Tzu", "text": {
    "en": "Knowing others is wisdom; knowing yourself is enlightenment.",
    "ru": "Знающий людей разумен, знающий себя просвещён.",
    "kk": "Өзгені білген — ақылды, өзін білген — көзі ашық." } },
  { "id": "q68", "author": "Lao Tzu", "text": {
    "en": "A tree as wide as an embrace grows from a tiny sprout.",
    "ru": "Дерево в обхват вырастает из крошечного ростка.",
    "kk": "Құшаққа сыймас ағаш кішкентай өскіннен өседі." } },
  { "id": "q69", "author": "Lao Tzu", "text": {
    "en": "Whoever knows they have enough is rich.",
    "ru": "Кто знает, что ему достаточно, тот богат.",
    "kk": "Барына қанағат еткен — бай." } },
  { "id": "q70", "author": "Lao Tzu", "text": {
    "en": "Do difficult things while they are easy, and great things while they are small.",
    "ru": "Трудное делай, пока оно легко; великое — пока оно мало.",
    "kk": "Қиынды оңай кезінде, ұлыны кішкентай кезінде істе." } },
  { "id": "q71", "author": "Aristotle", "text": {
    "en": "We become just by doing just acts, and brave by doing brave acts.",
    "ru": "Справедливыми мы становимся, совершая справедливые поступки, а мужественными — мужественные.",
    "kk": "Әділ істер жасап әділ, батыл істер жасап батыл боламыз." } },
  { "id": "q72", "author": "Aristotle", "text": {
    "en": "One swallow does not make a spring, nor does one fine day.",
    "ru": "Одна ласточка не делает весны, как и один погожий день.",
    "kk": "Бір қарлығашпен көктем келмейді, бір ашық күнмен де келмейді." } },
  { "id": "q73", "author": "Benjamin Franklin", "text": {
    "en": "Early to bed and early to rise makes a man healthy, wealthy and wise.",
    "ru": "Рано ложиться и рано вставать — значит быть здоровым, богатым и мудрым.",
    "kk": "Ерте жатып, ерте тұрған — дені сау, ауқатты әрі дана." } },
  { "id": "q74", "author": "Benjamin Franklin", "text": {
    "en": "Have you something to do tomorrow? Do it today.",
    "ru": "Есть дело на завтра? Сделай его сегодня.",
    "kk": "Ертеңге ісің бар ма? Оны бүгін істе." } },
  { "id": "q75", "author": "Benjamin Franklin", "text": {
    "en": "Do you love life? Then do not squander time, for that is the stuff life is made of.",
    "ru": "Любишь жизнь? Тогда не трать время зря: из него состоит жизнь.",
    "kk": "Өмірді сүйесің бе? Онда уақытты босқа өткізбе: өмір содан тұрады." } },
  { "id": "q76", "author": "Benjamin Franklin", "text": {
    "en": "Little strokes fell great oaks.",
    "ru": "Маленькие удары валят большие дубы.",
    "kk": "Кішкентай соққылар үлкен емендерді құлатады." } },
  { "id": "q77", "author": "Abai Kunanbaev", "text": {
    "en": "Aspiration, work, deep thought, contentment, kindness — think on these: five noble deeds, if you accept them.",
    "ru": "Стремление, труд, глубокая мысль, довольство малым, милосердие — подумай: вот пять благородных дел, если примешь их.",
    "kk": "Талап, еңбек, терең ой, қанағат, рақым, ойлап қой — бес асыл іс, көнсеңіз." } },
  { "id": "q78", "author": "Abai Kunanbaev", "text": {
    "en": "Walk slowly but tread surely — your work will not be wasted.",
    "ru": "Иди не спеша, но ступай уверенно — твой труд не пропадёт даром.",
    "kk": "Ақырын жүріп, анық бас, еңбегің кетпес далаға." } },
  { "id": "q79", "author": "Abai Kunanbaev", "text": {
    "en": "A person is not born wise: by hearing, seeing, touching and tasting, they learn the good and the bad in the world…",
    "ru": "Человек не рождается разумным: слушая, видя, трогая и пробуя, он узнаёт, что в мире хорошо и что плохо…",
    "kk": "Адам ата-анадан туғанда есті болмайды: естіп, көріп, ұстап, татып ескерсе, дүниедегі жақсы, жаманды таниды…" } },
  { "id": "q80", "author": "Ovid", "text": {
    "en": "Add a little to a little, and there will be a great heap.",
    "ru": "Прибавляй понемногу к малому — и получится большая куча.",
    "kk": "Аз-аздан қоса берсең, үлкен үйінді болады." } },
  { "id": "q81", "author": "Horace", "text": {
    "en": "Life gives nothing to mortals without great effort.",
    "ru": "Жизнь ничего не даёт смертным без большого труда.",
    "kk": "Өмір адамға үлкен еңбексіз ештеңе бермейді." } },
  { "id": "q82", "author": "Publilius Syrus", "text": {
    "en": "Each day is the pupil of the day before.",
    "ru": "Каждый день — ученик предыдущего.",
    "kk": "Әр күн — алдыңғы күннің шәкірті." } },
  { "id": "q83", "author": "Publilius Syrus", "text": {
    "en": "He conquers twice who conquers himself in victory.",
    "ru": "Дважды побеждает тот, кто в победе побеждает себя.",
    "kk": "Жеңіс кезінде өзін жеңген адам екі рет жеңеді." } },
  { "id": "q84", "author": "Cicero", "text": {
    "en": "Anyone can make a mistake, but only a fool persists in it.",
    "ru": "Каждому свойственно ошибаться, но только глупцу — упорствовать в ошибке.",
    "kk": "Әр адам қателесуі мүмкін, ал қатесінде қасарысу — тек ақымаққа тән." } },
  { "id": "q85", "author": "Seneca", "text": {
    "en": "Whoever is everywhere is nowhere.",
    "ru": "Кто везде, тот нигде.",
    "kk": "Бәр жерде жүрген еш жерде болмайды." } },
  { "id": "q86", "author": "Sophocles", "text": {
    "en": "Without labour nothing prospers.",
    "ru": "Без труда ничто не процветает.",
    "kk": "Еңбексіз ештеңе өркендемейді." } },
  { "id": "q87", "author": "Virgil", "text": {
    "en": "Relentless work conquers all.",
    "ru": "Упорный труд всё побеждает.",
    "kk": "Табанды еңбек бәрін жеңеді." } },
  { "id": "q88", "author": "Virgil", "text": {
    "en": "They can because they think they can.",
    "ru": "Они могут, потому что верят, что могут.",
    "kk": "Олар қолдарынан келетініне сенгендіктен, қолдарынан келеді." } },
  { "id": "q89", "author": "LifeOS", "text": {
    "en": "Start small, but start today.",
    "ru": "Начни с малого, но начни сегодня.",
    "kk": "Аздан баста, бірақ бүгін баста." } },
  { "id": "q90", "author": "LifeOS", "text": {
    "en": "One step a day is 365 steps a year.",
    "ru": "Один шаг в день — 365 шагов в год.",
    "kk": "Күніне бір қадам — жылына 365 қадам." } },
  { "id": "q91", "author": "LifeOS", "text": {
    "en": "A goal written down becomes a plan.",
    "ru": "Записанная цель становится планом.",
    "kk": "Жазылған мақсат жоспарға айналады." } },
  { "id": "q92", "author": "LifeOS", "text": {
    "en": "The best time for the first step is now.",
    "ru": "Лучшее время для первого шага — сейчас.",
    "kk": "Алғашқы қадамға ең жақсы уақыт — қазір." } },
  { "id": "q93", "author": "LifeOS", "text": {
    "en": "A small win today beats a big plan for later.",
    "ru": "Маленькая победа сегодня лучше большого плана на потом.",
    "kk": "Бүгінгі кішкентай жеңіс кейінге қалған үлкен жоспардан артық." } },
  { "id": "q94", "author": "LifeOS", "text": {
    "en": "Mark what is done: that is progress too.",
    "ru": "Отмечай сделанное: это тоже движение вперёд.",
    "kk": "Орындалғанды белгіле: бұл да алға жылжу." } },
  { "id": "q95", "author": "LifeOS", "text": {
    "en": "Goals for the year, attention for today.",
    "ru": "Цели — на год, внимание — на сегодня.",
    "kk": "Мақсат — жылға, назар — бүгінге." } },
  { "id": "q96", "author": "LifeOS", "text": {
    "en": "A missed day is no reason to give up.",
    "ru": "Пропущенный день — не повод сдаваться.",
    "kk": "Өткізіп алған күн — берілуге себеп емес." } },
  { "id": "q97", "author": "LifeOS", "text": {
    "en": "A clear goal saves energy.",
    "ru": "Ясная цель бережёт силы.",
    "kk": "Айқын мақсат күшті үнемдейді." } },
  { "id": "q98", "author": "LifeOS", "text": {
    "en": "Move at your own pace, but keep moving.",
    "ru": "Двигайся в своём темпе, но не останавливайся.",
    "kk": "Өз қарқыныңмен жүр, бірақ тоқтама." } },
  { "id": "q99", "author": "LifeOS", "text": {
    "en": "Every month is a new chapter of your year.",
    "ru": "Каждый месяц — новая глава твоего года.",
    "kk": "Әр ай — жылыңның жаңа тарауы." } },
  { "id": "q100", "author": "LifeOS", "text": {
    "en": "Track your progress and you will see yourself grow.",
    "ru": "Записывай прогресс — и увидишь, как растёшь.",
    "kk": "Прогресіңді жазып отыр — өскеніңді көресің." } }
];
