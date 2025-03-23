//npm install node-cron
//npm install brcypt
//npm install connect-redis redis express-session
//npm install express
//npm install body-parser

const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const bcrypt = require('bcrypt');
const validator = require('validator');
const saltRounds = 10; // Salt rounds 값은 보안성에 영향을 미칩니다.
const nodemailer = require('nodemailer');

const app = express();
const port = 15023; // 학교서버 15023

// 서버의 이용료 측정---------------------
// const morgan = require('morgan');
// const fs = require('fs');
// const path = require('path');
// const pidusage = require('pidusage');

// CPU 및 메모리 사용량 모니터링
// setInterval(async () => {
//   try {
//     const stats = await pidusage(process.pid);
//     console.log(`CPU 사용량: ${stats.cpu.toFixed(2)}%`);
//     console.log(`메모리 사용량: ${(stats.memory / 1024 / 1024).toFixed(2)} MB`);
//   } catch (err) {
//     console.error('리소스 사용량 측정 오류:', err);
//   }
// }, 5000); // 5초 간격으로 측정

// // 네트워크 로그 파일 생성
// const logStream = fs.createWriteStream(path.join(__dirname, 'network.log'), { flags: 'a' });

// morgan.token('req-size', (req) => req.headers['content-length'] || 0);
// morgan.token('res-size', (req, res) => res.getHeader('content-length') || 0);

// app.use(express.json()); // nodemailer

// app.use(
//   morgan(':method :url :status :req-size bytes :res-size bytes', { stream: logStream })
// );

// // 요청당 비용 계산 미들웨어
// const cpuCostPerPercent = 0.00001; // CPU 사용량 1%당 비용 ($)
// const networkCostPerMB = 0.01; // 1MB당 네트워크 비용 ($)

// app.use(async (req, res, next) => {
//   const start = process.hrtime();

//   res.on('finish', async () => {
//     const elapsedTime = process.hrtime(start);
//     const elapsedMs = elapsedTime[0] * 1000 + elapsedTime[1] / 1e6;

//     const reqSize = parseInt(req.headers['content-length'] || '0', 10) / 1024 / 1024; // MB
//     const resSize = parseInt(res.getHeader('content-length') || '0', 10) / 1024 / 1024; // MB

//     try {
//       const stats = await pidusage(process.pid);
//       const cpuCost = stats.cpu * cpuCostPerPercent;
//       const networkCost = (reqSize + resSize) * networkCostPerMB;
//       const totalCost = cpuCost + networkCost;

//       console.log(`요청당 비용: $${totalCost.toFixed(6)} (CPU: $${cpuCost.toFixed(6)}, Network: $${networkCost.toFixed(6)})`);
//     } catch (err) {
//       console.error('요청당 비용 계산 오류:', err);
//     }
//   });

//   next();
// });
//------------------------------------

// MySQL 연결 설정
const db = mysql.createConnection({
  host: '0.0.0.0',
  user: 'checkjin_2023874', // MySQL 사용자명
  password: 'checkjin_2023874', // MySQL 비밀번호
  database: 'checkjin_2023874', // 사용할 데이터베이스
  multipleStatements: true // 여기에 추가
});

const fs = require('fs');
const path = require('path');

// 비속어 리스트 로드
const badWords = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'invalid-words.json'))
).invalidString;

// 비속어 필터링 함수
function containsBadWords(nickname) {
  return badWords.some((word) => nickname.includes(word));
}
// 닉네임 검증 함수
function isValidNickname(nickname) {
  const koreanRegex = /^[가-힣]{2,8}$/; // 한글 2~8자
  const englishRegex = /^[a-zA-Z0-9_-]{2,14}$/; // 영문/숫자/특수문자 2~14자
  const noSpaces = !/\s/.test(nickname); // 공백 체크

  // 한글 또는 영문 규칙 중 하나를 만족해야 함
  return noSpaces && (koreanRegex.test(nickname) || englishRegex.test(nickname));
}

function generateRandomPassword(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$';
  let password = '';
  for (let i = 0; i < length; i++) {
    // chars에서 랜덤 인덱스 뽑아서 하나씩 붙이기
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'alltimeforyourstudy@gmail.com',
    pass: 'rbks svsv svrc eiku', 
  },
});

// 비밀번호 초기화
app.post('/request-reset-password', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: '이메일을 입력해주세요.' });
  }

  // 1) 해당 이메일이 있는지 DB 조회
  db.query('SELECT user_id FROM Users WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('DB query error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: '가입된 이메일이 없습니다.' });
    }

    const userId = results[0].user_id;
    // console.log(userId);
    // 2) 새 비밀번호 생성
    const newPlainPassword = generateRandomPassword(saltRounds);

    // 3) 새 비밀번호 해시 (bcrypt hash도 콜백)
    bcrypt.hash(newPlainPassword, saltRounds, (hashErr, hashedPassword) => {
      if (hashErr) {
        console.error('bcrypt hash error:', hashErr);
        return res.status(500).json({ error: '암호화 오류' });
      }

      // 4) DB에 비밀번호 업데이트
      db.query('UPDATE Users SET password = ? WHERE user_id = ?', [hashedPassword, userId], (updateErr, updateResults) => {
        if (updateErr) {
          console.error('DB update error:', updateErr);
          return res.status(500).json({ error: 'DB update failed' });
        }

        // 5) 이메일 전송
        const mailOptions = {
            from: 'alltimeforyourstudy@gmail.com',
            to: email,
            subject: '[올타] 새 비밀번호 안내',
            html: `
              <p>새로운 비밀번호는 "<b style="color: red;">${newPlainPassword}</b>" 입니다.</p>
              <p><b>로그인 후 비밀번호를 꼭 변경해주세요.</b></p>
            `,
          };

        transporter.sendMail(mailOptions, (mailErr, info) => {
          if (mailErr) {
            console.error('메일 전송 실패:', mailErr);
            return res.status(500).json({ error: '메일 전송 실패' });
          }

          // 모든 과정이 완료되면 응답
          return res.status(200).json({ message: '새 비밀번호를 이메일로 전송했습니다.' });
        });
      });
    });
  });
});


// MySQL 연결
db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database');
});

// 로그인 세션
const redis = require('redis');
// Redis 연결 설정
const redisClient = redis.createClient({
  url: `redis://default:DaEPvJcFiv7V75JSHaNaptAj1zaD16P7@redis-12810.c258.us-east-1-4.ec2.redns.redis-cloud.com:12810/0`,
});

redisClient.on('connect', () => {
  console.log('Redis 연결 성공');
});
redisClient.on('ready', () => {
  console.log('Redis 준비 완료');
});
redisClient.on('end', () => {
  console.log('Redis 연결 종료');
});
redisClient.on('error', (err) => {
  console.error('Redis 에러 발생:', err);
});

(async () => {
  try {
    await redisClient.connect();
    console.log('Redis 연결 시도 중...');
    await redisClient.flushAll();
    console.log('Redis 초기화 완료');
  } catch (err) {
    console.error('Redis 연결 실패:', err);
  }
})();


// 미들웨어 설정
app.use(bodyParser.json());
app.use(express.json());

