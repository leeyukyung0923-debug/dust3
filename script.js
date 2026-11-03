// ============================================================
// Vercel 서버리스 API 엔드포인트 설정
// ============================================================

// 자체 백엔드 서버리스 함수 주소 (/api/dust?sido=지역명)
const API_ENDPOINT = '/api/dust';

// ============================================================
// DOM 요소 참조 변수 선언
// ============================================================

// 시도 선택 셀렉트 드롭다운 요소 취득
const sidoSelect = document.getElementById('sidoSelect');

// 선택된 지역명 표시 요소 취득
const regionNameDisplay = document.getElementById('regionNameDisplay');

// 상단 공기 신호등 메인 카드 컨테이너 취득
const trafficLightCard = document.getElementById('trafficLightCard');

// 신호등 대형 이모지 표시 요소 취득
const trafficEmoji = document.getElementById('trafficEmoji');

// 신호등 등급 텍스트(좋음/보통/나쁨/매우나쁨) 표시 요소 취득
const trafficGradeText = document.getElementById('trafficGradeText');

// 평균 미세먼지 수치 텍스트 표시 요소 취득
const averageValue = document.getElementById('averageValue');

// 한 줄 권고 안내 문구 표시 요소 취득
const trafficNotice = document.getElementById('trafficNotice');

// 한국어 측정 기준 시각 표시 요소 취득
const trafficTime = document.getElementById('trafficTime');

// 차트 섹션 전체 영역 취득
const chartSection = document.getElementById('chartSection');

// Chart.js 캔버스 DOM 요소 취득
const dustChartCanvas = document.getElementById('dustChart');

// 측정소별 상세 카드가 렌더링될 그리드 컨테이너 취득
const stationGrid = document.getElementById('stationGrid');

// ============================================================
// 전역 변수: Chart.js 인스턴스 관리
// ============================================================

// 기존 차트 파괴 및 재할당을 위한 전역 차트 객체 변수
let dustChartInstance = null;

// ============================================================
// 유틸리티 함수: 데이터 정제 및 한국어 포맷팅
// ============================================================

// [조건] 측정 시각을 '2026년 10월 28일 16시 기준'처럼 한국어로 변환하는 함수
function formatKoreanDateTime(dateTimeStr) {
  // 시각 문자열이 없거나 유효하지 않은 경우 예외 처리
  if (!dateTimeStr) {
    return '측정 시각 정보 없음';
  }
  // 정규식을 사용하여 연-월-일 시:분 형식 추출 ('2026-10-28 16:00')
  const match = String(dateTimeStr).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})/);
  // 정규식 매칭에 성공한 경우 한국어 날짜 형식으로 조합
  if (match) {
    const year = match[1];
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const minuteText = minute > 0 ? ` ${minute}분` : '';
    return `${year}년 ${month}월 ${day}일 ${hour}시${minuteText} 기준`;
  }
  return `${dateTimeStr} 기준`;
}

// [조건] 측정값이 "-" 로 오면 숫자로 계산하지 않고 "측정 안 됨"으로 표시하는 함수
function formatMeasurementValue(value) {
  // 값이 비어있거나 "-" 인 경우 측정 안 됨 반환
  if (value === null || value === undefined || value === '' || value === '-') {
    return '측정 안 됨';
  }
  const trimmed = String(value).trim();
  if (trimmed === '' || isNaN(Number(trimmed))) {
    return '측정 안 됨';
  }
  return `${trimmed} ㎍/㎥`;
}

// 측정소 개별 카드의 등급(pm10Grade)에 따른 스타일 정보 및 이모지 반환 함수
function getStationGradeInfo(gradeCode) {
  // 1등급: 좋음 (파란색)
  if (gradeCode === '1') {
    return { className: 'grade-good', text: '좋음', emoji: '🔵' };
  }
  // 2등급: 보통 (초록색)
  if (gradeCode === '2') {
    return { className: 'grade-normal', text: '보통', emoji: '🟢' };
  }
  // 3등급: 나쁨 (주황색)
  if (gradeCode === '3') {
    return { className: 'grade-bad', text: '나쁨', emoji: '🟠' };
  }
  // 4등급: 매우 나쁨 (빨간색)
  if (gradeCode === '4') {
    return { className: 'grade-very-bad', text: '매우 나쁨', emoji: '🔴' };
  }
  // 등급 값이 비어 있거나 유효하지 않으면 회색 처리
  return { className: 'grade-unknown', text: '등급 없음', emoji: '⚪' };
}

