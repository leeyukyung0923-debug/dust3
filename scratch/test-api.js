import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const match = envContent.match(/AIRKOREA_KEY=(.+)/);
const key = match ? match[1].trim() : '';

console.log('읽은 키:', key);

async function testKey(serviceKeyParam) {
  const url = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${serviceKeyParam}&returnType=json&sidoName=${encodeURIComponent('서울')}&numOfRows=10&pageNo=1&ver=1.3`;
  console.log('요청 URL:', url);
  try {
    const res = await fetch(url);
    console.log('HTTP Status:', res.status);
    const text = await res.text();
    console.log('응답 내용 (앞 300자):', text.slice(0, 300));
  } catch (err) {
    console.error('Fetch 에러:', err);
  }
}

// 1. 원본 그대로 테스트
console.log('\n--- 1. 원본 키 그대로 테스트 ---');
await testKey(key);

// 2. encodeURIComponent 테스트
console.log('\n--- 2. encodeURIComponent(key) 테스트 ---');
await testKey(encodeURIComponent(key));

// 3. decodeURIComponent 테스트 후 인코딩
console.log('\n--- 3. encodeURIComponent(decodeURIComponent(key)) 테스트 ---');
await testKey(encodeURIComponent(decodeURIComponent(key)));