// 월간 초기화 및 메달 수여 작업 (매월 1일 0시 실행)
cron.schedule('0 0 1 * *', async () => {
    try {
        // 현재 날짜에서 현재 달 계산
        const { month, year } = getCurrentMonth(); // 현재 달 메달 수여
        const getDateString = `${year}년 ${month}월`; // 예: "2024년 1월"

        // 대회 시작일(start_date)과 종료일(end_date) 계산 (현재 달)
        const startDate = new Date(year, month - 1, 1);  // 현재 달의 1일
        const endDate = new Date(year, month, 0);        // 현재 달의 마지막 날 (예: 12월 31일)

        // 지난달 계산
        const { lastMonth, lastYear } = getLastMonth(); // 지난달 계산
        const lastMonthDateString = `${lastYear}년 ${lastMonth}월`;
        console.log(`lastMonthDateString 값: ${lastMonthDateString}`);

        // 대회 시작일(start_date)과 종료일(end_date) 계산 (지난달)
        const lastStartDate = new Date(lastYear, lastMonth - 1, 1);  // 지난달의 1일
        const lastEndDate = new Date(lastYear, lastMonth, 0);        // 지난달의 마지막 날 (예: 12월 31일)

        // 지난달의 메달 수여 (RANK() 사용)
        const topSchoolsLastMonth = await queryAsync(`
            SELECT
                school_id,
                school_name,
                school_local,
                monthly_total_time,
                RANK() OVER (ORDER BY monthly_total_time DESC) AS monthly_ranking
            FROM School
            WHERE monthly_total_time > 0
        `);

        // 지난달 메달 수여: 순위에 따라 메달 부여
        for (const school of topSchoolsLastMonth) {
            const ranking = school.monthly_ranking; // RANK()로 계산된 순위 사용
            if (ranking > 3) break; // 4등 이상은 메달 수여 제외

            // 해당 학교 소속 사용자 가져오기
            const users = await queryAsync(`
                SELECT user_id
                FROM Users
                WHERE school_id = ?
            `, [school.school_id]);

            // 사용자에게 메달 부여
            if (users.length > 0) {
                const battleInf = `${lastMonthDateString} 전국대회 메달`; // 지역 포함 메달 정보
                let rewardPoints = 0;

                // 등수에 따른 포인트 지급
                        if (ranking === 1) {
                            rewardPoints = 50000000; // 1등: 50,000,000 포인트
                        } else if (ranking === 2) {
                            rewardPoints = 10000000; // 2등: 10,000,000 포인트
                        } else if (ranking === 3) {
                            rewardPoints = 3000000;  // 3등: 300,000 포인트
                        }

                await Promise.all(users.map(user =>
                    queryAsync(`
                        INSERT INTO Medal (user_id, school_id, school_name, ranking, monthly_total_time, get_date, battle_inf, school_local)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        user.user_id,                // 사용자 ID
                        school.school_id,            // 학교 ID
                        school.school_name,          // 학교 이름
                        ranking,                     // 순위
                        school.monthly_total_time,   // 월간 총 시간
                        lastMonthDateString,         // 메달 수여 날짜 (ex. "2024년 12월")
                        battleInf,                   // "월 전국대회 메달" 형식의 정보
                        school.school_local
                    ])
                ));

                // 포인트 지급 (Users 테이블에 포인트 컬럼이 있다고 가정)
                        await Promise.all(users.map(user =>
                            queryAsync(`
                                UPDATE Users
                                SET points = points + ?
                                WHERE user_id = ?
                            `, [rewardPoints, user.user_id])
                        ));


                // 메달 수여 알림 생성
                await Promise.all(users.map(user =>
                    queryAsync(`
                        CALL CreateNotification(?, ?, '대회 메달과 포인트를 수여 받았습니다!', 'reward')
                    `, [user.user_id, `${lastMonthDateString} 메달 수여`])
                ));
            }
        }

        // monthly_total_time 초기화
        await queryAsync('UPDATE School SET monthly_total_time = 0');

        // monthly_time 초기화 (사용자별)
        await queryAsync('UPDATE StudyTimeRecords SET monthly_time = 0');

        console.log(`${lastMonthDateString} 메달 수여 완료 및 월간 초기화`);

        // 대회 종료 알림
        const allUsers = await queryAsync('SELECT user_id FROM Users');
        await Promise.all(allUsers.map(user =>
            queryAsync(`
                CALL CreateNotification(?, ?, '${lastMonthDateString} 대회가 종료되었습니다!', 'system')
            `, [user.user_id, `${lastMonthDateString} 대회 종료`])
        ));

        // 대회 시작 알림
        await Promise.all(allUsers.map(user =>
            queryAsync(`
                CALL CreateNotification(?, ?, '${getDateString} 대회 시작되었습니다!', 'system')
            `, [user.user_id, `${getDateString} 대회 시작`])
        ));


        // 대회 시작일(start_date)과 종료일(end_date) 업데이트
        await queryAsync(`
            UPDATE School
                SET start_date = ?, end_date = ?
        `, [startDate, endDate]);

        console.log(`대회 시작일과 종료일이 업데이트되었습니다: ${startDate} ~ ${endDate}`);

    } catch (error) {
        console.error('월간 초기화 오류:', error);
    }
});

// 현재 달 계산 함수
function getCurrentMonth() {
    const now = new Date();
    const month = now.getMonth() + 1; // 0 = 1월, 11 = 12월
    const year = now.getFullYear(); // 현재 연도
    return { month, year };
}

// 지난달 계산 함수
function getLastMonth() {
    const now = new Date();
    let month = now.getMonth(); // 0 = 1월, 11 = 12월
    let year = now.getFullYear();

    if (month === 0) {  // 1월일 경우 12월로 설정하고, 연도를 하나 감소시킴
        month = 12;
        year -= 1;
    }

    return { lastMonth: month, lastYear: year };  // 지난달과 연도를 반환
}

// Promise 기반으로 MySQL 쿼리 실행
function queryAsync(query, params = []) {
    return new Promise((resolve, reject) => {
        db.query(query, params, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}



// 대회 종료일을 매달 마지막 날로 설정하고, 오늘 날짜를 변경하면서 1일 남았을 때 알림 발송 테스트
cron.schedule('0 0 * * *', async () => {
    try {
        // 현재 달 계산 (기존 유지)
        const { month, year } = getCurrentMonth();

        // 대회 종료일: 매달 마지막 날로 설정
        const endDate = new Date(year, month, 0); // 매달 마지막 날

        // 오늘 날짜를 자동으로 설정 (현재 날짜 사용)
        const today = new Date(); // 오늘 날짜 자동 설정

        // 대회 종료일까지 남은 일수 계산
        const timeDiff = endDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

        // 7일, 3일, 1일 남았을 때 알림 발송
                if ([7, 3, 1].includes(daysLeft)) {
                    const allUsers = await queryAsync('SELECT user_id FROM Users');

                    // 1일 남았을 때 메시지 변경
                    const message = daysLeft === 1
                        ? "대회 종료까지 1일 남았습니다. 자정 전까지 타이머 리셋 버튼을 누르셔야 시간이 누적됩니다."
                        : `대회 종료까지 ${daysLeft}일 남았습니다.`;

                    await Promise.all(allUsers.map(user =>
                        queryAsync(`
                            CALL CreateNotification(?, ?, ?, 'system')
                        `, [user.user_id, `${daysLeft}일 남음`, message])
                    ));

                    console.log(`${daysLeft}일 남음 알림 발송 완료`);
                }

            } catch (error) {
                console.error('대회 종료 알림 발송 오류:', error);
            }
        });

// 현재 달 계산 함수 (기존 유지)
function getCurrentMonth() {
    const now = new Date();
    const month = now.getMonth() + 1; // 0 = 1월, 11 = 12월
    const year = now.getFullYear(); // 현재 연도
    return { month, year };
}

// 혁진 시작
app.post('/update-account-status', (req, res) => {
  const { user_id, account_status } = req.body;

  // 입력 데이터 검증
  if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
    return res.status(400).json({ message: '유효한 user_id가 필요합니다.' });
  }

  const allowedStatuses = ['online', 'dormant', 'offline', 'focus']; // 허용된 상태 값
  if (!allowedStatuses.includes(account_status)) {
    return res.status(400).json({ message: '유효하지 않은 account_status 값입니다.' });
  }

  // 사용자가 존재하는지 확인
  db.query('SELECT user_id FROM Users WHERE user_id = ?', [user_id], (err, results) => {
    if (err) {
      console.error('Error fetching user:', err);
      return res.status(500).json({ message: '데이터베이스 오류' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: '해당 user_id를 찾을 수 없습니다.' });
    }

    // 사용자 상태 업데이트
    const query = 'UPDATE Users SET account_status = ? WHERE user_id = ?';
    db.query(query, [account_status, user_id], (err, result) => {
      if (err) {
        console.error('Error updating account status:', err);
        return res.status(500).json({ message: '사용자 상태 업데이트 중 오류 발생' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: '업데이트할 대상이 없습니다.' });
      }

      res.status(200).json({ message: '계정 상태가 성공적으로 업데이트되었습니다.' });
    });
  });
});

app.post('/update-profile-image', (req, res) => {
  const { userId, profileImage } = req.body;

  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({ message: '유효한 userId가 필요합니다.' });
  }
  
  // 사용자가 존재하는지 확인
  db.query('SELECT user_id FROM Users WHERE user_id = ?', [userId], (err, results) => {
    if (err) {
      console.error('Error fetching user:', err);
      return res.status(500).json({ message: '데이터베이스 오류' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: '해당 userId를 찾을 수 없습니다.' });
    }
    // 사용자 프로필 이미지 업데이트
    const query = 'UPDATE Users SET profile_image = ? WHERE user_id = ?';
    db.query(query, [profileImage, userId], (err, result) => {
      if (err) {
        console.error('Error updating profile image:', err);
        return res.status(500).json({ message: '프로필 이미지 업데이트에 실패했습니다.' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: '업데이트할 대상이 없습니다.' });
      }

      res.status(200).json({ message: '프로필 이미지가 성공적으로 변경되었습니다.' });
    });
  });
});


// 학교 검색 API
app.get('/search-schools', (req, res) => {
  const query = req.query.query?.trim(); // 클라이언트에서 보낸 검색어 (공백 제거)

  // 검색어 검증
  if (!query || query.length < 2) {
    // console.log("Query parameter missing or too short."); // 디버깅 메시지
    return res.status(400).json({ error: '검색어는 최소 2자 이상이어야 합니다.' });
  }

  if (query.length > 50) {
    // console.log("Query parameter too long."); // 디버깅 메시지
    return res.status(400).json({ error: '검색어가 너무 깁니다. (최대 50자)' });
  }

  // SQL Injection 방지: escape 처리 + LIKE 검색어 보안 강화
  const searchValue = `${query}`;
  const sql = `SELECT school_name, school_address FROM School WHERE school_name LIKE CONCAT('%', ?, '%')`;

  db.query(sql, [searchValue], (err, results) => {
    if (err) {
      console.error('Error fetching schools:', err);
      return res.status(500).json({ error: '학교 목록을 불러오는 중 오류 발생' });
    }

    if (!Array.isArray(results)) {
      return res.status(500).json({ error: '잘못된 서버 응답 형식' });
    }

    // 결과를 서버 콘솔에 출력 (디버깅용)
    // console.log('Search results:', results.length > 0 ? results : "No results found.");

    // 결과 반환
    res.json(results);
  });
});

// 🟢 **회원가입 API**
app.post('/signup', (req, res) => {
  const { email, password, nickname, school_name } = req.body;

  // 필수 입력값 확인
  if (!email || !password || !nickname || !school_name) {
    return res.status(400).json({ message: '이메일, 비밀번호, 닉네임, 학교는 필수입니다.' });
  }

  // ✅ **이메일 형식 검증**
  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: '올바른 이메일 형식을 입력하세요.' });
  }

  // ✅ **비밀번호 검증 (최소 8자, 숫자 + 영문 포함)**
  if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
    return res.status(400).json({ message: '비밀번호는 최소 8자 이상이며, 숫자와 영문자를 포함해야 합니다.' });
  }

  // ✅ **닉네임 검증 (공백 제거 후 검사)**
  const trimmedNickname = nickname.trim();
  if (!isValidNickname(trimmedNickname)) {
    return res.status(400).json({ message: '닉네임은 한글 2~8자, 영문/숫자/특수문자(-,_) 2~14자 사용 가능하며 공백은 사용 불가능합니다.' });
  }

  if (containsBadWords(trimmedNickname)) {
    return res.status(400).json({ message: '닉네임에 비속어는 사용하실 수 없습니다.' });
  }

  // ✅ **학교 이름 공백 제거**
  const trimmedSchoolName = school_name.trim();

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).json({ message: '비밀번호 암호화 중 오류 발생' });

    db.beginTransaction((err) => {
      if (err) return res.status(500).json({ message: '트랜잭션 오류' });

      // 1️⃣ 이메일 중복 체크
      db.query('SELECT email FROM Users WHERE email = ?', [email], (err, result) => {
        if (err) {
          db.rollback();
          return res.status(500).json({ message: '이메일 확인 오류' });
        }
        if (result.length > 0) {
          db.rollback();
          return res.status(400).json({ message: '이미 사용 중인 이메일입니다.' });
        }

        // 2️⃣ 닉네임 중복 체크
        db.query('SELECT nickname FROM Users WHERE nickname = ?', [trimmedNickname], (err, result) => {
          if (err) {
            db.rollback();
            return res.status(500).json({ message: '닉네임 확인 오류' });
          }
          if (result.length > 0) {
            db.rollback();
            return res.status(400).json({ message: '이미 사용 중인 닉네임입니다.' });
          }

          // 3️⃣ 학교 존재 여부 확인
          db.query('SELECT school_id FROM School WHERE school_name = ?', [trimmedSchoolName], (err, result) => {
            if (err) {
              db.rollback();
              return res.status(500).json({ message: '학교 확인 오류' });
            }

            if (result.length === 0) {
              db.rollback();
              return res.status(404).json({ message: '해당 학교가 존재하지 않습니다.' });
            }

            const school_id = result[0].school_id;

            // 4️⃣ 회원 정보 저장
            const query = `INSERT INTO Users (email, password, nickname, school_name, account_status, school_id) VALUES (?, ?, ?, ?, 'offline', ?)`;
            db.query(query, [email, hashedPassword, trimmedNickname, trimmedSchoolName, school_id], (err, result) => {
              if (err) {
                db.rollback();
                return res.status(500).json({ message: '회원가입 오류' });
              }

              const userId = result.insertId;

              // 5️⃣ 공부 시간 기록 테이블 초기화
              db.query(`INSERT INTO StudyTimeRecords (user_id) VALUES (?)`, [userId], (err) => {
                if (err) {
                  db.query(`DELETE FROM Users WHERE user_id = ?`, [userId], () => { 
                    db.rollback();
                    return res.status(500).json({ message: 'StudyTimeRecords 초기화 오류' });
                  });
                } else {
                  db.commit((err) => {
                    if (err) {
                      db.rollback();
                      return res.status(500).json({ message: '트랜잭션 커밋 오류' });
                    }
                    res.status(201).json({ message: '회원가입 성공' });
                  });
                }
              });
            });
          });
        });
      });
    });
  });
});


// 로그인 API
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM Users WHERE email = ?';
  db.query(query, [email], async (error, results) => {
    if (error) {
      console.error('쿼리 실행 실패:', error);
      return res.status(500).json({ message: '서버 오류' });
    }

    if (results.length > 0) {
      const user = results[0];

      // 해시된 비밀번호인지 평문 비밀번호인지 체크하는 로직
      if (user.password.startsWith('$2b$')) {
        // 비밀번호 비교
        bcrypt.compare(password, user.password, async (err, isMatch) => {
          if (err) {
            console.error('비밀번호 비교 실패:', err);
            return res.status(500).json({ message: '서버 오류' });
          }

          if (isMatch) {
            // Redis에서 로그인 상태 확인
            const userId = user.user_id.toString(); // 키를 문자열로 변환
            const isLoggedIn = await redisClient.get(userId);
            if (isLoggedIn) {
              return res.status(400).json({ message: '이미 로그인된 사용자입니다.' });
            }

            // 마지막 로그인 시간 업데이트
            const updateQuery = 'UPDATE Users SET last_login = NOW() WHERE email = ?';
            db.query(updateQuery, [email], (updateError) => {
              if (updateError) {
                console.error('마지막 로그인 시간 업데이트 실패:', updateError);
                return res.status(500).json({ message: '서버 오류' });
              }
            });

            try {
              // Redis 데이터 저장 시
              const status = 'loggedIn';
              const result = await redisClient.set(userId, status, { EX: 3600 });
              // console.log(`Redis SET 결과: ${result}`);
              if (result !== 'OK') {
                console.error('Redis SET 실패:', userId);
              }
              // console.log(`Redis에 저장됨: key=${userId}, value=${status}`);

              // 데이터가 제대로 저장되었는지 바로 확인
              const redisValue = await redisClient.get(userId);
              // console.log(`Redis에서 조회: key=${userId}, value=${redisValue}`);

              // console.log('Redis SET 성공');
              // console.log('로그인 성공:', userId);
            } catch (err) {
              console.error('Redis 연결 실패:', err);
            }

            return res.status(200).json({
              user_id: user.user_id,
              nickname: user.nickname,
              password: user.password,
              message: '로그인 성공',
            });
          } else {
            // console.log(`로그인 실패: 잘못된 비밀번호 ${email}`);
            return res.status(401).json({ message: '잘못된 이메일 또는 비밀번호' });
          }
        });
      } else {
        // 평문 비밀번호인 경우 (단순 비교)
        if (password === user.password) {
          // Redis에서 로그인 상태 확인
          const userId = user.user_id.toString(); // 키를 문자열로 변환
          const isLoggedIn = await redisClient.get(userId);
          if (isLoggedIn) {
            return res.status(400).json({ message: '이미 로그인된 사용자입니다.' });
          }

          // 마지막 로그인 시간 업데이트
          const updateQuery = 'UPDATE Users SET last_login = NOW(), account_status = "online" WHERE email = ?';
          db.query(updateQuery, [email], (updateError) => {
            if (updateError) {
              console.error('마지막 로그인 시간 업데이트 실패:', updateError);
              return res.status(500).json({ message: '서버 오류' });
            }
          });

          try {
            // Redis 데이터 저장 시
            const status = 'loggedIn';
            const result = await redisClient.set(userId, status, { EX: 3600 });
            console.log(`Redis SET 결과: ${result}`);
            if (result !== 'OK') {
              console.error('Redis SET 실패:', userId);
            }
            console.log(`Redis에 저장됨: key=${userId}, value=${status}`);

            // 데이터가 제대로 저장되었는지 바로 확인
            const redisValue = await redisClient.get(userId);
            console.log(`Redis에서 조회: key=${userId}, value=${redisValue}`);

            console.log('Redis SET 성공');
            console.log('로그인 성공:', userId);
          } catch (err) {
            console.error('Redis 연결 실패:', err);
          }

          return res.status(200).json({
            user_id: user.user_id,
            nickname: user.nickname,
            password: user.password,
            message: '로그인 성공',
          });
        } else {
          // console.log(`로그인 실패: 잘못된 비밀번호 ${email}`);
          return res.status(401).json({ message: '잘못된 이메일 또는 비밀번호' });
        }
      }

    } else {
      // console.log(`로그인 실패: 존재하지 않는 이메일 ${email}`);
      return res.status(401).json({ message: '잘못된 이메일 또는 비밀번호' });
    }
  });
});


// 로그아웃 API
app.post('/logout', async (req, res) => {
  const { userId } = req.body;

  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }

  try {
    // 데이터베이스 로그아웃 처리 (비동기 방식 개선)
    const updateQuery = 'UPDATE Users SET account_status = "offline" WHERE user_id = ?';
    await new Promise((resolve, reject) => {
      db.query(updateQuery, [userId], (updateError, result) => {
        if (updateError) {
          console.error('로그아웃 실패:', updateError);
          reject(updateError);
        } else {
          resolve(result);
        }
      });
    });

    // Redis에서 사용자 로그인 상태 제거
    try {
      const result = await redisClient.del(userId.toString());
      if (result === 1) {
        // console.log(`Redis에서 로그아웃 처리 완료: key=${userId}`);
        return res.status(200).json({ message: '로그아웃 성공' });
      } else {
        // console.log(`Redis에서 키를 찾을 수 없음: key=${userId}`);
        return res.status(404).json({ message: '사용자가 로그인되어 있지 않습니다.' });
      }
    } catch (redisError) {
      console.error('Redis에서 로그아웃 처리 실패:', redisError);
      return res.status(500).json({ message: 'Redis 처리 중 오류 발생' });
    }

  } catch (dbError) {
    return res.status(500).json({ message: '서버 오류: 로그아웃 처리 실패' });
  }
});



app.post('/get-school-name', (req, res) => {
  const { userEmail } = req.body;

  // 입력 데이터 검증
  if (!userEmail || typeof userEmail !== 'string' || userEmail.trim() === '') {
    return res.status(400).json({ message: '유효한 이메일을 입력하세요.' });
  }

  const trimmedEmail = userEmail.trim();

  // Users 테이블과 School 테이블을 조인하여 school_name 가져오기
  const query = `
    SELECT s.school_name 
    FROM Users u
    JOIN School s ON u.school_id = s.school_id
    WHERE u.email = ?`;

  db.query(query, [trimmedEmail], (err, results) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 정상적인 응답 반환
    return res.status(200).json({ school_name: results[0].school_name });
  });
});


// 지역 목록을 반환하는 API
app.get('/school-local', (req, res) => {
  const query = 'SELECT DISTINCT school_local FROM School WHERE school_local IS NOT NULL';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching regions:', err);
      return res.status(500).json({ message: 'Server error', error: err });
    }

    // 결과 데이터 검증
    const locals = results
      .map((row) => (row.school_local ? row.school_local.trim() : null))
      .filter((local) => local !== null && local !== ''); // 빈 값 제거

    if (locals.length === 0) {
      return res.status(404).json({ message: 'No school regions found' });
    }

    return res.status(200).json(locals);
  });
});

app.get('/school-rankings', (req, res) => {
  const { competition, local } = req.query;

  // '지역 대회' 처리
  if (competition === '지역 대회' && local) {
      const query = `SELECT school_name, total_ranking, monthly_ranking, local_ranking, total_time, monthly_total_time, school_level, school_local
                    FROM School
                    WHERE school_local = ? AND monthly_total_time > 0
                    ORDER BY local_ranking ASC;`;

    db.query(query, local, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: '데이터베이스 쿼리 오류' });
      }
      console.log('지역 대회');
      console.log(results);
      return res.json(results);
    });
  }

  // '전국 대회' 처리
  else if (competition === '전국 대회') {
    const query = `WITH RankedSchools AS (
                           SELECT
                             school_name,
                             total_ranking,
                             monthly_ranking,
                             local_ranking,
                             total_time,
                             monthly_total_time,
                             school_level,
                             school_local,
                             ROW_NUMBER() OVER (PARTITION BY school_local ORDER BY monthly_ranking ASC) AS rn
                           FROM School
                           WHERE monthly_total_time > 0
                         )
                         SELECT school_name, total_ranking, monthly_ranking, local_ranking, total_time, monthly_total_time, school_level, school_local
                         FROM RankedSchools
                         WHERE rn <= 3
                         ORDER BY monthly_total_time DESC;`;

    db.query(query, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: '데이터베이스 쿼리 오류' });
      }

      // console.log('전국 대회');
      // console.log(results);
      return res.json(results); // 월별 총 시간 기준으로 정렬된 지역별 1, 2, 3등 반환
    });
  }

  // '랭킹' 대회 처리
  else if (competition === '랭킹') {
    const query = `SELECT school_name, total_ranking, monthly_ranking, local_ranking, total_time, monthly_total_time, school_level, school_local
                   FROM School
                   WHERE total_time > 0
                   ORDER BY total_ranking ASC;`;
    db.query(query, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: '데이터베이스 쿼리 오류' });
      }
      // console.log('랭킹');
      // console.log(results);
      return res.json(results); // 총 시간 기준으로 학교 데이터 반환
    });
  }

  // 잘못된 파라미터 처리
  else {
    return res.status(400).json({ error: 'Invalid competition or missing parameters' });
  }
});

app.post('/school-contributions', (req, res) => {
  const { userEmail, isTotalTime } = req.body;

  // 입력 데이터 검증
  if (!userEmail || typeof userEmail !== 'string' || userEmail.trim() === '') {
    return res.status(400).json({ message: '유효한 이메일을 입력하세요.' });
  }

  if (typeof isTotalTime !== 'boolean') {
    return res.status(400).json({ message: 'isTotalTime 값이 잘못되었습니다. (true 또는 false만 허용)' });
  }

  const trimmedEmail = userEmail.trim();

  // 사용자 이메일을 기반으로 school_id와 nickname 가져오기
  const schoolQuery = `
    SELECT u.school_id, u.nickname, s.school_name
    FROM Users u
    JOIN School s ON u.school_id = s.school_id
    WHERE u.email = ?;
  `;

  db.query(schoolQuery, [trimmedEmail], (error, schoolResults) => {
    if (error) {
      console.error('쿼리 실행 실패:', error);
      return res.status(500).json({ message: '서버 오류' });
    }

    if (schoolResults.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const { school_id, school_name, nickname: userNickname } = schoolResults[0];

    if (!school_id) {
      return res.status(404).json({ message: '현재 속한 학교가 없습니다.' });
    }

    // console.log('학교 이름:', school_name, '사용자 닉네임:', userNickname);

    // 학교의 total_time 또는 monthly_total_time에 따른 쿼리
    const schoolStatsQuery = isTotalTime ? `
      SELECT total_ranking, total_time FROM School WHERE school_id = ?;
    ` : `
      SELECT monthly_ranking, monthly_total_time FROM School WHERE school_id = ?;
    `;

    // 기여도 데이터도 total_time 또는 monthly_total_time에 따라 구분
    const contributionsQuery = isTotalTime ? `
      SELECT u.nickname, s.total_time
      FROM Users u
      JOIN StudyTimeRecords s ON u.user_id = s.user_id
      WHERE s.record_id = (
        SELECT MAX(record_id) 
        FROM StudyTimeRecords 
        WHERE user_id = u.user_id AND school_id = ?
      )
      ORDER BY s.total_time DESC;
    ` : `
      SELECT u.nickname, s.monthly_time AS total_time
      FROM Users u
      JOIN StudyTimeRecords s ON u.user_id = s.user_id
      WHERE s.record_id = (
        SELECT MAX(record_id) 
        FROM StudyTimeRecords 
        WHERE user_id = u.user_id AND school_id = ?
      )
      ORDER BY s.total_time DESC;
    `;
    

    db.query(schoolStatsQuery, [school_id], (statsError, statsResults) => {
      if (statsError) {
        console.error('학교 기여도 및 통계 쿼리 실행 실패:', statsError);
        return res.status(500).json({ message: '서버 오류' });
      }

      if (statsResults.length === 0) {
        return res.status(404).json({
          message: '학교 기여도 및 순위 정보가 없습니다.',
        });
      }

      const ranking = isTotalTime ? statsResults[0].total_ranking || 0 : statsResults[0].monthly_ranking || 0;
      const total_time = isTotalTime ? statsResults[0].total_time || 0 : statsResults[0].monthly_total_time || 0;

      db.query(contributionsQuery, [school_id], (contribError, contribResults) => {
        if (contribError) {
          console.error('기여도 쿼리 실행 실패:', contribError);
          return res.status(500).json({ message: '서버 오류' });
        }

        if (contribResults.length === 0) {
          return res.status(404).json({
            schoolName: school_name,
            ranking: ranking,
            total_time: total_time,
            userNickname: userNickname,
            contributions: [],
            message: '현재 학교에 속한 사용자가 없습니다.',
          });
        }

        return res.status(200).json({
          schoolName: school_name,
          ranking: ranking,
          total_time: total_time,
          userNickname: userNickname,
          contributions: contribResults,
        });
      });
    });
  });
});

app.post('/selected-school-contributions', (req, res) => {
  const { schoolName } = req.body;

  // 입력 데이터 검증
  if (!schoolName || typeof schoolName !== 'string' || schoolName.trim() === '') {
    return res.status(400).json({ error: '유효한 학교 이름이 필요합니다.' });
  }

  const trimmedSchoolName = schoolName.trim();

  const schoolIdQuery = `
    SELECT school_id FROM School WHERE school_name = ?
  `;

  db.query(schoolIdQuery, [trimmedSchoolName], (err, schoolResult) => {
    if (err) {
      console.error('Error fetching school_id:', err);
      return res.status(500).json({ message: '학교 정보를 가져오는 중 오류가 발생했습니다.' });
    }

    if (schoolResult.length === 0) {
      return res.status(404).json({ message: '해당 학교 정보를 찾을 수 없습니다.' });
    }

    const schoolId = schoolResult[0].school_id;

    const query = `
      SELECT u.nickname, s.total_time
      FROM Users u
      JOIN StudyTimeRecords s ON u.user_id = s.user_id
      WHERE s.record_id = (
        SELECT MAX(record_id) 
        FROM StudyTimeRecords 
        WHERE user_id = u.user_id AND school_id = ?
      )
      ORDER BY s.total_time DESC;
    `;

    db.query(query, [schoolId], (err, results) => {
      if (err) {
        console.error('쿼리 오류:', err);
        return res.status(500).json({ error: '데이터를 가져오는 중 오류가 발생했습니다.' });
      }

      if (results.length === 0) {
        return res.status(404).json({
          message: '해당 학교에 대한 기여도 정보가 없습니다.',
        });
      }

      return res.status(200).json({
        schoolName: trimmedSchoolName,
        contributions: results.map(row => ({
          nickname: row.nickname,
          total_time: row.total_time
        }))
      });
    });
  });
});

app.post('/selected-school-competition', (req, res) => {
  const { schoolName } = req.body;

  // 입력 데이터 검증
  if (!schoolName || typeof schoolName !== 'string' || schoolName.trim() === '') {
    return res.status(400).json({ error: '유효한 학교 이름이 필요합니다.' });
  }

  const trimmedSchoolName = schoolName.trim();

  const schoolIdQuery = `
    SELECT school_id FROM School WHERE school_name = ?
  `;

  db.query(schoolIdQuery, [trimmedSchoolName], (err, schoolResult) => {
    if (err) {
      console.error('Error fetching school_id:', err);
      return res.status(500).json({ message: '학교 정보를 가져오는 중 오류가 발생했습니다.' });
    }

    if (schoolResult.length === 0) {
      return res.status(404).json({ message: '해당 학교 정보를 찾을 수 없습니다.' });
    }

    const schoolId = schoolResult[0].school_id;

    const query = `
      SELECT u.nickname, s.monthly_time
      FROM Users u
      JOIN StudyTimeRecords s ON u.user_id = s.user_id
      WHERE s.record_id = (
        SELECT MAX(record_id) 
        FROM StudyTimeRecords 
        WHERE user_id = u.user_id AND school_id = ?
      )
      ORDER BY s.monthly_time DESC;
    `;

    db.query(query, [schoolId], (err, results) => {
      if (err) {
        console.error('쿼리 오류:', err);
        return res.status(500).json({ error: '데이터를 가져오는 중 오류가 발생했습니다.' });
      }

      if (results.length === 0) {
        return res.status(404).json({
          message: '해당 학교의 월간 기여도 데이터가 없습니다.',
        });
      }

      return res.status(200).json({
        schoolName: trimmedSchoolName,
        contributions: results.map(row => ({
          nickname: row.nickname,
          monthly_time: row.monthly_time
        }))
      });
    });
  });
});
// 혁진 끝

// 한재 시작
app.post('/get-user-id', async (req, res) => {
  const { userEmail } = req.body;
  // console.log(`Received request for user email: ${userEmail}`);

  // 입력 데이터 검증
  if (!userEmail || typeof userEmail !== 'string' || userEmail.trim() === '') {
    return res.status(400).json({ message: '유효한 이메일을 입력하세요.' });
  }

  const query = 'SELECT user_id FROM Users WHERE email = ?';
  db.query(query, [userEmail], (err, results) => {
  if(err) {
        return res.status(404).json({ message: 'User not fount'});
        }
        res.status(200).json({ user_id: results[0].user_id});
        });
});

// 사용자 정보 가져오기
app.post('/get-user-info', (req, res) => {
  const { userId } = req.body;
  // console.log('Received userId:', userId);

  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({ error: '유효한 사용자 ID가 필요합니다.' });
  }

  const query = `
      SELECT u.nickname, s.school_name, u.email, u.profile_image
      FROM Users u
      LEFT JOIN School s ON u.school_id = s.school_id
      WHERE u.user_id = ?;
  `;

  db.query(query, [userId], (err, results) => {
      if (err) {
          console.error('Error fetching user info:', err);
          return res.status(500).json({ error: 'Failed to fetch user info' });
      }
      // console.log('Query result:', results); // 디버깅 로그
      if (results.length === 0) {
          return res.status(404).json({ error: 'User not found' });
      } else {
          res.status(200).json({
              nickname: results[0].nickname,
              schoolName: results[0].school_name || null, // 학교 정보가 없을 경우 null 반환
              email: results[0].email,
              profileImage: results[0].profile_image, // 프로필 이미지 추가
          });
      }
  });
});

// 학교 수정
app.post('/update-school', (req, res) => {
  const { userId, newSchoolName } = req.body;

  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({ error: '유효한 사용자 ID가 필요합니다.' });
  }

  if (!newSchoolName || typeof newSchoolName !== 'string' || newSchoolName.trim() === '') {
    return res.status(400).json({ error: '유효한 학교 이름이 필요합니다.' });
  }

  const updateQuery = `
        UPDATE Users
        INNER JOIN School ON School.school_name = ?
        SET Users.school_name = ?, Users.school_id = School.school_id
        WHERE Users.user_id = ?;
    `;

  db.query(updateQuery, [newSchoolName, newSchoolName, userId], (err, results) => {
      if (err) {
          console.error('Error updating school name:', err);
          return res.status(500).json({ error: 'Failed to update school name' });
      }
      if (results.affectedRows === 0) {
          return res.status(404).json({ error: 'User not found' });
      }
      res.status(200).json({ message: 'School updated successfully' });
  });
});

app.post('/getPurchasedProfileIcons', (req, res) => {
  const { user_id } = req.body;

  // 입력 데이터 검증
  if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }

  // "프로필" 카테고리에 해당하는 구매 아이템 가져오기
  const query = `
    SELECT i.item_id, i.category, s.item_usName
    FROM Inventory i
    JOIN Store s ON i.item_id = s.item_id
    WHERE i.user_id = ? AND i.category = '프로필'
  `;

  db.query(query, [user_id], (err, results) => {
    if (err) {
      console.error('Error fetching purchased profile icons:', err);
      res.status(500).json({ message: '프로필 아이템을 가져오는 중 문제가 발생했습니다.' });
    } else {
      res.status(200).json({
        message: '프로필 아이템을 성공적으로 가져왔습니다.',
        items: results,
      });
    }
  });
});

// 타이머 기록을 계산하는 엔드포인트
app.post('/calculate-time-and-points', (req, res) => {
    const { input_record_time, user_id, start_time, end_time } = req.body;

    // 입력 데이터 검증
    if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
      return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
    }

    if (!input_record_time || !user_id || !start_time || !end_time) {
            return res.status(400).json({ message: 'Input record time, user ID, start time, and end time are required' });
        }

    // 1. 사용자가 속한 학교 ID 조회
    const schoolIdQuery = `
      SELECT school_id FROM Users WHERE user_id = ?
    `;

    db.query(schoolIdQuery, [user_id], (err, schoolResult) => {
        if (err) {
            console.error('Error fetching school_id:', err);
            return res.status(500).json({ message: '학교 정보를 가져오는 중 오류가 발생했습니다.' });
        }

        if (schoolResult.length === 0) {
            return res.status(404).json({ message: '학교 정보를 찾을 수 없습니다.' });
        }

        const schoolId = schoolResult[0].school_id;

        // 2. 현재 학교의 레벨을 조회
        const currentLevelQuery = `
          SELECT school_level FROM School WHERE school_id = ?
        `;

        db.query(currentLevelQuery, [schoolId], (err, currentLevelResult) => {
            if (err) {
                console.error('Error fetching current school level:', err);
                return res.status(500).json({ message: '학교 레벨 정보를 가져오는 중 오류가 발생했습니다.' });
            }

            if (currentLevelResult.length === 0) {
                return res.status(404).json({ message: '학교 레벨 정보를 찾을 수 없습니다.' });
            }

            const currentSchoolLevel = currentLevelResult[0].school_level;

            // 3. 프로시저 호출
            const query = `CALL CalculateTimeAndPoints_proc(?, ?, ?, ?)`;
                    db.query(query, [user_id, start_time, end_time, input_record_time], (err, results) => {
                        if (err) {
                            console.error('Error calling stored procedure:', err);
                            return res.status(500).json({ message: 'Error calling stored procedure' });
                        }

                // 4. 프로시저 실행 후 학교 레벨 다시 조회
                db.query(currentLevelQuery, [schoolId], (err, updatedLevelResult) => {
                    if (err) {
                        console.error('Error fetching updated school level:', err);
                        return res.status(500).json({ message: '업데이트된 학교 레벨 정보를 가져오는 중 오류가 발생했습니다.' });
                    }

                    const updatedSchoolLevel = updatedLevelResult[0].school_level;

                    // 5. 레벨 변경 여부 확인 후 알림 생성
                    if (currentSchoolLevel !== updatedSchoolLevel) {
                        // 6. 해당 학교의 모든 사용자에게 알림 생성
                        const getUsersQuery = `
                          SELECT user_id FROM Users WHERE school_id = ?
                        `;

                        db.query(getUsersQuery, [schoolId], (err, userResult) => {
                            if (err) {
                                console.error('Error fetching users for notification:', err);
                                return res.status(500).json({ message: '사용자 정보를 가져오는 중 오류가 발생했습니다.' });
                            }

                            userResult.forEach(user => {
                                const userId = user.user_id;

                                // 7. 학교 레벨업 알림 생성
                                const notificationMessage = `학교가 레벨업했습니다!`;  // 레벨업 메시지
                                const notificationQuery = `
                                    CALL CreateNotification(?, '학교 레벨업', ?, 'system')
                                `;
                                db.query(notificationQuery, [userId, notificationMessage], (err, notificationResult) => {
                                    if (err) {
                                        console.error('Error creating notification:', err);
                                        return res.status(500).send({ message: '알림 생성 중 오류가 발생했습니다.' });
                                    }
                                });
                            });
                        });
                    }

                    res.status(200).json({ message: 'Procedure called successfully', data: results });
                });
            });
        });
    });
});

// 사용자 ID에 해당하는 메달 목록을 가져오는 API
app.post('/get-user-medals', (req, res) => {
  const { userId } = req.body;

  // userId에 해당하는 메달 목록 가져오기
  const query = 'SELECT medal_id, ranking, battle_inf FROM Medal WHERE user_id = ? ORDER BY medal_id ASC';

  db.query(query, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    // 결과 확인을 위한 로그 추가
        // console.log('User ID:', userId);  // 요청한 userId 출력
        // console.log('Fetched Medals:', results);  // 가져온 메달 목록 출력

    // 메달 목록 반환
    res.json(results);
  });
});

// 사용자 ID에 해당하는 메달 목록을 가져오는 API
app.post('/get-school-medals', (req, res) => {
  const { schoolId } = req.body;

  // 입력 데이터 검증
  if (!schoolId || typeof schoolId !== 'number' || schoolId <= 0) {
    return res.status(400).json({ error: '유효한 학교 ID가 필요합니다.' });
  }

  // userId에 해당하는 메달 목록 가져오기
  const query = `
                SELECT
                    school_id,
                    MIN(medal_id) AS medal_id,  
                    MIN(ranking) AS ranking,  
                    MIN(battle_inf) AS battle_inf, 
                    get_date
                FROM Medal
                WHERE school_id = ?
                GROUP BY school_id, get_date
                ORDER BY medal_id ASC
                `;
 
  db.query(query, [schoolId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: '해당 학교의 메달 정보를 찾을 수 없습니다.' });
    }

    return res.status(200).json(results);
  });
});


app.post('/get-medal-info', (req, res) => {
  const { queryType, userId, schoolId, medalId } = req.body;

  // Validate input
  if (!queryType || !medalId) {
    return res.status(400).json({ message: 'queryType and medalId are required' });
  }

  if (typeof medalId !== 'number' || medalId <= 0) {
    return res.status(400).json({ message: '유효한 medalId가 필요합니다.' });
  }

  let query = '';
  let params = [];

  // Determine query type and construct appropriate query
  if (queryType === 'user') {
    if (!userId) {
      return res.status(400).json({ message: 'userId is required for queryType "user"' });
    }
    query = `
      SELECT *
      FROM Medal m
      WHERE m.user_id = ? AND m.medal_id = ?
    `;
    params = [userId, medalId];
  } else if (queryType === 'school') {
    if (!schoolId) {
      return res.status(400).json({ message: 'schoolId is required for queryType "school"' });
    }
    query = `
      SELECT *
      FROM Medal m
      WHERE m.school_id = ? AND m.medal_id = ?
    `;
    params = [schoolId, medalId];
  } else {
    return res.status(400).json({ message: 'Invalid queryType. Must be "user" or "school"' });
  }

  // Execute query
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error retrieving medal info:', err);
      return res.status(500).json({ message: 'Error retrieving medal information' });
    }

    if (results.length > 0) {
      res.status(200).json(results[0]);
    } else {
      res.status(404).json({ message: 'Medal information not found' });
    }
  });
});

app.post('/get-user-school-name', (req, res) => {
  const { userId } = req.body;
  // console.log(req.body);
  // console.log('Received userId:', userId);

  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }

  const query = `
    SELECT IFNULL(s.school_name, '학교없음') AS school_name
    FROM Users u
    LEFT JOIN School s ON u.school_id = s.school_id
    WHERE u.user_id = ?;
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error retrieving school name:', err);
      return res.status(500).json({ message: 'Error retrieving school name' });
    }

    // console.log('Query results:', results);

    if (results.length > 0) {
      res.status(200).json({ school_name: results[0].school_name });
    } else {
      res.status(200).json({ school_name: '학교없음' }); // 조회 결과가 없는 경우
    }
  });
});


// /get-user-nickname 엔드포인트 정의
app.post('/get-user-nickname', (req, res) => {
  const { userId } = req.body;  // 요청 본문에서 userId를 가져옴

  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }
  // userId로 사용자의 닉네임을 데이터베이스에서 조회
  const query = 'SELECT nickname FROM Users WHERE user_id = ?';  // 사용자 테이블에서 닉네임 조회
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('닉네임 조회 실패:', err);
      return res.status(500).json({ error: '닉네임 조회 실패' });
    }

    // 사용자가 존재하면 닉네임 반환
    if (results.length > 0) {
      return res.json({ nickname: results[0].nickname });
    } else {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }
  });
});

