require('dotenv').config();
const { 
  Client,
  PermissionFlagsBits, 
  GatewayIntentBits, 
  EmbedBuilder, 
  SlashCommandBuilder, 
  REST, 
  Routes 
} = require("discord.js");
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');

const DATA_FILE = "./data.json";


const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, 
  GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildMembers] });
/*
// 타임 슬롯 정의
const TIME_SLOTS = ["A", "B", "C", "D", "E"];
const INTERVAL_MINUTES = 20;

// 현재 시간이 어떤 슬롯인지 계산
function getCurrentTimeSlot() {
  const now = new Date();

  // 한국 시간으로 변환
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));

  const hour = kst.getHours();
  const minute = kst.getMinutes();
  const totalMinutes = hour * 60 + minute;

  const slotIndex = Math.floor(totalMinutes / INTERVAL_MINUTES) % TIME_SLOTS.length;
  const slot = TIME_SLOTS[slotIndex];

  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");

  return { slot, time: `${hh}:${mm}` };
}

// SlashCommand 등록
const timeSlotCommand = new SlashCommandBuilder()
  .setName("현재타임")
  .setDescription("현재 시간이 A/B/C/D/E 중 어디 타임인지 확인");

// 실행부
if (interaction.commandName === "현재타임") {
  const { slot, time } = getCurrentTimeSlot();
  await interaction.reply(`🕒 현재 한국 시간 **${time}** 은 **${slot}타임** 입니다.`);
}
*/
const CALENDAR_DIR = path.join(__dirname, 'moon_calendars');


client.once('ready', () => {
  console.log(`✅ 로그인 성공: ${client.user.tag}`);
});

// 새 멤버가 들어왔을 때 실행
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(process.env.GREETING_CHANEL_ID);
  if (!channel) return;

  channel.send(`🎉 환영합니다, <@${member.id}> 님! 서버에 오신 걸 환영해요!`);
});


