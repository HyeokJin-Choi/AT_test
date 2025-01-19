const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, 'network.log');
const cpuCostPerPercent = 0.00001;
const networkCostPerMB = 0.01;

fs.readFile(logFilePath, 'utf-8', (err, data) => {
  if (err) {
    console.error('Error reading log file:', err);
    return;
  }

  const lines = data.split('\n').filter(Boolean);
  let totalCost = 0;

  lines.forEach((line) => {
    const match = line.match(/(\d+) bytes (\d+) bytes/); // 요청 및 응답 크기 추출
    if (match) {
      const reqSizeMB = parseInt(match[1], 10) / 1024 / 1024;
      const resSizeMB = parseInt(match[2], 10) / 1024 / 1024;
      const networkCost = (reqSizeMB + resSizeMB) * networkCostPerMB;

      // CPU 비용 (고정값으로 예측)
      const cpuCost = 5 * cpuCostPerPercent; // 예제 값

      totalCost += networkCost + cpuCost;
    }
  });

  console.log(`총 서버 비용: $${totalCost.toFixed(6)}`);
});
