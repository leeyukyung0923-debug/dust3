// Vercel 서버리스 함수: 에어코리아 대기오염 API 중계 핸들러
export default async function handler(req, res) {
  // CORS 허용 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  // OPTIONS 사전 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. 쿼리스트링에서 시도(sido) 파라미터 추출 (없으면 기본값 '서울')
  const sido = req.query.sido || '서울';

  // 2. 환경변수에서 AIRKOREA_KEY 읽기
  const rawKey = process.env.AIRKOREA_KEY;

  // [원인 1 대응] Vercel 환경변수가 설정되지 않은 경우 명확한 안내 반환
  if (!rawKey || rawKey.trim() === '') {
    return res.status(500).json({
      error: 'Vercel 대시보드(Settings > Environment Variables)에 AIRKOREA_KEY 환경변수가 설정되지 않았습니다.',
      details: '로컬의 .env.local은 보안상 깃허브에 올라가지 않으므로, Vercel 웹사이트에서 직접 키를 등록한 뒤 Redeploy(재배포)해야 합니다.'
    });
  }

  // [원인 2 대응] 이중 인코딩(Double Encoding) 방지 처리
  // 이미 인코딩된 키(%2B 등)를 다시 encodeURIComponent 하면 %252B가 되어 인증 오류가 발생하므로 디코딩 후 인코딩
  let serviceKey = rawKey.trim();
  try {
    serviceKey = encodeURIComponent(decodeURIComponent(serviceKey));
  } catch (e) {
    serviceKey = encodeURIComponent(serviceKey);
  }

  // 3. 에어코리아 실시간 대기오염 정보 조회 API URL 생성
  const apiUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${serviceKey}&returnType=json&sidoName=${encodeURIComponent(sido)}&numOfRows=100&pageNo=1&ver=1.3`;

  try {
    // 공공데이터포털 API로 비동기 GET 요청 전송
    const response = await fetch(apiUrl);

    // HTTP 상태 코드가 정상이 아닐 경우 예외 처리
    if (!response.ok) {
      return res.status(response.status).json({
        error: `공공데이터 API 서버 응답 오류가 발생했습니다. (상태코드: ${response.status})`
      });
    }

    // 응답 본문 텍스트 추출
    const textData = await response.text();

    // 4. JSON 파싱 시도 (실패하거나 XML 에러 응답인 경우 한국어 메시지 반환)
    let parsedData;
    try {
      parsedData = JSON.parse(textData);
    } catch (parseError) {
      // XML 에러 메시지 내용 추출 시도
      let errMsg = '인증키 또는 요청값을 확인해주세요.';
      if (textData.includes('SERVICE_KEY_IS_NOT_REGISTERED')) {
        errMsg = '공공데이터포털에 등록되지 않은 인증키이거나, 신규 발급 후 동기화(약 1~2시간 소요) 대기 중입니다.';
      } else if (textData.includes('SERVICE_KEY_IS_NULL')) {
        errMsg = '인증키가 전달되지 않았습니다. Vercel 환경변수를 확인해주세요.';
      }
      return res.status(400).json({
        error: errMsg,
        details: textData.slice(0, 300)
      });
    }

    // 5. 응답 본문 내부의 resultCode 검증 ('00'이 정상이 아닐 경우)
    const header = parsedData?.response?.header;
    const resultCode = header?.resultCode;
    const resultMsg = header?.resultMsg;

    if (resultCode && resultCode !== '00') {
      return res.status(400).json({
        error: `공공데이터 API 요청 실패 [코드: ${resultCode}]: ${resultMsg || '정상적으로 처리되지 않았습니다.'}`,
        resultCode: resultCode
      });
    }

    // 6. 정상 데이터 클라이언트에 반환
    return res.status(200).json(parsedData);

  } catch (error) {
    // 네트워크 오류 또는 기타 서버 예외 처리
    return res.status(500).json({
      error: '대기오염 데이터를 가져오는 중 서버 오류가 발생했습니다.',
      message: error.message
    });
  }
}
