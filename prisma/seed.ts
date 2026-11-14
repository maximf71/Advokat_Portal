import {
  PrismaClient,
  RegistryStatus,
  LawFirmForm,
  CourtType,
  CaseOutcome,
  VerificationStatus,
  UserRole,
  LeadStatus,
} from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_PASSWORD = hashSync('admin123', 10);
const LAWYER_PASSWORD = hashSync('lawyer123', 10);

const CITY_DATA = [
  {
    slug: 'moscow',
    name: 'Москва',
    nameGenitive: 'Москвы',
    namePrepositional: 'Москве',
    nameDative: 'Москве',
    regionName: 'г. Москва',
    regionCode: '77',
    population: 12_600_000,
    isMajor: true,
    latitude: 55.7558,
    longitude: 37.6173,
  },
  {
    slug: 'ekaterinburg',
    name: 'Екатеринбург',
    nameGenitive: 'Екатеринбурга',
    namePrepositional: 'Екатеринбурге',
    nameDative: 'Екатеринбургу',
    regionName: 'Свердловская область',
    regionCode: '66',
    population: 1_544_000,
    isMajor: true,
    latitude: 56.8389,
    longitude: 60.6057,
  },
  {
    slug: 'kazan',
    name: 'Казань',
    nameGenitive: 'Казани',
    namePrepositional: 'Казани',
    nameDative: 'Казани',
    regionName: 'Республика Татарстан',
    regionCode: '16',
    population: 1_308_000,
    isMajor: true,
    latitude: 55.7961,
    longitude: 49.1064,
  },
  {
    slug: 'novosibirsk',
    name: 'Новосибирск',
    nameGenitive: 'Новосибирска',
    namePrepositional: 'Новосибирске',
    nameDative: 'Новосибирску',
    regionName: 'Новосибирская область',
    regionCode: '54',
    population: 1_633_000,
    isMajor: true,
    latitude: 55.0084,
    longitude: 82.9357,
  },
  {
    slug: 'sochi',
    name: 'Сочи',
    nameGenitive: 'Сочи',
    namePrepositional: 'Сочи',
    nameDative: 'Сочи',
    regionName: 'Краснодарский край',
    regionCode: '23',
    population: 443_000,
    isMajor: false,
    latitude: 43.6028,
    longitude: 39.7342,
  },
  {
    slug: 'tolyatti',
    name: 'Тольятти',
    nameGenitive: 'Тольятти',
    namePrepositional: 'Тольятти',
    nameDative: 'Тольятти',
    regionName: 'Самарская область',
    regionCode: '63',
    population: 684_000,
    isMajor: true,
    latitude: 53.5303,
    longitude: 49.3461,
  },
] as const;

const CATEGORY_DATA = [
  {
    slug: 'ugolovnoe-pravo',
    name: 'Уголовное право',
    lawyerTitlePlural: 'уголовные адвокаты',
    lawyerTitleSingle: 'уголовный адвокат',
    description: 'Защита по уголовным делам на всех стадиях процесса.',
    sortOrder: 1,
  },
  {
    slug: 'grazhdanskoe-pravo',
    name: 'Гражданское право',
    lawyerTitlePlural: 'адвокаты по гражданским делам',
    lawyerTitleSingle: 'адвокат по гражданским делам',
    description: 'Споры по договорам, взысканию долгов и защите прав.',
    sortOrder: 2,
  },
  {
    slug: 'semeynoe-pravo',
    name: 'Семейное право',
    lawyerTitlePlural: 'семейные адвокаты',
    lawyerTitleSingle: 'семейный адвокат',
    description: 'Развод, алименты, раздел имущества и споры о детях.',
    sortOrder: 3,
  },
  {
    slug: 'trudovoe-pravo',
    name: 'Трудовое право',
    lawyerTitlePlural: 'адвокаты по трудовым спорам',
    lawyerTitleSingle: 'адвокат по трудовым спорам',
    description: 'Увольнения, невыплата зарплаты, дискриминация на работе.',
    sortOrder: 4,
  },
  {
    slug: 'arbitrazh',
    name: 'Арбитражные споры',
    lawyerTitlePlural: 'арбитражные адвокаты',
    lawyerTitleSingle: 'арбитражный адвокат',
    description: 'Корпоративные и хозяйственные споры в арбитражных судах.',
    sortOrder: 5,
  },
  {
    slug: 'bankrotstvo',
    name: 'Банкротство',
    lawyerTitlePlural: 'адвокаты по банкротству',
    lawyerTitleSingle: 'адвокат по банкротству',
    description: 'Банкротство физических и юридических лиц.',
    sortOrder: 6,
  },
  {
    slug: 'nasledstvo',
    name: 'Наследственное право',
    lawyerTitlePlural: 'адвокаты по наследству',
    lawyerTitleSingle: 'адвокат по наследству',
    description: 'Оформление наследства, оспаривание завещаний.',
    sortOrder: 7,
  },
  {
    slug: 'zhilishchnoe-pravo',
    name: 'Жилищное право',
    lawyerTitlePlural: 'адвокаты по жилищным спорам',
    lawyerTitleSingle: 'адвокат по жилищным спорам',
    description: 'Выселение, приватизация, ЖКХ и споры с управляющими компаниями.',
    sortOrder: 8,
  },
  {
    slug: 'administrativnoe-pravo',
    name: 'Административное право',
    lawyerTitlePlural: 'адвокаты по административным делам',
    lawyerTitleSingle: 'адвокат по административным делам',
    description: 'Обжалование постановлений и административные правонарушения.',
    sortOrder: 9,
  },
  {
    slug: 'migracionnoe-pravo',
    name: 'Миграционное право',
    lawyerTitlePlural: 'миграционные адвокаты',
    lawyerTitleSingle: 'миграционный адвокат',
    description: 'ВНЖ, РВП, гражданство и депортация.',
    sortOrder: 10,
  },
] as const;