//fullSchool_screen.dart에 사용할 post문
app.post('/get-school-info', (req, res) => {
  const { userId } = req.body;
  // console.log(req.body);
  
  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }

  const query = `
    SELECT
      School.school_id,
      School.school_name,
      School.school_level,
      School.total_time,
      School.school_local,
      COUNT(Users.user_id) AS students
    FROM Users
    JOIN School ON Users.school_id = School.school_id
    WHERE Users.school_id = (
      SELECT school_id FROM Users WHERE user_id = ?
    )
    GROUP BY
      School.school_id,
      School.school_name,
      School.school_level,
      School.total_time,
      School.school_local;
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching school info:', err);
      return res.status(500).json({ message: 'Error retrieving school info' });
    }

    if (results.length > 0) {
      const schoolInfo = results[0];
      res.status(200).json(schoolInfo);
    } else {
      res.status(404).json({ message: 'School info not found' });
    }
  });
});
// 한재 끝

// 민서 시작
app.post('/checkProfileOwnership', (req, res) => {
  const { user_id, item_id } = req.body;

  // 입력 데이터 검증
  if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }
  if (!item_id || typeof item_id !== 'number' || item_id <= 0) {
    return res.status(400).json({ message: '유효한 아이템 ID가 필요합니다.' });
  }

  // Query to check if the user already owns an item in the "프로필" category
  const query = 'SELECT COUNT(*) AS count FROM Inventory WHERE user_id = ? AND category = "프로필" AND item_id = ?';
  db.query(query, [user_id, item_id], (err, results) => {
    if (err) {
      console.error('Error checking profile ownership:', err);
      res.status(500).json({ message: '서버 오류' });
    } else {
      const count = results[0].count;
      if (count > 0) {
        // If count > 0, the user already owns a profile item
        res.status(200).json({ alreadyOwned: true });
      } else {
        res.status(200).json({ alreadyOwned: false });
      }
    }
  });
});

//user의 point를 가져옴.
app.post('/getUserPoints', (req, res) => {
  const userId = req.body.user_id;

  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({ error: '유효한 사용자 ID가 필요합니다.' });
  }

  const query = 'SELECT points FROM Users WHERE user_id = ?';

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching points:', err);
      return res.status(500).json({ error: 'Failed to retrieve points' });
    }

    if (results.length > 0) {
      res.json({ points: results[0].points });
    } else {
      res.json({ points: 0 }); // Default if no points found
    }
  });
});

app.post('/purchaseItem', (req, res) => {
  const { user_id, item_id, item_price } = req.body;

  // 입력 데이터 검증
  if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }
  if (!item_id || typeof item_id !== 'number' || item_id <= 0) {
    return res.status(400).json({ message: '유효한 아이템 ID가 필요합니다.' });
  }
  if (!item_price || typeof item_price !== 'number' || item_price <= 0) {
    return res.status(400).json({ message: '유효한 아이템 가격이 필요합니다.' });
  }

  // MySQL 프로시저 호출
  const query = 'CALL purchaseItem(?, ?, ?)';
  db.query(query, [user_id, item_id, item_price], (err, results) => {
    if (err) {
      console.error('Error executing purchaseItem procedure:', err);
      res.status(500).json({ message: '구매 중 문제가 발생했습니다.' });
    } else {
      res.status(200).json({ message: '구매가 완료되었습니다.' });
    }
  });
});

//user의 가방
app.post('/getUserItems', (req, res) => {
  const { user_id, category } = req.body; // 카테고리도 함께 받아옴

  // 입력 데이터 검증
  if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
    return res.status(400).json({ error: '유효한 사용자 ID가 필요합니다.' });
  }
  if (category && typeof category !== 'string') {
    return res.status(400).json({ error: '유효한 카테고리 값이 필요합니다.' });
  }

  let query = `
    SELECT i.inventory_id, s.item_name, s.item_usName, i.category, i.acquired_at, i.is_placed, s.item_width, s.item_height
    FROM Inventory i
    JOIN Store s ON i.item_id = s.item_id
    WHERE i.user_id = ?`;

  // 카테고리가 '전체'가 아닌 경우 필터링 추가
  if (category && category !== '전체') {
    query += ` AND i.category = ?`;
  }

  db.query(query, category && category !== '전체' ? [user_id, category] : [user_id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to load user items' });
    }

    const items = results.map(item => ({
      inventory_id: item.inventory_id,
      item_name: item.item_name,
      item_usName: item.item_usName,
      category: item.category,
      acquired_at: item.acquired_at,
      is_placed: item.is_placed,
      item_width: item.item_width,
      item_height: item.item_height
    }));

    res.json({ items });
  });
});

//Store테이블 가져오기
app.post('/getItemsByCategory', (req, res) => {
  const category = req.body.category;

  // 입력 데이터 검증
  if (!category || typeof category !== 'string' || category.trim().length === 0) {
    return res.status(400).json({ error: '유효한 카테고리 값이 필요합니다.' });
  }

  const query = `SELECT item_id, item_name, item_usName, description, price FROM Store WHERE category = ?`;

  db.query(query, [category], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ items: results });
  });
});

// Update is_placed API
app.post('/updateItemIsPlaced', (req, res) => {
  const { user_id, inventory_id, x, y } = req.body; // inventory_id 받아오기

  // 입력 데이터 검증
  if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }
  if (!inventory_id || typeof inventory_id !== 'number' || inventory_id <= 0) {
    return res.status(400).json({ message: '유효한 인벤토리 ID가 필요합니다.' });
  }
  if (x === undefined || y === undefined || typeof x !== 'number' || typeof y !== 'number') {
    return res.status(400).json({ message: '유효한 x, y 좌표가 필요합니다.' });
  }

  // SQL 쿼리 작성 (inventory_id 사용)
  const query = `
    UPDATE Inventory
    SET is_placed = 2, x = ?, y = ?
    WHERE inventory_id = ? AND user_id = ?;
  `;

  // 쿼리 실행
  db.query(query, [x, y, inventory_id, user_id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Database error' });
    }
    if (result.affectedRows > 0) {
      return res.status(200).json({ message: 'Item updated successfully' });
    } else {
      return res.status(404).json({ message: 'Item not found' });
    }
  });
});

// 배치된 아이템 가져오기 API
app.post('/get-placed-items', (req, res) => {
  const { userId } = req.body;
  
  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }

  const query = `
    SELECT i.inventory_id, s.item_name, s.item_usName, i.x, i.y, i.category, i.priority, s.item_width, s.item_height, i.is_flipped
    FROM Inventory AS i
    INNER JOIN Store AS s ON i.item_id = s.item_id
    WHERE i.user_id = ? AND i.is_placed IN (1, 2)
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(200).json(results);
  });
});

