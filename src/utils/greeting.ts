import { getStorage, setStorage, getTodayString } from "./storage";

type TimePeriod = "dawn" | "morning" | "noon" | "afternoon" | "evening" | "night";

interface GreetingContext {
  streakDays: number;
  mood: string | null;
  hasMatureCrops: boolean;
  nickname: string;
}

interface CachedGreeting {
  date: string;
  period: TimePeriod;
  streakDays: number;
  mood: string | null;
  hasMatureCrops: boolean;
  nickname: string;
  message: string;
}

const TIME_PERIODS: { start: number; end: number; period: TimePeriod }[] = [
  { start: 0, end: 6, period: "dawn" },
  { start: 6, end: 11, period: "morning" },
  { start: 11, end: 14, period: "noon" },
  { start: 14, end: 17, period: "afternoon" },
  { start: 17, end: 20, period: "evening" },
  { start: 20, end: 24, period: "night" },
];

const BASE_GREETINGS: Record<TimePeriod, string[]> = {
  dawn: [
    "{nickname}，天还没亮呢，怎么醒这么早呀？",
    "夜深了，{nickname}是不是睡不着呀？",
    "乖乖，现在还是深夜呢，要好好休息哦～",
  ],
  morning: [
    "早上好呀{nickname}！今天也是元气满满的一天！",
    "{nickname}起床啦！清晨的空气真新鲜～",
    "新的一天开始了，{nickname}今天有什么计划呀？",
    "早安{nickname}！阳光洒进来啦，快起来活动活动～",
  ],
  noon: [
    "{nickname}，中午好呀！肚子饿不饿？",
    "午饭时间到啦，{nickname}今天吃什么好吃的？",
    "中午好{nickname}！忙了一上午，休息一下吧～",
    "{nickname}，正午太阳暖洋洋的，舒服吗？",
  ],
  afternoon: [
    "{nickname}下午好！今天过得怎么样呀？",
    "下午茶时间到啦，{nickname}要不要来点小零食？",
    "午后的时光真惬意，{nickname}在做什么呢？",
    "{nickname}，下午也要开开心心的哦～",
  ],
  evening: [
    "{nickname}，傍晚好！天边的晚霞真美呀～",
    "太阳快落山啦，{nickname}今天过得充实吗？",
    "傍晚的风吹过来真舒服，{nickname}感受到了吗？",
    "{nickname}，一天又快过去了，有没有想爸爸妈妈呀？",
  ],
  night: [
    "{nickname}晚上好！今天玩得开心吗？",
    "夜晚降临啦，{nickname}有没有数星星呀？",
    "{nickname}，记得早点睡觉，明天还要早起哦～",
    "晚安前的时光，{nickname}想和爸爸妈妈说说话吗？",
  ],
};

const STREAK_ENCOURAGEMENT: { threshold: number; messages: string[] }[] = [
  {
    threshold: 3,
    messages: [
      "你已经连续签到{days}天了，真棒！",
      "连续{days}天打卡，你真是个有毅力的好孩子！",
      "{days}天坚持签到，继续加油哦～",
    ],
  },
  {
    threshold: 7,
    messages: [
      "哇！你已经连续签到一周了，太厉害了！",
      "整整{days}天不间断，你就是我们的小榜样！",
      "{days}天连续签到，这就是坚持的力量！",
    ],
  },
  {
    threshold: 14,
    messages: [
      "太厉害了！连续签到{days}天，半个月啦！",
      "{days}天的坚持，你真的太棒了！",
      "两周连续打卡，你是最棒的小宝贝！",
    ],
  },
  {
    threshold: 30,
    messages: [
      "我的天！你已经连续签到整整{days}天了！",
      "{days}天不间断，你创造了一个小小的奇迹！",
      "一个月的坚持，你真是太了不起了！",
    ],
  },
];

