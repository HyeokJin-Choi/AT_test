const fs = require('fs');
const path = require('path');

// 비속어 파일 목록
const badWordFiles = ['ko-KR.txt', 'ja-JP.txt', 'zh-CN.txt', 'en-US.txt'];

// 병합된 비속어 리스트
const mergedBadWords = { invalidString: [] };

badWordFiles.forEach((file) => {
  const filePath = path.join(__dirname, file);

  if (fs.existsSync(filePath)) {
    // 파일 읽기
    const words = fs.readFileSync(filePath, 'utf-8')
      .split('\n') // 줄바꿈 기준으로 단어 분리
      .map(word => word.trim()) // 공백 제거
      .filter(word => word.length > 0); // 빈 문자열 제거

    // 병합
    mergedBadWords.invalidString.push(...words);
  } else {
    console.error(`File not found: ${filePath}`);
  }
});

// JSON 파일로 저장
const outputFilePath = path.join(__dirname, '..', 'invalid-words.json');
fs.writeFileSync(outputFilePath, JSON.stringify(mergedBadWords, null, 2), 'utf-8');
console.log(`Merged bad words saved to ${outputFilePath}`);