// 배치된 아이템 삭제 API
app.post('/remove-item', (req, res) => {
  const { user_id, inventory_id } = req.body;

  // 입력 데이터 검증
  if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }
  if (!inventory_id || typeof inventory_id !== 'number' || inventory_id <= 0) {
    return res.status(400).json({ message: '유효한 인벤토리 ID가 필요합니다.' });
  }

  const query = `
    UPDATE Inventory
    SET is_placed = 3
    WHERE user_id = ? AND inventory_id = ?
  `;

  db.query(query, [user_id, inventory_id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.affectedRows > 0) {
      res.status(200).json({ message: 'Item removed successfully' });
    } else {
      res.status(404).json({ message: 'Item not found or not placed' });
    }
  });
});

// 아이템 위치 업데이트 API
app.post('/update-item-position', async (req, res) => {
  const { user_id, inventory_id, x, y, priority, is_flipped } = req.body;

  // 입력 데이터 검증
  if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
    console.log('유효한 사용자 ID가 필요합니다.');
  }

  if (!inventory_id || typeof inventory_id !== 'number' || inventory_id <= 0) {
    console.log('유효한 인벤토리 ID가 필요합니다.');
  }

  if (x === undefined || y === undefined || typeof x !== 'number' || typeof y !== 'number') {
    console.log('유효한 x, y 좌표가 필요합니다.');
  }

  if (priority === undefined || typeof priority !== 'number') {
    console.log('유효한 우선순위(priority)가 필요합니다.');
  }

  if (is_flipped === undefined) {
    console.log('유효한 is_flipped 값이 필요합니다.');
  }

  try {
    await db.query(
      `UPDATE Inventory
        SET x = ?, y = ?, priority = ?, is_flipped = ?,
         is_placed = CASE
            WHEN is_placed = 3 THEN 0
            WHEN is_placed = 2 THEN 1
            ELSE is_placed
        END
        WHERE user_id = ? AND inventory_id = ?`,
      [x, y, priority, is_flipped, user_id, inventory_id]
    );

    res.json({ message: 'Item updated successfully' }); // 최종 응답
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ error: 'Failed to update item' }); // 오류 응답
  }
});