// ================= 데이터 로드/저장 =================
function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { lectures: [], questions: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ================== 슬래시 명령어 ==================
const commands = [

  // 강의 관리
  new SlashCommandBuilder()
    .setName("강의등록")
    .setDescription("강의 등록")
    .addStringOption(opt => opt.setName("제목").setDescription("강의 제목").setRequired(true))
    .addStringOption(opt => opt.setName("날짜").setDescription("YYYY-MM-DD").setRequired(true))
    .addStringOption(opt => opt.setName("시작").setDescription("HH:MM").setRequired(true))
    .addStringOption(opt => opt.setName("종료").setDescription("HH:MM").setRequired(true))
    .addStringOption(opt => opt.setName("장소").setDescription("강의 장소").setRequired(true))
    .addStringOption(opt => opt.setName("교사").setDescription("강의 교사").setRequired(true)),

  new SlashCommandBuilder()
    .setName("강의목록")
    .setDescription("현재 등록된 강의 목록 조회")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("강의삭제")
    .setDescription("강의를 삭제합니다")
    .addIntegerOption(option => option.setName("id").setDescription("삭제할 강의 ID").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("강의참석")
    .setDescription("강의에 참석 등록")
    .addIntegerOption(opt => opt.setName("id").setDescription("강의 ID").setRequired(true)),

    
  new SlashCommandBuilder()
    .setName("강의참석취소")
    .setDescription("강의에 참석 등록")
    .addIntegerOption(opt => opt.setName("id").setDescription("강의 ID").setRequired(true)),

  // 질문 관리
  new SlashCommandBuilder()
    .setName("질문등록")
    .setDescription("질문 등록")
    .addStringOption(opt => opt.setName("내용").setDescription("질문 내용").setRequired(true)),
  

  new SlashCommandBuilder()
    .setName("질문삭제")
    .setDescription("질문을 삭제합니다")
    .addIntegerOption(option => option.setName("id").setDescription("삭제할 질문 ID").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.author),

  new SlashCommandBuilder()
    .setName("질문목록")
    .setDescription("현재 등록된 질문 목록 조회"),

  new SlashCommandBuilder()
    .setName("질문답변")
    .setDescription("질문에 답변 등록")
    .addIntegerOption(opt => opt.setName("id").setDescription("질문 ID").setRequired(true))
    .addStringOption(opt => opt.setName("내용").setDescription("답변 내용").setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => {
  try {
    console.log("⌛ 슬래시 명령어 등록 중...");
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log("✅ 슬래시 명령어 등록 완료");
  } catch (err) {
    console.error(err);
  }
})();


client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const data = loadData();

  // 강의등록
  if (interaction.commandName === "강의등록") {

  const title = interaction.options.getString("제목");
  const date = interaction.options.getString("날짜");
  const start = interaction.options.getString("시작");
  const end = interaction.options.getString("종료");
  const location = interaction.options.getString("장소");
  const teacher = interaction.options.getString("교사");

  // =====================
  // 1️⃣ 필드 검증
  // =====================
  const errors = [];

  if (!title || title.trim() === "") errors.push("제목이 비어 있습니다.");
  if (!location || location.trim() === "") errors.push("장소가 비어 있습니다.");
  if (!teacher || teacher.trim() === "") errors.push("교사가 비어 있습니다.");

  // 날짜 형식 YYYY-MM-DD 체크
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)");

  // 시간 형식 HH:mm 체크
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(start)) errors.push("시작 시간 형식이 올바르지 않습니다. (HH:mm)");
  if (!timeRegex.test(end)) errors.push("종료 시간 형식이 올바르지 않습니다. (HH:mm)");

  if (errors.length > 0) {
    return interaction.reply({
      content: "❌ 강의 등록 실패:\n" + errors.map(e => `- ${e}`).join("\n"),
      ephemeral: true
    });
  }

  // =====================
  // 2️⃣ 검증 통과 시 등록
  // =====================
  const newLecture = {
    id: data.lectures.length + 1,
    title,
    date,
    start,
    end,
    location,
    teacher,
    attendees: [],
    messageId: null
  };

  data.lectures.push(newLecture);
  saveData(data);

  const channel = interaction.guild.channels.cache.find(c => c.name === "🤍-일정");
  if (channel) {
    const msg = await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle(`📖 [${newLecture.id}] ${newLecture.title}`)
        .setDescription(`장소: ${newLecture.location}\n시각: ${newLecture.date} ${newLecture.start} ~ ${newLecture.end}\n교사: ${newLecture.teacher}\n인원: 0명`)
        .setColor(0x00cc66)]
    });
    newLecture.messageId = msg.id;
    saveData(data);
  }

  await interaction.reply("✅ 강의가 등록되었습니다.");
  //강의삭제
  } else if (interaction.commandName === "강의삭제") {
  const lectureId = interaction.options.getInteger("id");
  const lectureIndex = data.lectures.findIndex(l => l.id === lectureId);

  if (lectureIndex === -1) {
    return interaction.reply({ content: `❌ 강의 ID ${lectureId}를 찾을 수 없습니다.`, ephemeral: true });
  }

  const lecture = data.lectures[lectureIndex];

  // "🤍-일정" 채널 메시지 삭제
  const channel = interaction.guild.channels.cache.find(c => c.name === "🤍-일정");
  if (channel && lecture.messageId) {
    try {
      const msg = await channel.messages.fetch(lecture.messageId);
      if (msg) await msg.delete();
    } catch (err) {
      console.log("강의 메시지 삭제 실패:", err);
    }
  }

  // 로컬 데이터에서 삭제
  data.lectures.splice(lectureIndex, 1);
  saveData(data);

  await interaction.reply({ content: `🗑 강의 [${lecture.title}] 삭제 완료`, ephemeral: true });

  //강의 목록 조회
  } else if (interaction.commandName === "강의목록") {
    if (data.lectures.length === 0) {
      await interaction.reply("📭 등록된 강의가 없습니다.");
      return;
    }

    const embed = new EmbedBuilder().setTitle("📚 현재 등록된 강의 목록").setColor(0x00aaff);

    data.lectures.forEach(lec => {
      attends = []
      lec.attendees.forEach(async id => {
        attends += await interaction.guild.members.fetch(id).displayName
      })
      embed.addFields({
        name: `#${lec.id} ${lec.title}`,
        value: `날짜: ${lec.date} ${lec.start}~${lec.end}\n장소: ${lec.location}\n교사: ${lec.teacher}\n참석자: ${lec.attendees.length}명 ${Array.from(attends).join(', ')}`
      });
    });
    await interaction.reply({ embeds: [embed] });

  // 강의 참석
  } else if (interaction.commandName === "강의참석") {
    const id = interaction.options.getInteger("id");
    const lec = data.lectures.find(l => l.id === id);
    if (!lec) {
      await interaction.reply("❌ 해당 ID의 강의가 없습니다.");
      return;
    }

    if (!lec.attendees.includes(interaction.user.id)) {
      lec.attendees.push(interaction.user.id);
      saveData(data);
    }
    
    // 일정 메시지 수정
    const channel = interaction.guild.channels.cache.find(c => c.name === "🤍-일정");
    if (channel) {
      try {
        const msg = await channel.messages.fetch(lec.messageId);
        if (msg) {
          await msg.edit({
            embeds: [new EmbedBuilder()
              .setTitle(`📖 [${lec.id}] ${lec.title}`)
              .setDescription(`장소: ${lec.location}\n시각: ${lec.date} ${lec.start} ~ ${lec.end}\n교사: ${lec.teacher}\n인원: ${lec.attendees.length}명 (${lec.attendees.map(id => `<@${id}>`).join(", ")})`)
              .setColor(0x00cc66)]
          });
        }
      } catch {}
    }

    await interaction.reply(`✅ 강의 #${id} 참석 등록 완료`);
// 강의 참석 취소
  } else if (interaction.commandName === "강의참석취소") {
    const id = interaction.options.getInteger("id");
    const lec = data.lectures.find(l => l.id === id);

    if (!lec) {
      await interaction.reply("❌ 해당 ID의 강의가 없습니다.");
      return;
    }

    if (lec.attendees.includes(interaction.user.id)) {
      lec.attendees = lec.attendees.filter(uid => uid !== interaction.user.id);
      saveData(data);

      
    // 일정 메시지 수정
    const channel = interaction.guild.channels.cache.find(c => c.name === "🤍-일정");
    if (channel) {
      try {
        const msg = await channel.messages.fetch(lec.messageId);
        if (msg) {
          await msg.edit({
            embeds: [new EmbedBuilder()
              .setTitle(`📖 [${lec.id}] ${lec.title}`)
              .setDescription(`장소: ${lec.location}\n시각: ${lec.date} ${lec.start} ~ ${lec.end}\n교사: ${lec.teacher}\n인원: ${lec.attendees.length}명 (${lec.attendees.map(id => `<@${id}>`).join(", ")})`)
              .setColor(0x00cc66)]
          });
        }
      } catch {}
    }
      await interaction.reply(`✅ 강의 **[${lec.title}]** 참석이 취소되었습니다.`);
    } else {
      await interaction.reply("⚠️ 당신은 이 강의에 참석 등록되어 있지 않습니다.");
    }
  // 질문 등록
  } else if (interaction.commandName === "질문등록") {
    const newQ = {
      id: data.questions.length + 1,
      author: interaction.user.id,
      question: interaction.options.getString("내용"),
      answer: null,
      answeredBy: null,
      messageId: null
    };
    data.questions.push(newQ);
    saveData(data);

    const channel = interaction.guild.channels.cache.find(c => c.name === "💙-질문-연구토론");
    if (channel) {
      const msg = await channel.send(`❓ **질문 #${newQ.id}**\n${newQ.question}\n작성자: <@${newQ.author}>`);
      newQ.messageId = msg.id;
      saveData(data);
    }

    await interaction.reply("✅ 질문이 등록되었습니다.");
    //질문 삭제
  } else if (interaction.commandName === "질문삭제") {
  const questionId = interaction.options.getInteger("id");
  const questionIndex = data.questions.findIndex(q => q.id === questionId);

  if (questionIndex === -1) {
    return interaction.reply({ content: `❌ 질문 ID ${questionId}를 찾을 수 없습니다.`, ephemeral: true });
  }

  const question = data.questions[questionIndex];

  // "💙-질문-연구토론" 채널 메시지 삭제
  const channel = interaction.guild.channels.cache.find(c => c.name === "💙-질문-연구토론");
  if (channel && question.messageId) {
    try {
      const msg = await channel.messages.fetch(question.messageId);
      if (msg) await msg.delete();
    } catch (err) {
      console.log("질문 메시지 삭제 실패:", err);
    }
  }

  // 로컬 데이터에서 삭제
  data.questions.splice(questionIndex, 1);
  saveData(data);

  await interaction.reply({ content: `🗑 질문 #${question.id} 삭제 완료`, ephemeral: true });

  // 질문 목록
  } else if (interaction.commandName === "질문목록") {
    if (data.questions.length === 0) {
      await interaction.reply("📭 등록된 질문이 없습니다.");
      return;
    }

    const embed = new EmbedBuilder().setTitle("💬 현재 질문 목록").setColor(0x0099ff);
    data.questions.forEach(q => {
      embed.addFields({
        name: `#${q.id} ${q.question}`,
        value: `작성자: <@${q.author}>\n상태: ${q.answer ? "✅ 답변완료" : "❌ 미답변"}`
      });
    });
    await interaction.reply({ embeds: [embed] });

  // 질문 답변
  } else if (interaction.commandName === "질문답변") {
    const id = interaction.options.getInteger("id");
    const answer = interaction.options.getString("내용");

    const q = data.questions.find(q => q.id === id);
    if (!q) {
      await interaction.reply("❌ 해당 ID의 질문이 없습니다.");
      return;
    }

    q.answer = answer;
    q.answeredBy = interaction.user.id;
    saveData(data);

    const channel = interaction.guild.channels.cache.find(c => c.name === "💙-질문-연구토론");
    try {
      const msg = await channel.messages.fetch(q.messageId);
      if (msg) {
        await msg.edit(`❓ **질문 #${q.id}**\n${q.question}\n작성자: <@${q.author}>\n\n✅ **답변:** ${answer}\n(답변자: <@${interaction.user.id}>)`);
      }
    } catch {}

    await interaction.reply(`✅ 질문 #${id}에 답변 등록 완료`);
  }
});