type ServiceSeed = {
  slug: string;
  name: string;
  shortTag: string;
  lawArticleCode?: string;
  avgMarketPrice?: number;
};

const SERVICES_BY_CATEGORY: Record<string, ServiceSeed[]> = {
  'ugolovnoe-pravo': [
    {
      slug: 'zashchita-po-moshennichestvu',
      name: 'Защита по делам о мошенничестве',
      shortTag: 'мошенничество',
      lawArticleCode: 'ст. 159 УК РФ',
      avgMarketPrice: 150_000,
    },
    {
      slug: 'zashchita-po-narkotikam',
      name: 'Защита по делам о наркотиках',
      shortTag: 'наркотики',
      lawArticleCode: 'ст. 228 УК РФ',
      avgMarketPrice: 120_000,
    },
    {
      slug: 'zashchita-pri-dtp',
      name: 'Защита при ДТП с пострадавшими',
      shortTag: 'ДТП',
      lawArticleCode: 'ст. 264 УК РФ',
      avgMarketPrice: 100_000,
    },
  ],
  'grazhdanskoe-pravo': [
    {
      slug: 'vzyskanie-dolga',
      name: 'Взыскание задолженности',
      shortTag: 'долг',
      lawArticleCode: 'ст. 395 ГК РФ',
      avgMarketPrice: 80_000,
    },
    {
      slug: 'vozmeshchenie-ushcherba',
      name: 'Возмещение ущерба',
      shortTag: 'ущерб',
      lawArticleCode: 'ст. 1064 ГК РФ',
      avgMarketPrice: 70_000,
    },
    {
      slug: 'rastorzhenie-dogovora',
      name: 'Расторжение договора',
      shortTag: 'договор',
      lawArticleCode: 'ст. 450 ГК РФ',
      avgMarketPrice: 60_000,
    },
  ],
  'semeynoe-pravo': [
    {
      slug: 'razvod-i-razdel-imushchestva',
      name: 'Развод и раздел имущества',
      shortTag: 'развод',
      lawArticleCode: 'ст. 38 СК РФ',
      avgMarketPrice: 90_000,
    },
    {
      slug: 'alimenty',
      name: 'Взыскание алиментов',
      shortTag: 'алименты',
      lawArticleCode: 'ст. 80 СК РФ',
      avgMarketPrice: 50_000,
    },
  ],
  'trudovoe-pravo': [
    {
      slug: 'vosstanovlenie-na-rabote',
      name: 'Восстановление на работе',
      shortTag: 'увольнение',
      lawArticleCode: 'ст. 394 ТК РФ',
      avgMarketPrice: 75_000,
    },
    {
      slug: 'nezakonnoe-uvolnenie',
      name: 'Оспаривание незаконного увольнения',
      shortTag: 'трудовой спор',
      lawArticleCode: 'ст. 77 ТК РФ',
      avgMarketPrice: 65_000,
    },
    {
      slug: 'nezaplata-zarplaty',
      name: 'Взыскание невыплаченной зарплаты',
      shortTag: 'зарплата',
      lawArticleCode: 'ст. 136 ТК РФ',
      avgMarketPrice: 55_000,
    },
  ],
  arbitrazh: [
    {
      slug: 'korporativnyj-spor',
      name: 'Корпоративный спор',
      shortTag: 'корпоратив',
      lawArticleCode: 'ст. 225.1 АПК РФ',
      avgMarketPrice: 200_000,
    },
    {
      slug: 'vzyskanie-s-kontragenta',
      name: 'Взыскание с контрагента',
      shortTag: 'арбитраж',
      lawArticleCode: 'ст. 110 АПК РФ',
      avgMarketPrice: 150_000,
    },
  ],
  bankrotstvo: [
    {
      slug: 'bankrotstvo-fizlica',
      name: 'Банкротство физического лица',
      shortTag: 'банкрот физлица',
      lawArticleCode: 'ст. 213.4 ФЗ-127',
      avgMarketPrice: 120_000,
    },
    {
      slug: 'bankrotstvo-yurlica',
      name: 'Банкротство юридического лица',
      shortTag: 'банкрот юрлица',
      lawArticleCode: 'ст. 7 ФЗ-127',
      avgMarketPrice: 250_000,
    },
  ],
  nasledstvo: [
    {
      slug: 'oformlenie-nasledstva',
      name: 'Оформление наследства',
      shortTag: 'наследство',
      lawArticleCode: 'ст. 1152 ГК РФ',
      avgMarketPrice: 45_000,
    },
    {
      slug: 'osparivanie-zaveshchaniya',
      name: 'Оспаривание завещания',
      shortTag: 'завещание',
      lawArticleCode: 'ст. 1117 ГК РФ',
      avgMarketPrice: 85_000,
    },
  ],
  'zhilishchnoe-pravo': [
    {
      slug: 'vyselenie',
      name: 'Защита от незаконного выселения',
      shortTag: 'выселение',
      lawArticleCode: 'ст. 292 ГК РФ',
      avgMarketPrice: 70_000,
    },
    {
      slug: 'zhkh-spory',
      name: 'Споры с управляющей компанией',
      shortTag: 'ЖКХ',
      lawArticleCode: 'ст. 161 ЖК РФ',
      avgMarketPrice: 40_000,
    },
  ],
  'administrativnoe-pravo': [
    {
      slug: 'obzhalovanie-postanovleniya-gibdd',
      name: 'Обжалование постановления ГИБДД',
      shortTag: 'ГИБДД',
      lawArticleCode: 'ст. 12.9 КоАП РФ',
      avgMarketPrice: 25_000,
    },
    {
      slug: 'administrativnoe-zaderzhanie',
      name: 'Защита при административном задержании',
      shortTag: 'адм. задержание',
      lawArticleCode: 'ст. 27.1 КоАП РФ',
      avgMarketPrice: 35_000,
    },
  ],
  'migracionnoe-pravo': [
    {
      slug: 'poluchenie-vnzh',
      name: 'Получение ВНЖ',
      shortTag: 'ВНЖ',
      lawArticleCode: 'ст. 6 ФЗ-115',
      avgMarketPrice: 60_000,
    },
    {
      slug: 'osparivanie-deportacii',
      name: 'Оспаривание депортации',
      shortTag: 'депортация',
      lawArticleCode: 'ст. 25.10 ФЗ-114',
      avgMarketPrice: 80_000,
    },
    {
      slug: 'grazhdanstvo-rf',
      name: 'Оформление гражданства РФ',
      shortTag: 'гражданство',
      lawArticleCode: 'ст. 13 ФЗ-62',
      avgMarketPrice: 55_000,
    },
  ],
};