app.post('/complete-item-position', async (req, res) => {
  const { user_id } = req.body;

  // 입력 데이터 검증
  if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
    console.log('유효한 사용자 ID가 필요합니다.');
  }

  try {
    await db.query(
      `UPDATE Inventory
      SET is_placed = CASE
          WHEN is_placed = 3 THEN 0
          WHEN is_placed = 2 THEN 1
          ELSE is_placed
      END
      WHERE user_id = ? AND is_placed IN (2, 3)
      `,
      [user_id]
    );

    res.json({ message: 'Complete Item successfully' }); // 최종 응답
  } catch (err) {
    console.error('Cannot Complete item:', err);
    res.status(500).json({ error: 'Failed to complete item' }); // 오류 응답
  }
});

// app.post('/complete-item-position', async (req, res) => {
//   const { user_id } = req.body;

//   // 입력 데이터 검증
//   if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
//     return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
//   }

//   try {
//     const result = await db.query(
//       `UPDATE Inventory
//       SET is_placed = CASE
//           WHEN is_placed = 3 THEN 0
//           WHEN is_placed = 2 THEN 1
//           ELSE is_placed
//       END
//       WHERE user_id = ? AND is_placed IN (2, 3)
//       `,
//       [user_id]
//     );

//     if (result.affectedRows > 0) {
//       console.log(`Complete Item successfully - user_id: ${user_id}`);
//       return res.status(200).json({ message: '아이템 상태가 성공적으로 업데이트되었습니다.' });
//     } else {
//       return res.status(404).json({ message: '업데이트할 아이템이 없습니다.' });
//     }
//   } catch (err) {
//     console.error('Cannot Complete item:', err);
//     res.status(500).json({ error: 'Failed to complete item' }); // 오류 응답
//   }
// });