// [조건] 막대 색도 등급 색과 똑같이 맞춰주는 차트용 컬러 매핑 함수
function getChartBarColor(gradeCode) {
  // 1등급: 좋음 (파란색)
  if (gradeCode === '1') {
    return { bg: 'rgba(59, 130, 246, 0.85)', border: '#2563eb' };
  }
  // 2등급: 보통 (초록색)
  if (gradeCode === '2') {
    return { bg: 'rgba(34, 197, 94, 0.85)', border: '#16a34a' };
  }
  // 3등급: 나쁨 (주황색)
  if (gradeCode === '3') {
    return { bg: 'rgba(249, 115, 22, 0.85)', border: '#ea580c' };
  }
  // 4등급: 매우 나쁨 (빨간색)
  if (gradeCode === '4') {
    return { bg: 'rgba(239, 68, 68, 0.85)', border: '#dc2626' };
  }
  // 등급 정보 없음 (회색)
  return { bg: 'rgba(148, 163, 184, 0.85)', border: '#64748b' };
}

// ============================================================
// 상단 '공기 신호등' 상태 갱신 함수
// ============================================================

// 지역 평균 수치를 기반으로 상단 공기 신호등의 이모지, 등급 텍스트, 한 줄 권고 문구를 갱신하는 함수
function updateTrafficLight(averageNum, latestTime) {
  // 수치가 유효하지 않은 경우 처리
  if (averageNum === null || isNaN(averageNum)) {
    trafficLightCard.className = 'traffic-card grade-loading';
    trafficEmoji.textContent = '⚪';
    trafficGradeText.textContent = '측정 불가';
    averageValue.textContent = '측정 안 됨';
    trafficNotice.textContent = '해당 지역의 유효한 미세먼지 측정 데이터가 없습니다.';
    trafficTime.textContent = '';
    return;
  }

  // 계산된 평균 수치를 소수점 한 자리로 화면에 표시
  averageValue.textContent = averageNum.toFixed(1);

  // 1. 좋음 구간 (0 ~ 30)
  if (averageNum <= 30) {
    trafficLightCard.className = 'traffic-card theme-good';
    trafficEmoji.textContent = '🔵';
    trafficGradeText.textContent = '좋음';
    trafficNotice.textContent = '공기가 맑고 쾌적해요. 안심하고 외출이나 환기를 즐기세요!';
  // 2. 보통 구간 (31 ~ 80)
  } else if (averageNum <= 80) {
    trafficLightCard.className = 'traffic-card theme-normal';
    trafficEmoji.textContent = '🟢';
    trafficGradeText.textContent = '보통';
    trafficNotice.textContent = '무난한 공기질이에요. 일상 활동에 지장 없어요.';
  // 3. 나쁨 구간 (81 ~ 150) -> '외출 시 마스크를 챙기세요' 필수
  } else if (averageNum <= 150) {
    trafficLightCard.className = 'traffic-card theme-bad';
    trafficEmoji.textContent = '🟠';
    trafficGradeText.textContent = '나쁨';
    trafficNotice.textContent = '외출 시 마스크를 챙기세요';
  // 4. 매우 나쁨 구간 (151 이상) -> '외출 시 마스크를 챙기세요' 필수
  } else {
    trafficLightCard.className = 'traffic-card theme-very-bad';
    trafficEmoji.textContent = '🔴';
    trafficGradeText.textContent = '매우 나쁨';
    trafficNotice.textContent = '외출 시 마스크를 챙기세요 (불필요한 야외 활동을 자제하세요)';
  }

  // 상단 신호등 영역에 한국어 기준 시각 표시
  if (latestTime) {
    trafficTime.textContent = formatKoreanDateTime(latestTime);
  } else {
    trafficTime.textContent = '';
  }
}

// ============================================================
// [조건] Chart.js 가로 막대그래프 렌더링 함수
// ============================================================