const LAWYER_NAMES: {
  lastName: string;
  firstName: string;
  middleName: string;
  citySlug: string;
  regionSuffix: string;
  registrySeq: number;
  experienceStartYear: number;
  isClaimed: boolean;
}[] = [
  { lastName: 'Иванов', firstName: 'Иван', middleName: 'Иванович', citySlug: 'moscow', regionSuffix: '77', registrySeq: 1024, experienceStartYear: 2010, isClaimed: true },
  { lastName: 'Петрова', firstName: 'Анна', middleName: 'Сергеевна', citySlug: 'moscow', regionSuffix: '77', registrySeq: 1025, experienceStartYear: 2012, isClaimed: true },
  { lastName: 'Сидоров', firstName: 'Дмитрий', middleName: 'Александрович', citySlug: 'moscow', regionSuffix: '77', registrySeq: 1026, experienceStartYear: 2008, isClaimed: true },
  { lastName: 'Козлов', firstName: 'Михаил', middleName: 'Петрович', citySlug: 'moscow', regionSuffix: '77', registrySeq: 1027, experienceStartYear: 2015, isClaimed: false },
  { lastName: 'Новикова', firstName: 'Елена', middleName: 'Викторовна', citySlug: 'moscow', regionSuffix: '77', registrySeq: 1028, experienceStartYear: 2018, isClaimed: false },
  { lastName: 'Морозов', firstName: 'Алексей', middleName: 'Николаевич', citySlug: 'moscow', regionSuffix: '77', registrySeq: 1029, experienceStartYear: 2006, isClaimed: false },
  { lastName: 'Волкова', firstName: 'Ольга', middleName: 'Андреевна', citySlug: 'ekaterinburg', regionSuffix: '66', registrySeq: 2841, experienceStartYear: 2011, isClaimed: true },
  { lastName: 'Лебедев', firstName: 'Сергей', middleName: 'Олегович', citySlug: 'ekaterinburg', regionSuffix: '66', registrySeq: 2842, experienceStartYear: 2009, isClaimed: true },
  { lastName: 'Соколова', firstName: 'Мария', middleName: 'Дмитриевна', citySlug: 'ekaterinburg', regionSuffix: '66', registrySeq: 2843, experienceStartYear: 2016, isClaimed: false },
  { lastName: 'Кузнецов', firstName: 'Павел', middleName: 'Игоревич', citySlug: 'ekaterinburg', regionSuffix: '66', registrySeq: 2844, experienceStartYear: 2019, isClaimed: false },
  { lastName: 'Попов', firstName: 'Андрей', middleName: 'Владимирович', citySlug: 'ekaterinburg', regionSuffix: '66', registrySeq: 2845, experienceStartYear: 2007, isClaimed: true },
  { lastName: 'Федорова', firstName: 'Татьяна', middleName: 'Юрьевна', citySlug: 'ekaterinburg', regionSuffix: '66', registrySeq: 2846, experienceStartYear: 2014, isClaimed: false },
  { lastName: 'Ахметов', firstName: 'Ринат', middleName: 'Маратович', citySlug: 'kazan', regionSuffix: '16', registrySeq: 3910, experienceStartYear: 2010, isClaimed: true },
  { lastName: 'Гилмуллина', firstName: 'Алия', middleName: 'Рашидовна', citySlug: 'kazan', regionSuffix: '16', registrySeq: 3911, experienceStartYear: 2013, isClaimed: false },
  { lastName: 'Сафин', firstName: 'Ильдар', middleName: 'Камилевич', citySlug: 'kazan', regionSuffix: '16', registrySeq: 3912, experienceStartYear: 2005, isClaimed: true },
  { lastName: 'Зарипова', firstName: 'Лейсан', middleName: 'Фаритовна', citySlug: 'kazan', regionSuffix: '16', registrySeq: 3913, experienceStartYear: 2017, isClaimed: false },
  { lastName: 'Хасанов', firstName: 'Булат', middleName: 'Ринатович', citySlug: 'kazan', regionSuffix: '16', registrySeq: 3914, experienceStartYear: 2020, isClaimed: false },
  { lastName: 'Мухаметшин', firstName: 'Рустем', middleName: 'Айратович', citySlug: 'kazan', regionSuffix: '16', registrySeq: 3915, experienceStartYear: 2012, isClaimed: true },
  { lastName: 'Орлов', firstName: 'Николай', middleName: 'Степанович', citySlug: 'novosibirsk', regionSuffix: '54', registrySeq: 5102, experienceStartYear: 2008, isClaimed: true },
  { lastName: 'Белова', firstName: 'Светлана', middleName: 'Геннадьевна', citySlug: 'novosibirsk', regionSuffix: '54', registrySeq: 5103, experienceStartYear: 2015, isClaimed: false },
  { lastName: 'Егоров', firstName: 'Владислав', middleName: 'Романович', citySlug: 'novosibirsk', regionSuffix: '54', registrySeq: 5104, experienceStartYear: 2011, isClaimed: true },
  { lastName: 'Романова', firstName: 'Ксения', middleName: 'Артёмовна', citySlug: 'novosibirsk', regionSuffix: '54', registrySeq: 5105, experienceStartYear: 2018, isClaimed: false },
  { lastName: 'Тихонов', firstName: 'Георгий', middleName: 'Максимович', citySlug: 'novosibirsk', regionSuffix: '54', registrySeq: 5106, experienceStartYear: 2006, isClaimed: false },
  { lastName: 'Смирнова', firstName: 'Вера', middleName: 'Константиновна', citySlug: 'novosibirsk', regionSuffix: '54', registrySeq: 5107, experienceStartYear: 2013, isClaimed: true },
  { lastName: 'Чернов', firstName: 'Артём', middleName: 'Денисович', citySlug: 'sochi', regionSuffix: '23', registrySeq: 1201, experienceStartYear: 2014, isClaimed: true },
  { lastName: 'Кравцова', firstName: 'Юлия', middleName: 'Евгеньевна', citySlug: 'sochi', regionSuffix: '23', registrySeq: 1202, experienceStartYear: 2016, isClaimed: false },
  { lastName: 'Данилов', firstName: 'Игорь', middleName: 'Станиславович', citySlug: 'sochi', regionSuffix: '23', registrySeq: 1203, experienceStartYear: 2009, isClaimed: true },
  { lastName: 'Мельник', firstName: 'Виктор', middleName: 'Борисович', citySlug: 'sochi', regionSuffix: '23', registrySeq: 1204, experienceStartYear: 2019, isClaimed: false },
  { lastName: 'Громова', firstName: 'Наталья', middleName: 'Ильинична', citySlug: 'sochi', regionSuffix: '23', registrySeq: 1205, experienceStartYear: 2012, isClaimed: false },
  { lastName: 'Лазарев', firstName: 'Константин', middleName: 'Фёдорович', citySlug: 'sochi', regionSuffix: '23', registrySeq: 1206, experienceStartYear: 2007, isClaimed: true },
];