app.post('/cancel-item-position', async (req, res) => {
  const { user_id } = req.body;
  
  // 입력 데이터 검증
  if (!user_id || typeof user_id !== 'number' || user_id <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }

  try {
    await db.query(
      `UPDATE Inventory
        SET is_placed = CASE
            WHEN is_placed = 3 THEN 1
            WHEN is_placed = 2 THEN 0
        END
        WHERE user_id = ? AND is_placed IN (3, 2);
      `,
      [user_id]
    );

    if (result.affectedRows > 0) {
      // console.log(`Item cancel successfully - user_id: ${user_id}`);
      return res.status(200).json({ message: '아이템 배치가 취소되었습니다.' });
    } else {
      return res.status(404).json({ message: '취소할 아이템이 없습니다.' });
    }
  } catch (err) {
    console.error('Error canceling item:', err);
    res.status(500).json({ error: 'Failed to cancel item' }); // 오류 응답
  }
});
// 민서 끝

// 재희 시작
app.get('/search-user', (req, res) => {
  const { nickname } = req.query;
  const userId = req.userId; // 요청 보낸 사용자의 userId (예: 토큰에서 추출)

  // console.log('Received search request:', { userId, nickname });

  // 입력 데이터 검증
  if (!nickname || typeof nickname !== 'string' || nickname.trim().length < 2 || nickname.trim().length > 14) {
    return res.status(400).send({ message: '닉네임은 2~14자의 문자열이어야 합니다.' });
  }

  const query = 'SELECT user_id, nickname, profile_image FROM Users WHERE nickname = ?';

  db.query(query, [nickname.trim()], (err, rows) => {
    if (err) {
      console.error('Error searching user by nickname:', err);
      return res.status(500).send({ message: '사용자를 검색하는 중 오류가 발생했습니다.' });
    }

    if (rows.length === 0) {
      return res.status(404).send({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 자기 자신의 닉네임을 검색한 경우 거부
    if (rows[0].user_id === userId) {
      return res.status(400).send({ message: '자기 자신을 검색할 수 없습니다.' });
    }

    return res.status(200).send(rows[0]); // 유저 정보 반환
  });
});


app.post('/send-friend-request', async (req, res) => {
  const { userId, friendNickname } = req.body;

  // console.log('Received friend request:', { userId, friendNickname });

  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).send({ message: '유효한 사용자 ID가 필요합니다.' });
  }

  if (!friendNickname || typeof friendNickname !== 'string' || friendNickname.trim().length < 2 || friendNickname.trim().length > 14) {
    return res.status(400).send({ message: '닉네임은 2~14자의 문자열이어야 합니다.' });
  }

  try {
    // 1. 친구 요청 대상 사용자 찾기
    const userRows = await queryAsync('SELECT user_id FROM Users WHERE nickname = ?', [friendNickname.trim()]);

    if (userRows.length === 0) {
      return res.status(404).send({ message: '친구 요청 대상 사용자를 찾을 수 없습니다.' });
    }

    const friendId = userRows[0].user_id;

    // 2. 자기 자신에게 친구 요청 방지
    if (userId === friendId) {
      return res.status(400).send({ message: '자기 자신에게 친구 요청을 보낼 수 없습니다.' });
    }

    // 3. 기존 친구 요청 또는 친구 상태 확인
    const existingRequest = await queryAsync(
      `SELECT * FROM Friends
       WHERE (user_id = ? AND friend_id = ?)
          OR (user_id = ? AND friend_id = ?)
          AND status IN ('requested', 'accepted')`,
      [userId, friendId, friendId, userId]
    );

    if (existingRequest.length > 0) {
      return res.status(400).send({ message: '이미 친구 요청이 존재하거나 친구 상태입니다.' });
    }

    // 4. 친구 요청 저장
    const insertResult = await queryAsync(
      `INSERT INTO Friends (user_id, friend_id, status, created_at, updated_at)
       VALUES (?, ?, 'requested', NOW(), NOW())`,
      [userId, friendId]
    );

    if (insertResult.affectedRows === 0) {
      return res.status(500).send({ message: '친구 요청을 보내는 중 오류가 발생했습니다.' });
    }

    // 5. 친구 요청 알림 생성
    await queryAsync(
      `CALL CreateNotification(?, '새로운 친구 요청', '새로운 친구 요청이 있습니다.', 'friend_request')`,
      [friendId]
    );

    return res.status(200).send({ message: '친구 요청이 성공적으로 전송되었습니다.' });

  } catch (err) {
    console.error('Error sending friend request:', err);
    return res.status(500).send({ message: '친구 요청을 보내는 중 오류가 발생했습니다.' });
  }
});


// 친구 삭제
app.post('/remove-friend', async (req, res) => {
  const { userId, friendId } = req.body;

  // console.log('Received remove friend request:', { userId, friendId });

  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }

  if (!friendId || typeof friendId !== 'number' || friendId <= 0) {
    return res.status(400).json({ message: '유효한 친구 ID가 필요합니다.' });
  }

  if (userId === friendId) {
    return res.status(400).json({ message: '자기 자신을 친구에서 삭제할 수 없습니다.' });
  }

  try {
    // 1. 친구 관계 확인 (accepted 상태인지 검증)
    const friendCheck = await queryAsync(
      `SELECT * FROM Friends
       WHERE (user_id = ? AND friend_id = ?)
          OR (user_id = ? AND friend_id = ?)
          AND status = 'accepted'`,
      [userId, friendId, friendId, userId]
    );

    if (friendCheck.length === 0) {
      return res.status(404).json({ message: '친구 관계를 찾을 수 없습니다.' });
    }

    // 2. 친구 삭제
    const deleteResult = await queryAsync(
      `DELETE FROM Friends
       WHERE (user_id = ? AND friend_id = ?)
          OR (user_id = ? AND friend_id = ?)`,
      [userId, friendId, friendId, userId]
    );

    if (deleteResult.affectedRows > 0) {
      // console.log(`Friend removed successfully - userId: ${userId}, friendId: ${friendId}`);
      return res.status(200).json({ message: '친구가 성공적으로 삭제되었습니다.' });
    } else {
      return res.status(500).json({ message: '친구 삭제 중 오류가 발생했습니다.' });
    }
  } catch (err) {
    console.error('Error removing friend:', err);
    return res.status(500).json({ message: '친구 삭제 중 오류가 발생했습니다.' });
  }
});