function renderDustChart(items) {
  // Chart.js 라이브러리가 로드되지 않은 경우 함수 종료
  if (typeof Chart === 'undefined') {
    return;
  }

  // [조건] '측정 안 됨'인 측정소는 그래프에서 제외하고 유효한 숫자만 필터링
  const validItems = items.filter((item) => {
    const rawVal = item.pm10Value;
    return rawVal !== null && rawVal !== undefined && rawVal !== '' && rawVal !== '-' && !isNaN(Number(rawVal));
  });

  // 유효한 측정 데이터가 없는 경우 차트 섹션 숨김 처리
  if (validItems.length === 0) {
    chartSection.style.display = 'none';
    return;
  }

  // 차트 섹션 보이기
  chartSection.style.display = 'block';

  // [조건] 미세먼지 수치가 높은 순으로 정렬 후 상위 10개만 추출
  const sortedTop10 = validItems
    .sort((a, b) => Number(b.pm10Value) - Number(a.pm10Value))
    .slice(0, 10);

  // 차트 라벨(측정소 이름) 배열 추출
  const labels = sortedTop10.map((item) => item.stationName || '미상');
  // 차트 데이터(미세먼지 농도 수치) 배열 추출
  const dataValues = sortedTop10.map((item) => Number(item.pm10Value));

  // [조건] 각 측정소의 등급에 맞는 배경색 및 테두리색 배열 생성
  const bgColors = [];
  const borderColors = [];

  sortedTop10.forEach((item) => {
    const colorInfo = getChartBarColor(item.pm10Grade);
    bgColors.push(colorInfo.bg);
    borderColors.push(colorInfo.border);
  });

  // 기존에 생성되어 있던 Chart.js 인스턴스가 있다면 파괴하여 캔버스 충돌 방지
  if (dustChartInstance) {
    dustChartInstance.destroy();
  }

  // Pretendard 기본 폰트 패밀리 지정
  Chart.defaults.font.family = "'Pretendard', sans-serif";

  // 가로 막대그래프 생성
  dustChartInstance = new Chart(dustChartCanvas, {
    // 막대그래프 타입 지정
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '미세먼지 (PM10)',
        data: dataValues,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 8,
        barPercentage: 0.7
      }]
    },
    options: {
      // [조건] 가로 막대그래프로 표시하기 위해 y축을 기준축으로 설정
      indexAxis: 'y',
      // 부모 컨테이너 크기에 반응형으로 맞춤
      responsive: true,
      // 캔버스 종횡비 유지 해제하여 CSS 높이에 맞춤
      maintainAspectRatio: false,
      plugins: {
        // 단일 데이터셋이므로 상단 범례 숨김
        legend: {
          display: false
        },
        // 툴팁 한글 서식 설정
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 12,
          cornerRadius: 8,
          titleFont: { weight: 'bold', size: 13 },
          bodyFont: { size: 13 },
          callbacks: {
            label: function (context) {
              return ` 미세먼지 농도: ${context.raw} ㎍/㎥`;
            }
          }
        }
      },
      scales: {
        // 가로축(수치 축) 설정
        x: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9'
          },
          ticks: {
            font: { size: 12 },
            color: '#64748b',
            callback: function (val) {
              return `${val} ㎍/㎥`;
            }
          }
        },
        // 세로축(측정소 라벨 축) 설정
        y: {
          grid: {
            display: false
          },
          ticks: {
            font: { size: 13, weight: '700' },
            color: '#1e293b'
          }
        }
      }
    }
  });
}

// ============================================================
// 측정소 카드 렌더링 함수
// ============================================================