function transliterate(s: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return s
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function lawyerSlug(last: string, first: string, middle: string, reg: string): string {
  return `${transliterate(last)}-${transliterate(first)}-${transliterate(middle)}-${reg.replace('/', '-')}`;
}

function initials(last: string, first: string, middle: string): string {
  const fi = first.charAt(0);
  const mi = middle.charAt(0);
  return `${last} ${fi}. ${mi}.`;
}

function scoreFromExperience(year: number): { total: number; practice: number; status: number; rep: number } {
  const years = new Date().getFullYear() - year;
  const practice = Math.min(3.5, 1.5 + years * 0.12);
  const status = Math.min(2.0, 1.0 + years * 0.06);
  const rep = Math.min(1.5, 0.5 + years * 0.05);
  const total = Math.round((practice + status + rep) * 10) / 10;
  return { total, practice, status, rep };
}

async function main() {
  console.log('🌱 Seeding database...\n');

  // ——— Clear tables (dependency order) ———
  await prisma.lead.deleteMany();
  await prisma.review.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.question.deleteMany();
  await prisma.claimRequest.deleteMany();
  await prisma.courtCase.deleteMany();
  await prisma.lawyerServicePrice.deleteMany();
  await prisma.lawyerSpecialization.deleteMany();
  await prisma.lawyer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.court.deleteMany();
  await prisma.lawFirm.deleteMany();
  await prisma.service.deleteMany();
  await prisma.category.deleteMany();
  await prisma.advocateChamber.deleteMany();
  await prisma.city.deleteMany();

  // ——— Cities ———
  await prisma.city.createMany({ data: [...CITY_DATA] });
  const cities = await prisma.city.findMany();
  const cityBySlug = Object.fromEntries(cities.map((c) => [c.slug, c]));

  // ——— Advocate chambers ———
  const chamberRows = [
    { slug: 'ap-moscow', name: 'Адвокатская палата города Москвы', regionCode: '77', address: 'ул. Дмитровка Б., 32, стр. 1, Москва', website: 'https://ap.moscow.ru' },
    { slug: 'ap-sverdlovsk', name: 'Адвокатская палата Свердловской области', regionCode: '66', address: 'ул. Малышева, 36, Екатеринбург', website: 'https://ap66.ru' },
    { slug: 'ap-tatarstan', name: 'Адвокатская палата Республики Татарстан', regionCode: '16', address: 'ул. Московская, 71, Казань', website: 'https://ap-tatarstan.ru' },
    { slug: 'ap-novosibirsk', name: 'Адвокатская палата Новосибирской области', regionCode: '54', address: 'ул. Ленина, 12, Новосибирск', website: 'https://ap54.ru' },
    { slug: 'ap-krasnodar', name: 'Адвокатская палата Краснодарского края', regionCode: '23', address: 'ул. Красная, 176, Краснодар', website: 'https://ap-krasnodar.ru' },
    { slug: 'ap-samara', name: 'Палата адвокатов Самарской области', regionCode: '63', address: 'ул. Ленинградская, 75, Самара', website: 'https://paso.ru' },
  ];
  await prisma.advocateChamber.createMany({ data: chamberRows });
  const chambers = await prisma.advocateChamber.findMany();
  const chamberByRegion = Object.fromEntries(chambers.map((c) => [c.regionCode, c]));

  // ——— Categories ———
  await prisma.category.createMany({ data: [...CATEGORY_DATA] });
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  // ——— Services ———
  const serviceRows = categories.flatMap((cat) =>
    (SERVICES_BY_CATEGORY[cat.slug] ?? []).map((svc) => ({
      ...svc,
      categoryId: cat.id,
    })),
  );
  await prisma.service.createMany({ data: serviceRows });
  const services = await prisma.service.findMany();
  const servicesByCategoryId = services.reduce<Record<string, typeof services>>((acc, s) => {
    (acc[s.categoryId] ??= []).push(s);
    return acc;
  }, {});

  // ——— Law firms (1–2 per city) ———
  const lawFirmRows = [
    { slug: 'kollegiya-moscow-pravo', name: 'Коллегия адвокатов «Московское право»', form: LawFirmForm.COLLEGIA, inn: '7701234567', citySlug: 'moscow', regionCode: '77' },
    { slug: 'byuro-centr-moscow', name: 'Адвокатское бюро «Центр защиты»', form: LawFirmForm.BUREAU, inn: '7702345678', citySlug: 'moscow', regionCode: '77' },
    { slug: 'kollegiya-ural', name: 'Коллегия адвокатов «Урал»', form: LawFirmForm.COLLEGIA, inn: '6601234567', citySlug: 'ekaterinburg', regionCode: '66' },
    { slug: 'kabinet-ekb', name: 'Адвокатский кабинет Егорова и партнёров', form: LawFirmForm.CABINET, inn: '6602345678', citySlug: 'ekaterinburg', regionCode: '66' },
    { slug: 'kollegiya-kazan', name: 'Коллегия адвокатов Республики Татарстан', form: LawFirmForm.COLLEGIA, inn: '1601234567', citySlug: 'kazan', regionCode: '16' },
    { slug: 'legal-kazan', name: 'Юридическая компания «ТатПраво»', form: LawFirmForm.LEGAL_COMPANY, inn: '1602345678', citySlug: 'kazan', regionCode: '16' },
    { slug: 'kollegiya-sibir', name: 'Коллегия адвокатов «Сибирь»', form: LawFirmForm.COLLEGIA, inn: '5401234567', citySlug: 'novosibirsk', regionCode: '54' },
    { slug: 'byuro-nsk', name: 'Адвокатское бюро «Новосибирск»', form: LawFirmForm.BUREAU, inn: '5402345678', citySlug: 'novosibirsk', regionCode: '54' },
    { slug: 'kollegiya-chernomore', name: 'Коллегия адвокатов «Черноморье»', form: LawFirmForm.COLLEGIA, inn: '2301234567', citySlug: 'sochi', regionCode: '23' },
  ];
  await prisma.lawFirm.createMany({
    data: lawFirmRows.map((f) => ({
      slug: f.slug,
      name: f.name,
      form: f.form,
      inn: f.inn,
      ogrn: `1${f.inn.slice(0, 9)}001`,
      address: `г. ${cityBySlug[f.citySlug].name}, ул. Примерная, 1`,
      phone: '+7 (495) 000-00-00',
      website: `https://${f.slug}.ru`,
      cityId: cityBySlug[f.citySlug].id,
      chamberId: chamberByRegion[f.regionCode].id,
    })),
  });
  const lawFirms = await prisma.lawFirm.findMany();
  const firmsByCityId = lawFirms.reduce<Record<string, typeof lawFirms>>((acc, f) => {
    (acc[f.cityId] ??= []).push(f);
    return acc;
  }, {});

  // ——— Admin user ———
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@portal.local',
      passwordHash: ADMIN_PASSWORD,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  // ——— Lawyers ———
  const categorySlugsForLawyer = (idx: number): string[] => {
    const primary = CATEGORY_DATA[idx % CATEGORY_DATA.length].slug;
    const secondary = CATEGORY_DATA[(idx + 3) % CATEGORY_DATA.length].slug;
    return idx % 4 === 0 ? [primary, secondary] : [primary];
  };

  const lawyerCreateData = LAWYER_NAMES.map((l, idx) => {
    const city = cityBySlug[l.citySlug];
    const chamber = chamberByRegion[l.regionSuffix];
    const firms = firmsByCityId[city.id];
    const lawFirm = firms[idx % firms.length];
    const reg = `${l.regionSuffix}/${l.registrySeq}`;
    const fullName = `${l.lastName} ${l.firstName} ${l.middleName}`;
    const scores = scoreFromExperience(l.experienceStartYear);
    const base = {
      slug: lawyerSlug(l.lastName, l.firstName, l.middleName, reg),
      fullName,
      lastName: l.lastName,
      firstName: l.firstName,
      middleName: l.middleName,
      initialsSearch: initials(l.lastName, l.firstName, l.middleName),
      registryNumber: reg,
      registryStatus: RegistryStatus.ACTIVE,
      statusUpdatedAt: new Date('2024-01-15'),
      identityCardNumber: `${l.regionSuffix}/${String(l.registrySeq).padStart(4, '0')}`,
      isClaimed: l.isClaimed,
      cityId: city.id,
      chamberId: chamber.id,
      lawFirmId: lawFirm.id,
      experienceStartYear: l.experienceStartYear,
      totalRating: scores.total,
      practiceScore: scores.practice,
      statusAndExpScore: scores.status,
      reputationScore: scores.rep,
      worksOnline: idx % 3 === 0,
      worksRegions: idx % 5 === 0,
      officeAddress: `г. ${city.name}, ул. Адвокатская, ${10 + idx}`,
    };
    if (l.isClaimed) {
      return {
        ...base,
        isVerifiedDocuments: true,
        claimedAt: new Date('2024-06-01'),
        bio: `${fullName} — адвокат с ${l.experienceStartYear} года. Специализируется на делах, связанных с защитой прав граждан и организаций в ${city.nameGenitive}.`,
        education: 'МГЮА им. О.Е. Кутафина, юридический факультет',
        minConsultationPrice: 3_000 + (idx % 5) * 500,
        freeFirstCheck: idx % 2 === 0,
        publicPhone: `+7 (9${String(idx).padStart(2, '0')}) ${100 + idx}-${20 + idx}-${30 + idx}`,
        telegramUsername: idx % 3 === 0 ? `lawyer_${transliterate(l.lastName)}` : undefined,
      };
    }
    return base;
  });

  await prisma.lawyer.createMany({ data: lawyerCreateData });
  const lawyers = await prisma.lawyer.findMany({ orderBy: { registryNumber: 'asc' } });

  // ——— Lawyer users (2–3 claimed) ———
  const claimedForUsers = lawyers.filter((lw) => lw.isClaimed).slice(0, 3);
  const lawyerUserEmails = [
    'ivanov@portal.local',
    'volkova@portal.local',
    'safin@portal.local',
  ];
  for (let i = 0; i < claimedForUsers.length; i++) {
    const user = await prisma.user.create({
      data: {
        email: lawyerUserEmails[i],
        passwordHash: LAWYER_PASSWORD,
        role: UserRole.LAWYER,
        phone: `+7900${String(i).padStart(7, '0')}`,
      },
    });
    await prisma.lawyer.update({
      where: { id: claimedForUsers[i].id },
      data: { userId: user.id },
    });
  }

  // ——— Specializations ———
  const specRows = lawyers.flatMap((lw, idx) => {
    const slugs = categorySlugsForLawyer(idx);
    return slugs.map((slug, j) => ({
      lawyerId: lw.id,
      categoryId: categoryBySlug[slug].id,
      isPrimary: j === 0,
      casesInCategory: 0,
    }));
  });
  await prisma.lawyerSpecialization.createMany({ data: specRows });

  // ——— Service prices (claimed lawyers) ———
  const priceRows: { lawyerId: string; serviceId: string; priceFrom: number; priceComment?: string }[] = [];
  for (const lw of lawyers.filter((l) => l.isClaimed)) {
    const specs = specRows.filter((s) => s.lawyerId === lw.id);
    for (const spec of specs) {
      const catServices = servicesByCategoryId[spec.categoryId] ?? [];
      for (const svc of catServices.slice(0, 2)) {
        priceRows.push({
          lawyerId: lw.id,
          serviceId: svc.id,
          priceFrom: (svc.avgMarketPrice ?? 50_000) - 10_000 + Math.floor(Math.random() * 5_000),
          priceComment: 'Предварительная консультация включена',
        });
      }
    }
  }
  await prisma.lawyerServicePrice.createMany({ data: priceRows });

  // ——— Courts ———
  const courtRows = [
    { slug: 'as-moscow', courtCode: 'AS-MOW', name: 'Арбитражный суд города Москвы', courtType: CourtType.ARBITRATION, citySlug: 'moscow' },
    { slug: 'sverdlovsky-oblastnoj', courtCode: 'OS-SVE', name: 'Свердловский областной суд', courtType: CourtType.GENERAL, citySlug: 'ekaterinburg' },
    { slug: 'verhovnyj-tatarstan', courtCode: 'VS-TAT', name: 'Верховный Суд Республики Татарстан', courtType: CourtType.GENERAL, citySlug: 'kazan' },
    { slug: 'as-novosibirsk', courtCode: 'AS-NVS', name: 'Арбитражный суд Новосибирской области', courtType: CourtType.ARBITRATION, citySlug: 'novosibirsk' },
    { slug: 'magistrat-sochi-1', courtCode: 'MS-SOCHI-1', name: 'Судебный участок № 1 г. Сочи', courtType: CourtType.MAGISTRATE, citySlug: 'sochi' },
  ];
  await prisma.court.createMany({
    data: courtRows.map((c) => ({
      slug: c.slug,
      courtCode: c.courtCode,
      name: c.name,
      courtType: c.courtType,
      address: `г. ${cityBySlug[c.citySlug].name}, ул. Судебная, 1`,
      cityId: cityBySlug[c.citySlug].id,
    })),
  });
  const courts = await prisma.court.findMany();
  const courtByCityId = Object.fromEntries(courts.map((c) => [c.cityId, c]));

  // ——— Court cases (50) ———
  const outcomes: CaseOutcome[] = [
    CaseOutcome.WIN,
    CaseOutcome.WIN,
    CaseOutcome.PARTIAL,
    CaseOutcome.LOSS,
    CaseOutcome.SETTLEMENT,
    CaseOutcome.IN_PROGRESS,
    CaseOutcome.UNKNOWN,
  ];
  const caseTemplates = [
    { prefix: 'А40', title: 'Спор о взыскании задолженности по договору поставки', articles: ['ст. 395 ГК РФ', 'ст. 516 ГК РФ'] },
    { prefix: '2', title: 'Иск о разделе совместно нажитого имущества супругов', articles: ['ст. 38 СК РФ', 'ст. 34 СК РФ'] },
    { prefix: '22', title: 'Апелляционная жалоба по делу о мошенничестве', articles: ['ст. 159 УК РФ', 'ст. 389.15 УПК РФ'] },
    { prefix: '1', title: 'Иск о восстановлении на работе', articles: ['ст. 394 ТК РФ', 'ст. 77 ТК РФ'] },
    { prefix: 'А56', title: 'Банкротство застройщика', articles: ['ст. 7 ФЗ-127', 'ст. 213.4 ФЗ-127'] },
    { prefix: '33', title: 'Спор о признании права собственности на жилое помещение', articles: ['ст. 292 ГК РФ', 'ст. 161 ЖК РФ'] },
    { prefix: '12', title: 'Обжалование постановления по делу об административном правонарушении', articles: ['ст. 12.9 КоАП РФ', 'ст. 30.1 КоАП РФ'] },
    { prefix: 'А41', title: 'Корпоративный спор о выходе участника из ООО', articles: ['ст. 94 ГК РФ', 'ст. 225.1 АПК РФ'] },
    { prefix: '2а', title: 'Наследственный спор об оспаривании завещания', articles: ['ст. 1117 ГК РФ', 'ст. 1152 ГК РФ'] },
    { prefix: '45', title: 'Дело о незаконном хранении наркотических средств', articles: ['ст. 228 УК РФ', 'ст. 228.1 УК РФ'] },
  ];

  const caseRows = Array.from({ length: 50 }, (_, i) => {
    const lw = lawyers[i % lawyers.length];
    const court = courtByCityId[lw.cityId];
    const spec = specRows.find((s) => s.lawyerId === lw.id && s.isPrimary)!;
    const catId = spec.categoryId;
    const catServices = servicesByCategoryId[catId] ?? [];
    const service = catServices[i % Math.max(catServices.length, 1)];
    const tpl = caseTemplates[i % caseTemplates.length];
    const year = 2024 + (i % 2);
    const caseNum =
      tpl.prefix.startsWith('А')
        ? `${tpl.prefix}-${10000 + i}/${year}`
        : `${tpl.prefix}-${100 + i}/${year}`;
    const outcome = outcomes[i % outcomes.length];
    const decisionDate =
      outcome === CaseOutcome.IN_PROGRESS ? null : new Date(`${year}-${String((i % 12) + 1).padStart(2, '0')}-15`);

    return {
      slug: `case-${transliterate(caseNum)}-${i}`,
      externalUid: `seed-case-${i + 1}`,
      caseNumber: caseNum,
      title: tpl.title,
      summary: `Судебное дело № ${caseNum}. ${tpl.title}. Представительство интересов клиента адвокатом ${lw.fullName}.`,
      lawArticles: tpl.articles,
      decisionDate,
      outcome,
      claimAmount: BigInt(100_000 + i * 25_000),
      sourceUrl: `https://kad.arbitr.ru/Card/${i + 1}`,
      isVerifiedByLawyer: lw.isClaimed && i % 3 === 0,
      lawyerId: lw.id,
      courtId: court?.id,
      categoryId: catId,
      serviceId: service?.id,
    };
  });
  await prisma.courtCase.createMany({ data: caseRows });

  // ——— Update lawyer case counts ———
  for (const lw of lawyers) {
    const lwCases = caseRows.filter((c) => c.lawyerId === lw.id);
    const won = lwCases.filter((c) => c.outcome === CaseOutcome.WIN || c.outcome === CaseOutcome.PARTIAL).length;
    await prisma.lawyer.update({
      where: { id: lw.id },
      data: {
        casesCount: lwCases.length,
        wonCasesCount: won,
      },
    });
  }

  // ——— Update specialization case counts ———
  for (const lw of lawyers) {
    const lwCases = caseRows.filter((c) => c.lawyerId === lw.id);
    const byCat = lwCases.reduce<Record<string, number>>((acc, c) => {
      if (c.categoryId) acc[c.categoryId] = (acc[c.categoryId] ?? 0) + 1;
      return acc;
    }, {});
    for (const [catId, count] of Object.entries(byCat)) {
      await prisma.lawyerSpecialization.updateMany({
        where: { lawyerId: lw.id, categoryId: catId },
        data: { casesInCategory: count },
      });
    }
  }

  // ——— Questions & answers ———
  const questionRows = [
    {
      slug: 'kak-vzyskat-dolg-po-raspiske',
      title: 'Как взыскать долг по расписке, если должник пропал?',
      body: 'Дал в долг знакомому 500 000 рублей под расписку. Срок истёк, телефон не отвечает. Куда обращаться и сколько это займёт?',
      authorName: 'Алексей К.',
      citySlug: 'moscow',
      categorySlug: 'grazhdanskoe-pravo',
    },
    {
      slug: 'razvod-i-alimenty-na-dvoih-detej',
      title: 'Развод и алименты на двоих детей — какой размер?',
      body: 'Планируем развод по обоюдному согласию. Двое детей 5 и 9 лет. Как обычно определяют алименты и можно ли оформить соглашение?',
      authorName: 'Марина С.',
      citySlug: 'kazan',
      categorySlug: 'semeynoe-pravo',
    },
    {
      slug: 'uvolnenie-bez-vyplat',
      title: 'Уволили без выплаты зарплаты за последний месяц',
      body: 'Работодатель уволил по сокращению, но не выплатил зарплату и компенсацию. Какие сроки на обращение в суд?',
      authorName: 'Дмитрий П.',
      citySlug: 'novosibirsk',
      categorySlug: 'trudovoe-pravo',
    },
    {
      slug: 'vnzh-pri-pokupke-kvartiry',
      title: 'Можно ли получить ВНЖ при покупке квартиры в Сочи?',
      body: 'Гражданин Казахстана, рассматриваю покупку жилья. Достаточно ли этого для ВНЖ?',
      authorName: 'Анонимно',
      citySlug: 'sochi',
      categorySlug: 'migracionnoe-pravo',
    },
  ];
  await prisma.question.createMany({
    data: questionRows.map((q) => ({
      slug: q.slug,
      title: q.title,
      body: q.body,
      authorName: q.authorName,
      cityId: cityBySlug[q.citySlug].id,
      categoryId: categoryBySlug[q.categorySlug].id,
      viewsCount: 50 + Math.floor(Math.random() * 200),
    })),
  });
  const questions = await prisma.question.findMany();

  const answerRows = questions.map((q, i) => {
    const lw = claimedForUsers[i % claimedForUsers.length] ?? lawyers[0];
    return {
      questionId: q.id,
      lawyerId: lw.id,
      body: `Здравствуйте! По вашему вопросу рекомендую обратиться к адвокату очно для анализа документов. Общий алгоритм: досудебная претензия, затем иск в суд. Срок исковой давности — как правило, 3 года. С уважением, ${lw.fullName}.`,
      isBestAnswer: i === 0,
      likesCount: 3 + i,
    };
  });
  await prisma.answer.createMany({ data: answerRows });

  for (const a of answerRows) {
    await prisma.lawyer.update({
      where: { id: a.lawyerId },
      data: { answersCount: { increment: 1 } },
    });
  }

  // ——— Reviews (APPROVED) ———
  const reviewRows = claimedForUsers.flatMap((lw, li) =>
    [0, 1].map((ri) => ({
      lawyerId: lw.id,
      authorName: ['Игорь В.', 'Светлана М.', 'Олег Т.'][li + ri] ?? 'Клиент',
      authorPhone: `+7901${String(li * 10 + ri).padStart(7, '0')}`,
      rating: 4 + (ri % 2),
      pros: 'Профессиональный подход, понятные объяснения.',
      cons: ri === 1 ? 'Долго ждали первой встречи.' : null,
      comment: `Обращался к адвокату ${lw.fullName}. Дело довели до успешного результата, рекомендую.`,
      status: VerificationStatus.APPROVED,
      isVerifiedClient: ri === 0,
    })),
  );
  await prisma.review.createMany({ data: reviewRows });
  for (const lw of claimedForUsers) {
    const count = reviewRows.filter((r) => r.lawyerId === lw.id).length;
    await prisma.lawyer.update({
      where: { id: lw.id },
      data: { reviewsCount: count },
    });
  }

  // ——— Leads ———
  const leadRows = [
    {
      clientName: 'Пётр Николаев',
      clientPhone: '+79161234567',
      problemText: 'Нужна защита по уголовному делу по ст. 159 УК РФ.',
      citySlug: 'moscow',
      categorySlug: 'ugolovnoe-pravo',
      serviceSlug: 'zashchita-po-moshennichestvu',
      lawyerIdx: 0,
      status: LeadStatus.NEW,
    },
    {
      clientName: 'Екaterina Orlova',
      clientPhone: '+79221234567',
      problemText: 'Спор с работодателем после увольнения.',
      citySlug: 'ekaterinburg',
      categorySlug: 'trudovoe-pravo',
      serviceSlug: 'vosstanovlenie-na-rabote',
      lawyerIdx: 6,
      status: LeadStatus.SENT_TO_LAWYER,
    },
    {
      clientName: 'Рустам Г.',
      clientPhone: '+79371234567',
      problemText: 'Раздел имущества при разводе.',
      citySlug: 'kazan',
      categorySlug: 'semeynoe-pravo',
      serviceSlug: 'razvod-i-razdel-imushchestva',
      status: LeadStatus.IN_WORK,
    },
    {
      clientName: 'Анна Л.',
      clientPhone: '+79131234567',
      problemText: 'Консультация по банкротству физлица.',
      citySlug: 'novosibirsk',
      categorySlug: 'bankrotstvo',
      serviceSlug: 'bankrotstvo-fizlica',
      status: LeadStatus.CLOSED,
    },
    {
      clientName: 'Тест',
      clientPhone: '+70000000000',
      problemText: 'Спам-сообщение.',
      citySlug: 'sochi',
      categorySlug: 'administrativnoe-pravo',
      status: LeadStatus.SPAM,
    },
  ];
  await prisma.lead.createMany({
    data: leadRows.map((lead) => {
      const cat = categoryBySlug[lead.categorySlug];
      const svc = lead.serviceSlug
        ? services.find((s) => s.slug === lead.serviceSlug && s.categoryId === cat.id)
        : undefined;
      const lw = lead.lawyerIdx != null ? lawyers[lead.lawyerIdx] : undefined;
      return {
        clientName: lead.clientName,
        clientPhone: lead.clientPhone,
        problemText: lead.problemText,
        sourceUrl: 'https://portal.local/',
        cityId: cityBySlug[lead.citySlug].id,
        categoryId: cat.id,
        serviceId: svc?.id,
        lawyerId: lw?.id,
        status: lead.status,
      };
    }),
  });

  // ——— Claim request (pending) ———
  const unclaimed = lawyers.find((l) => !l.isClaimed);
  if (unclaimed) {
    await prisma.claimRequest.create({
      data: {
        lawyerId: unclaimed.id,
        applicantName: 'Претендент П.П.',
        workEmail: 'claim@example.com',
        workPhone: '+79990001122',
        idCardScanUrl: 'https://storage.portal.local/claims/sample.pdf',
        comment: 'Прошу подтвердить право на профиль.',
        status: VerificationStatus.PENDING,
      },
    });
  }

  // ——— City activeLawyersCount ———
  for (const city of cities) {
    const activeCount = lawyers.filter((l) => l.cityId === city.id && l.registryStatus === RegistryStatus.ACTIVE).length;
    await prisma.city.update({
      where: { id: city.id },
      data: { activeLawyersCount: activeCount },
    });
  }

  // ——— Summary ———
  const counts = {
    cities: await prisma.city.count(),
    chambers: await prisma.advocateChamber.count(),
    categories: await prisma.category.count(),
    services: await prisma.service.count(),
    lawFirms: await prisma.lawFirm.count(),
    lawyers: await prisma.lawyer.count(),
    claimedLawyers: await prisma.lawyer.count({ where: { isClaimed: true } }),
    courts: await prisma.court.count(),
    courtCases: await prisma.courtCase.count(),
    questions: await prisma.question.count(),
    answers: await prisma.answer.count(),
    reviews: await prisma.review.count(),
    leads: await prisma.lead.count(),
    users: await prisma.user.count(),
    claimRequests: await prisma.claimRequest.count(),
  };

  console.log('✅ Seed completed successfully!\n');
  console.log('Summary:');
  console.log(`  Cities:              ${counts.cities}`);
  console.log(`  Advocate chambers:   ${counts.chambers}`);
  console.log(`  Categories:          ${counts.categories}`);
  console.log(`  Services:            ${counts.services}`);
  console.log(`  Law firms:           ${counts.lawFirms}`);
  console.log(`  Lawyers:             ${counts.lawyers} (${counts.claimedLawyers} claimed)`);
  console.log(`  Courts:              ${counts.courts}`);
  console.log(`  Court cases:         ${counts.courtCases}`);
  console.log(`  Questions / Answers: ${counts.questions} / ${counts.answers}`);
  console.log(`  Reviews:             ${counts.reviews}`);
  console.log(`  Leads:               ${counts.leads}`);
  console.log(`  Users:               ${counts.users} (admin: admin@portal.local / admin123)`);
  console.log(`  Lawyer logins:       ${lawyerUserEmails.join(', ')} / lawyer123`);
  console.log(`  Claim requests:      ${counts.claimRequests}`);
  console.log(`\n  Admin user id:       ${adminUser.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