// 친구 요청 목록 가져오기
app.get('/friend-requests/:userId', async (req, res) => {
  const userId = Number(req.params.userId);

  // console.log('Received request for friend requests - userId:', userId);

  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }

  try {
    const query = `
      SELECT f.friendship_id, f.user_id, f.friend_id, u.nickname, u.profile_image
      FROM Friends f
      JOIN Users u ON f.user_id = u.user_id
      WHERE f.friend_id = ? AND f.status = 'requested'
    `;

    const rows = await queryAsync(query, [userId]);

    if (!rows || rows.length === 0) {
          return res.status(200).json([]); // 친구 목록이 비어 있으면 빈 배열 반환
        }

    return res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching friend requests:', err);
    return res.status(500).json({ message: '친구 요청을 가져오는 중 오류가 발생했습니다.' });
  }
});



// 친구 요청 수락

app.post('/accept-friend-request', async (req, res) => {
  const { friendshipId } = req.body;

  // console.log('Received accept friend request:', { friendshipId });

  // 입력 데이터 검증
  if (!friendshipId || typeof friendshipId !== 'number' || friendshipId <= 0) {
    return res.status(400).json({ message: '유효한 친구 요청 ID가 필요합니다.' });
  }

  try {
    // 1. 친구 요청 수락 상태로 업데이트
    const updateResult = await queryAsync(
      `UPDATE Friends
       SET status = 'accepted'
       WHERE friendship_id = ? AND status = 'requested'`,
      [friendshipId]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ message: '해당 친구 요청을 찾을 수 없습니다.' });
    }

    // 2. friendship_id를 통해 요청 보낸 user_id 및 상대방 friend_id 가져오기
    const userResult = await queryAsync(
      `SELECT user_id, friend_id FROM Friends
       WHERE friendship_id = ?`,
      [friendshipId]
    );

    if (userResult.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const requesterId = userResult[0].user_id; // 요청 보낸 사람
    const accepterId = userResult[0].friend_id; // 요청을 수락한 사람

    // 3. 요청을 수락한 사용자의 nickname 가져오기
    const nicknameResult = await queryAsync(
      `SELECT nickname FROM Users
       WHERE user_id = ?`,
      [accepterId]
    );

    if (nicknameResult.length === 0) {
      return res.status(404).json({ message: '닉네임을 찾을 수 없습니다.' });
    }

    const accepterNickname = nicknameResult[0].nickname;

    // 4. 친구 요청 수락 알림 생성 (nickname 포함)
    const notificationMessage = `${accepterNickname} 님이 친구 요청을 수락했습니다!`;
    await queryAsync(
      `CALL CreateNotification(?, '친구 요청 수락', ?, 'friend_request')`,
      [requesterId, notificationMessage]
    );

    return res.status(200).send({ message: '친구 요청이 성공적으로 수락되었습니다.' });

  } catch (err) {
    console.error('Error accepting friend request:', err);
    return res.status(500).send({ message: '친구 요청 수락 중 오류가 발생했습니다.' });
  }
});