client.on("messageDelete", async (message) => {
  if (!message.guild) return; // DM은 무시

  const data = loadData();
  // 💙 질문-연구토론 채널 감지
  if (message.channel.name === "💙-질문-연구토론") {
    const qIndex = data.questions.findIndex(q => q.messageId === message.id);
    if (qIndex !== -1) {
      console.log(`질문 #${data.questions[qIndex].id} 이 관리자에 의해 삭제됨.`);
      data.questions.splice(qIndex, 1);
      saveData(data);
    }
  }

  // 🤍 일정 채널 감지
  if (message.channel.name === "🤍-일정") {
    const lecIndex = data.lectures.findIndex(l => l.messageId === message.id);
    if (lecIndex !== -1) {
      console.log(`강의 #${data.lectures[lecIndex].id} 이 관리자에 의해 삭제됨.`);
      data.lectures.splice(lecIndex, 1);
      saveData(data);
    }
  }
});

// 폴더 없으면 생성
if (!fs.existsSync(CALENDAR_DIR)) {
  fs.mkdirSync(CALENDAR_DIR);
}

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
schedule.scheduleJob({ hour: 20, minute: 58, tz: "Asia/Seoul" }, async () => {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return console.error("길드 찾기 실패");
  const data = loadData()
  const channel = guild.channels.cache.find(
    (ch) => ch.name === "👁🗨-수행계획방" && ch.isTextBased()
  );
  if (!channel) return console.error("수행계획방 찾기 실패");

  // 회차 증가
  data.meetingCount++;
  saveData(data);

  let participants = new Set();

  const messageText =
    `[제 ${data.meetingCount}차] 수행 모임\n` +
    `장소: 음성 채널 수행방(온라인)\n` +
    `시각: ${new Date().toLocaleDateString("ko-KR")} - 23:00 ~ 24:00\n` +
    `인원:  0인(아직 없음)\n` +
    `활동 내용: 각자 수행 및 일지 작성`;

  const msg = await channel.send(messageText);

  await msg.react("✅");
  await msg.react("❌");

  const filter = (reaction, user) =>
    !user.bot && (reaction.emoji.name === "✅" || reaction.emoji.name === "❌");

  const collector = msg.createReactionCollector({ filter, time: 6 * 60 * 60 * 1000 });

  collector.on("collect", async (reaction, user) => {
    const foundU = await msg.guild.members.fetch(user.id);
    const displayName = foundU.displayName;

    if (reaction.emoji.name === "✅") {
      participants.add(displayName);
    } else if (reaction.emoji.name === "❌") {
      participants.delete(displayName);
    }

    const participantList = Array.from(participants).join(", ") || "아직 없음";
    await msg.edit(
      `[제 ${data.meetingCount}차] 수행 모임\n` +
        `장소: 음성 채널 수행방(온라인)\n` +
        `시각: ${new Date().toLocaleDateString("ko-KR")} - 23:00 ~ 24:00\n` +
        `인원:  ${participants.size}인(${participantList})\n` +
        `활동 내용: 각자 수행 및 일지 작성`
    );
  });

  collector.on("end", async () => {
    const participantList = Array.from(participants).join(", ") || "아직 없음";
    await msg.edit(
      `[제 ${data.meetingCount}차] 수행 모임 [완료]\n` +
        `장소: 음성 채널 수행방(온라인)\n` +
        `시각: ${new Date().toLocaleDateString("ko-KR")} - 23:00 ~ 24:00\n` +
        `인원:  ${participants.size}인(${participantList})\n` +
        `활동 내용: 각자 수행 및 일지 작성`
    );
  });
});

client.login(process.env.TOKEN);





