const fs = require('fs');
const path = require('path');

// 비용 계산 기준
const cpuCostPerMs = 0.0001; // ms당 CPU 비용 ($)
const networkCostPerByte = 0.00001; // 바이트당 네트워크 비용 ($)

// 로그 파일 경로
const logFilePath = path.join(__dirname, 'requests.log');

// 로그 파일 읽기 및 비용 계산
fs.readFile(logFilePath, 'utf-8', (err, data) => {
  if (err) {
    console.error('Error reading log file:', err);
    return;
  }

  const lines = data.split('\n').filter(Boolean); // 빈 줄 제거
  let totalCost = 0;

  lines.forEach((line) => {
    const match = line.match(/(\d+) ms - (\d+) bytes/);
    if (match) {
      const responseTimeMs = parseInt(match[1], 10); // 처리 시간
      const contentLengthBytes = parseInt(match[2], 10); // 응답 크기

      const cpuCost = responseTimeMs * cpuCostPerMs;
      const networkCost = contentLengthBytes * networkCostPerByte;
      const requestCost = cpuCost + networkCost;

      totalCost += requestCost;
    }
  });

  console.log(`총 서버 이용 비용: $${totalCost.toFixed(5)}`);
});
