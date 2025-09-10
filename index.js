require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, 
  GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildMembers] });

const CALENDAR_DIR = path.join(__dirname, 'moon_calendars');

// 폴더 없으면 생성
if (!fs.existsSync(CALENDAR_DIR)) {
  fs.mkdirSync(CALENDAR_DIR);
}

client.once('ready', () => {
  console.log(`✅ 로그인 성공: ${client.user.tag}`);
});

// 달력 이미지 가져오기 (있으면 로컬, 없으면 크롤링)
async function getMoonCalendarImage() {
  const today = new Date();
  const filename = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}.png`;
  const filePath = path.join(CALENDAR_DIR, filename);

  if (fs.existsSync(filePath)) {
    console.log('💾 저장된 달력 사용:', filename);
    return fs.readFileSync(filePath);
  }

  console.log('🌙 달력 크롤링 중...');
  const browser = await puppeteer.launch({
    headless: true,  // GUI 없이 실행
    executablePath: '/usr/bin/chromium-browser', // 라즈비안 기본 Chromium 경로
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 넓은 가로 화면으로 설정
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('https://kr.rhythmofnature.net/dal-uiwisang', { waitUntil: 'networkidle2' });

  const calendarSelector = '#moon-calendar';
  const calendar = await page.$(calendarSelector);

  let buffer;
  if (calendar) {
    buffer = await calendar.screenshot({ type: 'png' });
  } else {
    buffer = await page.screenshot({ fullPage: true, type: 'png' });
  }

  await browser.close();

  // 저장
  fs.writeFileSync(filePath, buffer);
  console.log('✅ 달력 저장 완료:', filename);

  return buffer;
}

// 메시지 이벤트 처리
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content === '!달위상') {
    const msg = await message.channel.send('⏳ 달력 가져오는 중...');
    try {
      const imageBuffer = await getMoonCalendarImage();

      const embed = new EmbedBuilder()
        .setTitle('🌙 달 위상 달력')
        .setDescription('서울 기준 달력입니다.')
        .setColor('#FFD700')
        .setImage('attachment://moon_calendar.png')
        .setFooter({ text: '출처: Rhythm of Nature' });

      await msg.edit({ content: null, embeds: [embed], files: [{ attachment: imageBuffer, name: 'moon_calendar.png' }] });
    } catch (err) {
      console.error('⚠️ 달력 전송 오류:', err);
      await msg.edit('⚠️ 달력 가져오기에 실패했습니다.');
    }
  }
});

// 모임 카운터
let meetingCount = 22;

// 투표 참여자 저장
const participants = new Set();

// 정기 알림 (예: 매일 23:00)
schedule.scheduleJob({ hour: 18, minute: 0, tz: 'Asia/Seoul' }, async () => {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return console.error('길드 찾기 실패');

  const channel = guild.channels.cache.find(
    ch => ch.name === '👁🗨-수행계획방' && ch.isTextBased()
  );
  if (!channel) return console.error('수행계획방 찾기 실패');

  // 초기 메시지
  const messageText = `[제 ${meetingCount}차] 수행 모임\n` +
                      `장소: 음성 채널 수행방(온라인)\n` +
                      `시각: ${new Date().toLocaleDateString('ko-KR')} - 23:00 ~ 24:00\n` +
                      `인원:  0인(아직 없음)\n` +
                      `활동 내용: 각자 수행 및 일지 작성`;

  const msg = await channel.send(messageText);

  // 투표용 반응 추가
  await msg.react('✅'); // 참여
  await msg.react('❌'); // 불참

  // 투표 반응 수 실시간 집계
  const filter = (reaction, user) => !user.bot && (reaction.emoji.name === '✅' || reaction.emoji.name === '❌');
  const collector = msg.createReactionCollector({ filter, time: 6 * 60 * 60 * 1000 }); // 1시간 동안 수집
  
  collector.on('collect', async (reaction, user) => {

    const foundU = await msg.guild.members.fetch(user.id);
    const displayName = foundU.displayName;

    if (reaction.emoji.name === '✅') {
      participants.add(displayName);
    } else if (reaction.emoji.name === '❌') {
      participants.delete(displayName);
    }

    // 메시지 업데이트
    const participantList = Array.from(participants).join(', ') || '아직 없음';
    msg.edit(`[제 ${meetingCount}차] 수행 모임\n` +
             `장소: 음성 채널 수행방(온라인)\n` +
             `시각: ${new Date().toLocaleDateString('ko-KR')} - 23:00 ~ 24:00\n` +
             `인원:  ${participants.size}인(${participantList})\n` +
             `활동 내용: 각자 헤르메스학 수행 및 일지 작성`);
  });

  collector.on('end', () => {
    console.log('⏱️ 투표 종료, 최종 인원:', participants.size);
    msg.edit(`[제 ${meetingCount}차] 수행 모임 [완료]\n` +
             `장소: 음성 채널 수행방(온라인)\n` +
             `시각: ${new Date().toLocaleDateString('ko-KR')} - 23:00 ~ 24:00\n` +
             `인원:  ${participants.size}인(${participantList})\n` +
             `활동 내용: 각자 헤르메스학 수행 및 일지 작성`);
  });
});

client.login(process.env.TOKEN);