// 친구 요청 거절
app.post('/reject-friend-request', async (req, res) => {
  const { friendshipId } = req.body;

  // console.log('Received reject friend request:', { friendshipId });

  // 입력 데이터 검증
  if (!friendshipId || typeof friendshipId !== 'number' || friendshipId <= 0) {
    return res.status(400).json({ message: '유효한 친구 요청 ID가 필요합니다.' });
  }

  try {
    // 1. 친구 요청 거절 (Friends 테이블에서 삭제)
    const deleteResult = await queryAsync(
      `DELETE FROM Friends
       WHERE friendship_id = ? AND status = 'requested'`,
      [friendshipId]
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ message: '해당 친구 요청을 찾을 수 없습니다.' });
    }

    return res.status(200).json({ message: '친구 요청이 성공적으로 거절되었습니다.' });

  } catch (err) {
    console.error('Error rejecting friend request:', err);
    return res.status(500).json({ message: '친구 요청 거절 중 오류가 발생했습니다.' });
  }
});


app.get('/friends/:userId', async (req, res) => {
  const userId = Number(req.params.userId);

  // console.log('Received request for friends list - userId:', userId);

  // 입력 데이터 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({ message: '유효한 사용자 ID가 필요합니다.' });
  }

  try {
    const query = `
      SELECT
        CASE
          WHEN f.user_id = ? THEN f.friend_id
          ELSE f.user_id
        END AS friend_id,
        u.nickname,
        u.account_status,
        u.profile_image
      FROM Friends f
      JOIN Users u ON u.user_id = (
        CASE
          WHEN f.user_id = ? THEN f.friend_id
          ELSE f.user_id
        END
      )
      WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
    `;

    const results = await queryAsync(query, [userId, userId, userId, userId]);

    if (!results || results.length === 0) {
      return res.status(200).json([]); // 친구 목록이 비어 있으면 빈 배열 반환
    }

    return res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching friends:', err);
    return res.status(500).json({ message: '친구 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});


// 알림 데이터 가져오기
app.post('/get-notifications', async (req, res) => {
    const { userId } = req.body;

    // console.log('Received request for notifications - userId:', userId);

    // 입력 데이터 검증
    if (!userId || typeof userId !== 'number' || userId <= 0) {
        return res.status(400).json({ error: '유효한 사용자 ID가 필요합니다.' });
    }

    try {
        const query = `
            SELECT notification_id, title, message, type, is_read, created_at
            FROM Notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;

        const results = await queryAsync(query, [userId]);

        if (!results || results.length === 0) {
            return res.status(200).json([]); // 알림이 없을 경우 빈 배열 반환
        }

        return res.status(200).json(results);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        return res.status(500).json({ error: '알림 데이터를 가져오는 중 오류가 발생했습니다.' });
    }
});

// POST /get-notifications
app.post('/get-notifications', async (req, res) => {
    const { userId, includeRead } = req.body;

    // 입력 데이터 검증
        if (!userId || typeof userId !== 'number' || userId <= 0) {
            return res.status(400).json({ error: '유효한 사용자 ID가 필요합니다.' });
        }

    try {
        const connection = await mysql.createConnection(dbConfig);
        const query = includeRead
            ? 'SELECT * FROM Notifications WHERE user_id = ? ORDER BY created_at DESC'
            : 'SELECT * FROM Notifications WHERE user_id = ? AND is_read = FALSE ORDER BY created_at DESC';

        const [rows] = await connection.execute(query, [userId]);
        await connection.end();

        return res.status(200).json(rows);
    } catch (err) {
        console.error("Error fetching notifications:", err);
        return res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

// 예제: db를 사용해 쿼리 실행
app.post('/mark-notification-read', (req, res) => {
    const { notificationId } = req.body;

    if (!notificationId) {
        return res.status(400).json({ error: "Missing notificationId in request body" });
    }

    db.query(
        'UPDATE Notifications SET is_read = TRUE WHERE notification_id = ?',
        [notificationId],
        (err, result) => {
            if (err) {
                console.error("Error marking notification as read:", err);
                return res.status(500).json({ error: "Failed to mark notification as read" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Notification not found" });
            }

            return res.status(200).json({ success: true });
        }
    );
});


// 일별 공부 시간 가져오기 API
app.post('/get-daily-study-times', async (req, res) => {
  const { userId } = req.body;

  // 입력 검증
  if (!userId || typeof userId !== 'number' || userId <= 0) {
      console.log("userId가 유효하지 않음:", userId);
      return res.status(400).json({ error: '유효한 userId가 필요합니다.' });
  }

  try {
      const sql = `SELECT record_date, daily_time FROM StudyTimeRecords WHERE user_id = ?`;
      const results = await queryAsync(sql, [userId]);

      if (results.length === 0) {
          console.log("⚠️ 일별 공부 시간 데이터 없음:", userId);
          return res.status(404).json({ error: '일별 공부 기록이 없습니다.' });
      }

      // console.log("Search daily study times results:", results);
      return res.json(results);
  } catch (err) {
      console.error("Error fetching daily study times:", err);
      return res.status(500).json({ error: '일별 공부 시간을 가져오는 중 오류가 발생했습니다.' });
  }
});

app.get('/friends/:userId', async (req, res) => {
  let { userId } = req.params;

  // 입력 검증
  if (!userId || typeof userId !== 'number' || !/^\d+$/.test(userId)) {
      console.log("Invalid userId:", userId);
      return res.status(400).json({ error: '유효한 userId가 필요합니다.' });
  }

  try {
      const query = `
          SELECT
              CASE
                  WHEN f.user_id = ? THEN f.friend_id
                  ELSE f.user_id
              END AS friend_id,
              u.nickname,
              u.account_status
          FROM Friends f
          JOIN Users u ON u.user_id = (
              CASE
                  WHEN f.user_id = ? THEN f.friend_id
                  ELSE f.user_id
              END
          )
          WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
      `;

      const results = await queryAsync(query, [userId, userId, userId, userId]);

      if (results.length === 0) {
          return res.status(404).json({ message: '친구 목록이 비어 있습니다.' });
      }

      return res.status(200).json(results);
  } catch (err) {
      console.error("Error fetching friends:", err);
      return res.status(500).json({ message: '친구 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});


app.post('/change-password', async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;

    // **1️⃣ 입력값 검증 (userId, currentPassword, newPassword)**
    if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ message: 'userId, currentPassword, newPassword는 필수 입력값입니다.' });
    }


    try {
        // **4️⃣ 사용자 존재 여부 및 비밀번호 조회**
        const sql = 'SELECT password FROM Users WHERE user_id = ?';
        const results = await queryAsync(sql, [userId]);

        if (results.length === 0) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        const user = results[0];

        // **5️⃣ 비밀번호 검증 (해싱된 경우와 평문 비밀번호 처리)**
        const isHashed = user.password.startsWith('$2b$');

        if (isHashed) {
            // bcrypt 해싱된 비밀번호 비교
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: '현재 비밀번호가 올바르지 않습니다.' });
            }
        } else {
            // 평문 비밀번호가 저장된 경우 → 강제 로그아웃 유도
            console.warn(`보안 경고: userId ${userId}가 해싱되지 않은 비밀번호를 사용 중.`);
            return res.status(403).json({
                message: '보안 문제로 인해 비밀번호를 변경할 수 없습니다. 관리자에게 문의하세요.'
            });
        }

        // 비밀번호 검증 (최소 8자, 숫자+영문 포함)
              if (newPassword.length < 8 || !/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
                return res.status(400).json({ message: '비밀번호는 최소 8자 이상이며, 숫자와 영문자를 포함해야 합니다.' });
              }

        // **6️⃣ 새로운 비밀번호 해싱 및 저장**
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        const updateSql = 'UPDATE Users SET password = ? WHERE user_id = ?';
        await queryAsync(updateSql, [hashedPassword, userId]);

        return res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (err) {
        console.error('비밀번호 변경 중 오류 발생:', err);
        return res.status(500).json({ message: '비밀번호 변경 중 오류가 발생했습니다.' });
    }
});

app.post('/reset-items-to-bag', async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {

    const query = 'UPDATE Inventory SET is_placed = 0 WHERE user_id = ?';
    const result = await queryAsync(query, [user_id]);

    res.status(200).json({ message: 'Items reset to bag successfully' });

  } catch (err) {
    console.error('Error resetting items to bag:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});
// 재희 끝

// 서버 시작
app.listen(port, () => {
    console.log(`Server running at http://116.124.191.174:${port}`);
})