const MISSING_PARENTS_COMFORT: string[] = [
  "爸爸妈妈也很想你哦，他们在外面努力工作，都是为了给你更好的生活～",
  "想爸爸妈妈的时候，可以给他们留个言，他们看到一定会很开心的！",
  "爸爸妈妈虽然不在身边，但心里一直想着你呢，你是他们最爱的宝贝～",
  "乖，不哭，爸爸妈妈很快就会回来看你的，你要好好照顾自己哦～",
  "想爸爸妈妈了就看看天上的星星，他们也在远方看着你呢～",
];

const CROP_HARVEST_REMINDER: string[] = [
  "对了，农田里的庄稼成熟了，快去收获吧！",
  "呀，你的作物已经成熟啦，快去农场看看吧～",
  "别忘了去农场收获成熟的庄稼哦，能换好多金币呢！",
  "农田里传来好消息，你的作物可以收获啦！",
];

function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) / 2147483647;
}

function pickRandom<T>(arr: T[], seed: string): T {
  const random = seededRandom(seed);
  const index = Math.floor(random * arr.length);
  return arr[index];
}

export function getTimePeriod(): TimePeriod {
  const hour = new Date().getHours();
  for (const { start, end, period } of TIME_PERIODS) {
    if (hour >= start && hour < end) {
      return period;
    }
  }
  return "morning";
}

function getStreakMessage(days: number, seed: string): string | null {
  for (let i = STREAK_ENCOURAGEMENT.length - 1; i >= 0; i--) {
    const { threshold, messages } = STREAK_ENCOURAGEMENT[i];
    if (days >= threshold) {
      const msg = pickRandom(messages, seed + "_streak");
      return msg.replace("{days}", String(days));
    }
  }
  return null;
}

function getMoodMessage(mood: string | null, seed: string): string | null {
  if (mood === "想爸妈") {
    return pickRandom(MISSING_PARENTS_COMFORT, seed + "_mood");
  }
  return null;
}

function getCropMessage(hasMatureCrops: boolean, seed: string): string | null {
  if (hasMatureCrops) {
    return pickRandom(CROP_HARVEST_REMINDER, seed + "_crop");
  }
  return null;
}

function buildGreeting(context: GreetingContext, period: TimePeriod, seed: string): string {
  const baseGreeting = pickRandom(BASE_GREETINGS[period], seed + "_base");
  const baseWithName = baseGreeting.replace("{nickname}", context.nickname || "宝贝");

  const parts: string[] = [baseWithName];

  const streakMsg = getStreakMessage(context.streakDays, seed);
  if (streakMsg) {
    parts.push(streakMsg);
  }

  const moodMsg = getMoodMessage(context.mood, seed);
  if (moodMsg) {
    parts.push(moodMsg);
  }

  const cropMsg = getCropMessage(context.hasMatureCrops, seed);
  if (cropMsg) {
    parts.push(cropMsg);
  }

  return parts.join(" ");
}

export function generateGreeting(context: GreetingContext): string {
  const today = getTodayString();
  const period = getTimePeriod();
  const seed = `${today}_${period}_${context.streakDays}_${context.mood}_${context.hasMatureCrops}_${context.nickname}`;

  const cached = getStorage<CachedGreeting | null>("greeting_cache", null);
  if (
    cached &&
    cached.date === today &&
    cached.period === period &&
    cached.streakDays === context.streakDays &&
    cached.mood === context.mood &&
    cached.hasMatureCrops === context.hasMatureCrops &&
    cached.nickname === context.nickname
  ) {
    return cached.message;
  }

  const message = buildGreeting(context, period, seed);

  setStorage<CachedGreeting>("greeting_cache", {
    date: today,
    period,
    streakDays: context.streakDays,
    mood: context.mood,
    hasMatureCrops: context.hasMatureCrops,
    nickname: context.nickname,
    message,
  });

  return message;
}

export function hasMatureCrops(plots: { stage: string }[]): boolean {
  return plots.some(plot => plot.stage === "mature");
}