// API 응답 데이터를 기반으로 개별 측정소 카드를 생성하여 그리드에 추가하는 함수
function renderStations(items, sidoName) {
  // 이전 측정소 카드 목록 비우기
  stationGrid.innerHTML = '';
  // 선택된 시도 이름을 상단 제목에 반영
  regionNameDisplay.textContent = sidoName;

  // 데이터가 비어 있는 경우 예외 처리
  if (!items || items.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'status-message';
    emptyMsg.textContent = '해당 지역의 측정소 데이터가 없습니다.';
    stationGrid.appendChild(emptyMsg);
    // 신호등 상태도 측정 불가로 갱신
    updateTrafficLight(null, null);
    // 차트 섹션 숨김
    chartSection.style.display = 'none';
    return;
  }

  // 평균 계산용 변수
  let totalPm10 = 0;
  let validPm10Count = 0;
  let latestDataTime = '';

  // 각 측정소 순회
  items.forEach((item) => {
    const rawPm10 = item.pm10Value;
    // 측정값이 "-" 이거나 비어있으면 평균 계산에서 제외
    const isValidPm10 = rawPm10 !== null && rawPm10 !== undefined && rawPm10 !== '' && rawPm10 !== '-' && !isNaN(Number(rawPm10));

    if (isValidPm10) {
      totalPm10 += Number(rawPm10);
      validPm10Count += 1;
    }

    // 최신 측정 시각 파악
    if (item.dataTime && !latestDataTime) {
      latestDataTime = item.dataTime;
    }

    // 측정소 카드는 등급 색을 테두리와 배경에 은은하게 반영
    const gradeInfo = getStationGradeInfo(item.pm10Grade);
    const pm10Display = formatMeasurementValue(rawPm10);
    const pm25Display = formatMeasurementValue(item.pm25Value);
    // 한국어 측정 시각 표시
    const timeDisplay = formatKoreanDateTime(item.dataTime);
    const stationNameDisplay = item.stationName ? item.stationName : '이름 미상';

    // 카드 요소 생성
    const card = document.createElement('article');
    // 은은한 등급별 테두리와 배경 클래스 적용
    card.className = `station-card ${gradeInfo.className}`;

    // 카드 내부 HTML 구조 작성
    card.innerHTML = `
      <div>
        <div class="card-header">
          <h3 class="station-name">${stationNameDisplay}</h3>
          <span class="grade-badge">${gradeInfo.emoji} ${gradeInfo.text}</span>
        </div>
        <ul class="info-list">
          <li class="info-item">
            <span class="info-label">미세먼지 (PM10)</span>
            <span class="info-value">${pm10Display}</span>
          </li>
          <li class="info-item">
            <span class="info-label">초미세먼지 (PM2.5)</span>
            <span class="info-value">${pm25Display}</span>
          </li>
        </ul>
      </div>
      <p class="measure-time">${timeDisplay}</p>
    `;

    // 그리드에 카드 추가
    stationGrid.appendChild(card);
  });

  // 유효한 측정소가 1개 이상이면 평균 계산 및 상단 신호등 갱신
  if (validPm10Count > 0) {
    const avg = totalPm10 / validPm10Count;
    updateTrafficLight(avg, latestDataTime);
  } else {
    updateTrafficLight(null, latestDataTime);
  }

  // [조건] 상위 10개 가로 막대그래프 렌더링 호출
  renderDustChart(items);
}

// ============================================================
// API 데이터 요청 및 로딩 상태 처리
// ============================================================

// 데이터를 불러오는 동안 '불러오는 중...' 표시
async function fetchAirQualityData(sidoName) {
  // 상단 공기 신호등 로딩 상태로 변경
  trafficLightCard.className = 'traffic-card grade-loading';
  trafficEmoji.textContent = '⏳';
  trafficGradeText.textContent = '불러오는 중...';
  averageValue.textContent = '-';
  trafficNotice.textContent = '실시간 대기오염 정보를 불러오는 중입니다...';
  trafficTime.textContent = '';

  // 차트 로딩 중 숨김
  chartSection.style.display = 'none';

  // 측정소 그리드 영역에도 '불러오는 중...' 애니메이션 메시지 표시
  stationGrid.innerHTML = `
    <div class="status-message">
      <span class="status-spinner">🔄</span>
      <span>${sidoName} 지역의 대기오염 정보를 불러오는 중...</span>
    </div>
  `;

  try {
    // Vercel 서버리스 API 호출 (/api/dust?sido=지역명)
    const requestUrl = `${API_ENDPOINT}?sido=${encodeURIComponent(sidoName)}`;
    const response = await fetch(requestUrl);
    const data = await response.json();

    // 응답 에러 확인
    if (!response.ok || data.error) {
      throw new Error(data.error || `서버 오류 (상태코드: ${response.status})`);
    }

    // 측정소 데이터 추출 및 화면 렌더링
    const items = data?.response?.body?.items || [];
    renderStations(items, sidoName);

  } catch (error) {
    console.error('대기오염 데이터 로딩 실패:', error);
    // 신호등 오류 상태 표시
    trafficLightCard.className = 'traffic-card grade-loading';
    trafficEmoji.textContent = '⚠️';
    trafficGradeText.textContent = '조회 실패';
    averageValue.textContent = '-';
    trafficNotice.textContent = error.message;

    // 차트 숨김
    chartSection.style.display = 'none';

    // 측정소 그리드 오류 메시지 표시
    stationGrid.innerHTML = `
      <div class="status-message">
        <strong>데이터를 불러오는 중 문제가 발생했습니다.</strong><br><br>
        ${error.message}
      </div>
    `;
  }
}

// ============================================================
// 이벤트 리스너 등록 및 초기 실행
// ============================================================

// 드롭다운 변경 시 해당 지역 공기 신호등 갱신
sidoSelect.addEventListener('change', (event) => {
  fetchAirQualityData(event.target.value);
});

// 페이지 첫 진입 시 기본 선택 지역('서울') 데이터 조회
document.addEventListener('DOMContentLoaded', () => {
  fetchAirQualityData(sidoSelect.value);
});
