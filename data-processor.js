const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const GoogleSheetsService = require('./google-sheets');
const sharp = require('sharp');

class DataProcessor {
  constructor() {
    this.svgTemplate = null;
    this.regionData = [];
    this.googleSheets = new GoogleSheetsService();
  }

  // SVG 템플릿 로드
  loadSvgTemplate() {
    try {
      // Vercel 환경과 로컬 환경 모두 지원하는 경로 설정
      const svgPath = process.env.VERCEL 
        ? path.join(process.cwd(), 'Frame 3.svg')
        : path.join(__dirname, 'Frame 3.svg');
      
      this.svgTemplate = fs.readFileSync(svgPath, 'utf8');
      
      // 템플릿 로딩 시점에서 모든 HTML 엔티티 제거 (Sharp 파싱 오류 방지)
      this.svgTemplate = this.svgTemplate.replace(/&#\d+;/g, '');
      console.log('SVG 템플릿이 성공적으로 로드되었습니다 (HTML 엔티티 정리 완료).');
      return true;
    } catch (error) {
      console.error('SVG 템플릿 로드 실패:', error);
      return false;
    }
  }

  // CSV 데이터 읽기
  async loadCsvData(csvFilePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          this.regionData = results;
          console.log(`${results.length}개의 지역 데이터가 로드되었습니다.`);
          resolve(results);
        })
        .on('error', reject);
    });
  }

  // 색상 유틸리티 함수들
  hexToHsl(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return [h * 360, s * 100, l * 100];
  }

  hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  createGradientColors(baseColor) {
    const [h, s, l] = this.hexToHsl(baseColor);
    const lighterColor = this.hslToHex(h, s, Math.min(100, l + 20));
    // 어두운 색상 대신 기본 색상 사용
    return { lighter: lighterColor, darker: baseColor };
  }

  // 긴 텍스트를 최대 3줄로 나누는 함수
  wrapText(text, maxLength = 10, maxLines = 2) {
    if (!text) {
      return ['', '', ''];
    }

    // 이미 줄바꿈이 있는 경우 먼저 분리
    const lines = text.split(/\n/);
    let result = ['', '', ''];
    let currentLine = 0;

    for (let line of lines) {
      if (currentLine >= maxLines) break;
      
      if (line.length <= maxLength) {
        result[currentLine] = line.trim();
        currentLine++;
      } else {
        // 긴 줄을 나누기
        const words = line.split(/(\s|\/|,|-)/);
        let tempLine = '';
        
        for (let word of words) {
          if (tempLine.length + word.length <= maxLength) {
            tempLine += word;
          } else {
            if (tempLine.trim() && currentLine < maxLines) {
              result[currentLine] = tempLine.trim();
              currentLine++;
            }
            tempLine = word;
          }
        }
        
        if (tempLine.trim() && currentLine < maxLines) {
          result[currentLine] = tempLine.trim();
          currentLine++;
        }
      }
    }

    return [result[0] || '', result[1] || '', result[2] || ''];
  }

  // 팀명을 기준으로 색상을 매핑
  getTeamColor(teamName) {
    console.log(`🎨 팀명 기준 색상 매핑: "${teamName}"`);
    
    const teamColorMap = {
      '용인팀': '#FFE4B5', // 연한 주황
      '구덕팀': '#FFE4E1', // 연한 분홍
      '신촌팀': '#E0F6FF', // 연한 파랑  
      '사직팀': '#FFE4E1', // 연한 분홍
      '하남팀': '#FFE4E1', // 연한 분홍
      '양산팀': '#F0FFF0', // 연한 녹색
      '수원팀': '#F0FFF0', // 연한 녹색
      '부천팀': '#F0FFF0', // 연한 녹색
      '서면팀': '#F0FFF0', // 연한 녹색
      '반포팀': '#FFF8DC', // 연한 노랑
      '목동팀': '#E6E6FA', // 연한 보라
      '잠실팀': '#E6E6FA', // 연한 보라
      '의정부팀': '#E6E6FA', // 연한 보라
      '해운대팀': '#E6E6FA', // 연한 보라
      '인천팀': '#F5F5DC', // 연한 베이지
      '파주팀': '#F5F5DC'  // 연한 베이지
    };
    
    const result = teamColorMap[teamName] || '#F1F9BB';
    console.log(`🎨 팀 색상 결과: "${teamName}" -> "${result}"`);
    return result;
  }

  // Google Sheets에서 데이터 읽기
  async loadGoogleSheetsData(spreadsheetIdOrUrl, range = 'A1:Z50') {
    try {
      // 매개변수가 없으면 환경변수에서 가져오기
      const targetSpreadsheetId = spreadsheetIdOrUrl || process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1IvnBd4cr81HDzEY-AZYeB8g5ogPsWT0Vjhf_0WWAzQ0';
      
      if (!targetSpreadsheetId) {
        throw new Error('Google Sheets 스프레드시트 ID가 설정되지 않았습니다. 환경변수 GOOGLE_SHEETS_SPREADSHEET_ID를 확인해주세요.');
      }
      
      console.log(`📊 사용할 스프레드시트 ID: ${targetSpreadsheetId}`);
      
      const spreadsheetId = this.googleSheets.extractSpreadsheetId(targetSpreadsheetId);
      const data = await this.googleSheets.getSheetData(spreadsheetId, range);
      
      console.log('📋 첫 번째 행 데이터 (헤더):', Object.keys(data[0] || {}));
      
      // 새로운 데이터 구조에 맞게 매핑 - 실제 컬럼명으로 정확히 매핑
      const mappedData = data.map(row => {
        const mapped = {
          지역: row['지역'] || '', // A열 - 지역
          구분: row['구분'] || '', // B열 - 수업/클래스 구분  
          팀명: row['팀명'] || '', // S열 - 팀명
          요일: row['요일'] || '', // C열 - 요일
          수업시간: row['수업시간'] || '', // M열 - 수업시간
          코치명: row['메인코치'] || '', // D열 - 메인코치
          부코치명: row['부코치'] || '', // E열 - 부코치
          매니저: row['매니저'] || '', // F열 - 매니저  
          리더: row['리더'] || '', // H열 - 리더
          집합장소명: row['집합 장소명'] || '', // J열 - 집합장소명
          주차장관련: row['주차장명'] || '', // L열 - 주차장명
          좌표: row['집합 장소 좌표\n구글에서 찾아넣기'] || '', // I열 - 집합장소 좌표
          지역컬러: row['지역컬러'] || this.getTeamColor(row['팀명'] || row['지역'] || ''), // O열 배경색 우선
          특이사항: row['특이사항'] || '', // P열 - 특이사항
          노출여부: row['노출여부'] || '' // Q열 - 노출여부
        };
        
        // 디버깅용 로그 (첫 3개 행만)
        if (data.indexOf(row) < 3) {
          console.log(`📝 Row ${data.indexOf(row)} 매핑:`, {
            원본: Object.keys(row).slice(0, 5),
            좌표컬럼값: row['집합 장소 좌표\n구글에서 찾아넣기'],
            매핑결과: { 지역: mapped.지역, 팀명: mapped.팀명, 요일: mapped.요일, 좌표: mapped.좌표, 노출여부: mapped.노출여부 }
          });
        }
        
        return mapped;
      });
      
      
      const filteredData = mappedData.filter(row => {
        const hasRegion = row.지역 && row.지역.trim() !== '';
        const hasDay = row.요일 && row.요일.trim() !== '';
        const isVisible = row.노출여부 === 'Y' || row.노출여부 === 'y';
        
        // 빈 행 건너뛰기 - 지역이나 요일이 없으면 로그 출력 안함
        if (!hasRegion && !hasDay) {
          return false;
        }
        
        // 디버깅: 필터링 조건 확인
        console.log(`🔍 필터링 체크 - ${row.팀명}: 지역(${hasRegion}), 요일(${hasDay}), 노출여부(${isVisible}, 값:"${row.노출여부}")`);
        
        return hasRegion && hasDay && isVisible;
      });
      
      this.regionData = filteredData;
      console.log(`✅ Google Sheets에서 ${filteredData.length}개의 지역 데이터를 로드했습니다.`);
      
      // Vercel 환경에서는 파일 저장 불가 - 메모리에서만 처리
      console.log(`📊 데이터 처리 완료: ${filteredData.length}개 지역`);
      
      return filteredData;
    } catch (error) {
      console.error('❌ Google Sheets 데이터 로드 실패:', error.message);
      throw error;
    }
  }

  // 지도 이미지 생성 및 별도 저장 (특이사항 포함)
  async generateMapImage(coordinates, specialNotes = '', teamName = 'unknown') {
    if (!coordinates) return null;
    
    try {
      // 좌표에서 위도, 경도 추출
      const coordMatch = coordinates.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
      if (!coordMatch) return null;
      
      const [, lat, lng] = coordMatch;
      
      // Google Maps Static API를 사용한 실제 지도 이미지 생성
      const mapWidth = 570;
      const mapHeight = 1000; // 지도 크기를 전체 높이로 확장
      const zoom = 17; // 줌 레벨을 한 단계 더 증가
      const mapType = 'roadmap';
      
      // Google Maps Static API URL 생성
      const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCOxHoHE_GF2NAJxaUFzPo9fbIQKG7upes';
      
      const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
        `center=${lat},${lng}&` +
        `zoom=${zoom}&` +
        `size=${mapWidth}x${mapHeight}&` +
        `maptype=${mapType}&` +
        `markers=color:red%7C${lat},${lng}&` +
        `language=ko&` +
        `region=KR` +
        (apiKey ? `&key=${apiKey}` : '');
      
      console.log(`🗺️ Google Maps Static API URL 생성: ${teamName} (${lat}, ${lng}) -> 크기: ${mapWidth}x${mapHeight}`);
      console.log(`📍 지도 URL: ${mapUrl}`);
      
      // Google Maps 이미지를 다운로드해서 base64로 인코딩 (5초 타임아웃)
      let base64Image = '';
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃
        
        const response = await fetch(mapUrl, { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'VGVR-Map-Generator/1.0'
          }
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
          console.log(`✅ Google Maps 이미지 다운로드 완료: ${teamName} (${(buffer.length / 1024).toFixed(1)}KB)`);
        } else {
          console.log(`⚠️ Google Maps 이미지 다운로드 실패: ${response.status} - ${teamName}`);
        }
      } catch (downloadError) {
        console.log(`❌ Google Maps 이미지 다운로드 오류: ${downloadError.message} - ${teamName}`);
      }

      return `
        <g id="map-section">
          <!-- 지도 배경 -->
          <rect x="430" y="0" width="570" height="1000" fill="#E8F4F8"/>
          
          ${base64Image ? `
          <!-- Google Maps 이미지 (base64) -->
          <image x="430" y="0" width="${mapWidth}" height="${mapHeight}" href="${base64Image}" preserveAspectRatio="xMidYMid slice"/>
          ` : `
          <!-- 지도 로드 실패 시 좌표 정보 표시 -->
          <rect x="440" y="10" width="550" height="100" fill="rgba(255,255,255,0.9)" stroke="#333" stroke-width="1" rx="5"/>
          <text x="465" y="35" font-family="Freesentation, Arial, sans-serif" font-size="16" font-weight="600" fill="#333">📍 지도 위치</text>
          <text x="465" y="55" font-family="Freesentation, Arial, sans-serif" font-size="14" font-weight="500" fill="#666">위도: ${coordinates.split(',')[0]}</text>
          <text x="465" y="75" font-family="Freesentation, Arial, sans-serif" font-size="14" font-weight="500" fill="#666">경도: ${coordinates.split(',')[1]}</text>
          <text x="465" y="95" font-family="Freesentation, Arial, sans-serif" font-size="12" font-weight="400" fill="#999">${teamName} 집합장소</text>
          `}
          
                   ${specialNotes ? `
                   <!-- P열 특이사항 (지도 하단 오버레이) -->
                   <rect x="440" y="760" width="550" height="230" fill="rgba(255,255,255,0.95)" stroke="#333" stroke-width="1" rx="8"/>
                   <text x="465" y="815" font-family="Freesentation, Arial, sans-serif" font-size="30" font-weight="700" fill="#333">특이사항</text>
                   ${(() => {
                     // 전체 텍스트 길이를 먼저 분석해서 최적 폰트와 줄바꿈 기준 결정
                     const textLength = specialNotes.length;
                     let fontSize, charsPerLine, maxLines, lineHeight;
                     
                     // 텍스트 길이에 따른 보수적인 설정 (박스 안에 확실히 들어가도록)
                     if (textLength <= 60) {
                       // 짧은 텍스트: 큰 글씨, 적은 글자수
                       fontSize = 28; charsPerLine = 22; maxLines = 3; lineHeight = 35;
                     } else if (textLength <= 120) {
                       // 중간 텍스트: 중간 글씨, 보통 글자수
                       fontSize = 24; charsPerLine = 26; maxLines = 4; lineHeight = 32;
                     } else if (textLength <= 180) {
                       // 긴 텍스트: 작은 글씨, 많은 글자수
                       fontSize = 20; charsPerLine = 30; maxLines = 5; lineHeight = 30;
                     } else {
                       // 매우 긴 텍스트: 가장 작은 글씨, 최대 글자수
                       fontSize = 18; charsPerLine = 34; maxLines = 6; lineHeight = 28;
                     }
                     
                     // 단어 단위 줄바꿈 (최적화된 글자수 기준으로)
                     const words = specialNotes.split(' ');
                     const lines = [];
                     let currentLine = '';
                     
                     for (const word of words) {
                       const testLine = currentLine ? currentLine + ' ' + word : word;
                       if (testLine.length > charsPerLine && currentLine) {
                         lines.push(currentLine);
                         currentLine = word;
                       } else {
                         currentLine = testLine;
                       }
                       
                       if (lines.length >= maxLines - 1) break;
                     }
                     
                     if (currentLine && lines.length < maxLines) {
                       lines.push(currentLine);
                     }
                     
                     console.log(`📝 특이사항 최적화: 길이(${textLength}자) → ${lines.length}줄, 폰트${fontSize}px, 줄당${charsPerLine}자, 행간${lineHeight}px`);
                     
                     return lines.map((line, index) =>
                       `<text x="465" y="${850 + index * lineHeight}" font-family="Freesentation, Arial, sans-serif" font-size="${fontSize}" font-weight="500" fill="#444">${line}</text>`
                     ).join('');
                   })()}
                   ` : ''}
        </g>
      `;
    } catch (error) {
      console.error('지도 이미지 생성 실패:', error);
      return null;
    }
  }

  // 지역별 SVG 생성
  async generateRegionalSvg(regionInfo) {
    if (!this.svgTemplate) {
      throw new Error('SVG 템플릿이 로드되지 않았습니다.');
    }

    let modifiedSvg = this.svgTemplate;
    
    // 문제가 되는 모든 HTML 엔티티 요소들 제거 (Sharp 파싱 오류 방지)
    modifiedSvg = modifiedSvg.replace(/<[^>]*&#[^>]*>/g, '');
    
    // 기존 한글 path 요소들 완전 제거 (더 깔끔한 텍스트로 교체하기 위해)
    modifiedSvg = modifiedSvg.replace(/<path[^>]*id="[^"]*"[^>]*>[^<]*<\/path>/g, '');
    modifiedSvg = modifiedSvg.replace(/<path[^>]*id="[^"]*"[^>]*\/>/g, '');
    
    // 왼쪽 영역의 모든 path 요소 제거 (좌표가 430 이하인 것들)
    modifiedSvg = modifiedSvg.replace(/<path[^>]*d="M[12][0-9][0-9][^"]*"[^>]*fill="black"[^>]*\/>/g, '');
    
    // 기존 VEGAVERY 그룹 전체 제거 (더 정확한 패턴)
    modifiedSvg = modifiedSvg.replace(/<g id="VEGAVERY"[^>]*>[\s\S]*?<\/g>/g, '');
    
    // 혹시 남은 닫는 g 태그들도 정리
    const orphanedClosingG = (modifiedSvg.match(/<\/g>/g) || []).length - (modifiedSvg.match(/<g[^>]*>/g) || []).length;
    if (orphanedClosingG > 0) {
      for (let i = 0; i < orphanedClosingG; i++) {
        modifiedSvg = modifiedSvg.replace(/<\/g>/, '');
      }
    }
    
    // 왼쪽 내용 영역 업데이트 (x=0~430 영역)
    
    // 0. 지역별 배경색에 그라데이션 적용 (기존 Rectangle 12의 색상 변경)
    const originalColor = regionInfo.지역컬러 || '#F1F9BB';
    const gradientColors = this.createGradientColors(originalColor);
    const teamName = regionInfo.팀명 || regionInfo.지역 || 'default';
    const gradientId = `gradient_${(teamName || 'unknown').replace(/[^a-zA-Z0-9가-힣]/g, '')}`;
    
    console.log(`🎨 그라데이션 적용: ${teamName} - 기본: "${originalColor}" -> 밝게: "${gradientColors.lighter}" / 어둡게: "${gradientColors.darker}"`);
    
    // 그라데이션 정의 추가 (defs 섹션에)
    if (modifiedSvg.includes('</defs>')) {
      modifiedSvg = modifiedSvg.replace('</defs>', `
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${gradientColors.lighter};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${gradientColors.darker};stop-opacity:1" />
        </linearGradient>
      </defs>`);
    } else {
      // defs가 없으면 새로 생성
      modifiedSvg = modifiedSvg.replace('</svg>', `
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${gradientColors.lighter};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${gradientColors.darker};stop-opacity:1" />
          </linearGradient>
        </defs>
      </svg>`);
    }
    
    // Rectangle 12에 그라데이션 적용 (더 강력한 정규식)
    const beforeReplace = modifiedSvg.includes('Rectangle 12');
    modifiedSvg = modifiedSvg.replace(
      /<rect id="Rectangle 12"([^>]*?)fill="[^"]*"/g, 
      `<rect id="Rectangle 12"$1fill="url(#${gradientId})"`
    );
    const afterReplace = modifiedSvg.includes(`url(#${gradientId})`);
    
    console.log(`🔍 Rectangle 12 찾음: ${beforeReplace}, 그라데이션 적용됨: ${afterReplace}`);
    
    // 1. 팀명 또는 지역명 업데이트 (상단 큰 텍스트, 줄바꿈 적용) - S열 또는 A열
    const displayName = regionInfo.팀명 || regionInfo.지역 || '';
    if (displayName) {
      const [line1, line2] = this.wrapText(displayName, 8);
      const titleText1 = `<text x="215" y="210" font-family="Freesentation, Arial, sans-serif" font-size="80" font-weight="900" text-anchor="middle" fill="black">${line1}</text>`;
      modifiedSvg = modifiedSvg.replace(/<\/svg>/, titleText1 + '</svg>');
      
      if (line2) {
        const titleText2 = `<text x="215" y="290" font-family="Freesentation, Arial, sans-serif" font-size="80" font-weight="900" text-anchor="middle" fill="black">${line2}</text>`;
        modifiedSvg = modifiedSvg.replace(/<\/svg>/, titleText2 + '</svg>');
      }
    }

    // 2. 요일 정보 (별도 줄) - C열
    if (regionInfo.요일) {
      const dayText = `<text x="215" y="350" font-family="Freesentation, Arial, sans-serif" font-size="48" font-weight="800" text-anchor="middle" fill="black">${regionInfo.요일}</text>`;
      modifiedSvg = modifiedSvg.replace(/<\/svg>/, dayText + '</svg>');
    }

    // 3. 시간 정보 (별도 줄) - M열
    if (regionInfo.수업시간) {
      const timeText = `<text x="215" y="410" font-family="Freesentation, Arial, sans-serif" font-size="48" font-weight="800" text-anchor="middle" fill="black">${regionInfo.수업시간}</text>`;
      modifiedSvg = modifiedSvg.replace(/<\/svg>/, timeText + '</svg>');
    }

    // 4. 집합장소 정보 (시간 아래로 220px 이동) - J열
    let yPos = 640;
    
    if (regionInfo.집합장소명) {
      const [placeLine1, placeLine2] = this.wrapText(regionInfo.집합장소명, 12);
      
      // 2줄일 때는 첫 번째 줄을 위로 올려서 균형 맞추기
      const firstLineY = placeLine2 ? yPos - 22 : yPos;
      
      const placeText1 = `<text x="215" y="${firstLineY}" font-family="Freesentation, Arial, sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="black">📍 ${placeLine1}</text>`;
      modifiedSvg = modifiedSvg.replace(/<\/svg>/, placeText1 + '</svg>');
      yPos += 45;
      
      if (placeLine2) {
        const placeText2 = `<text x="215" y="${yPos}" font-family="Freesentation, Arial, sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="black">${placeLine2}</text>`;
        modifiedSvg = modifiedSvg.replace(/<\/svg>/, placeText2 + '</svg>');
        yPos += 45;
      }
    }

    // 5. 코치 정보 추가 - D열, E열
    if (regionInfo.코치명) {
      let coachText = regionInfo.코치명;
      if (regionInfo.부코치명) {
        coachText += ` / ${regionInfo.부코치명}`;
      }
      const coachElement = `<text x="215" y="${yPos}" font-family="Freesentation, Arial, sans-serif" font-size="28" font-weight="600" text-anchor="middle" fill="black">코치: ${coachText}</text>`;
      modifiedSvg = modifiedSvg.replace(/<\/svg>/, coachElement + '</svg>');
      yPos += 25; // 코치와 매니저/리더 사이 행간 줄임 (35->25)
    }

    // 6. 매니저/리더 정보 추가 - F열, H열
    if (regionInfo.매니저 || regionInfo.리더) {
      let staffText = '';
      if (regionInfo.매니저) staffText += `매니저: ${regionInfo.매니저}`;
      if (regionInfo.리더) {
        if (staffText) staffText += ' / ';
        staffText += `리더: ${regionInfo.리더}`;
      }
      const staffElement = `<text x="215" y="${yPos}" font-family="Freesentation, Arial, sans-serif" font-size="24" font-weight="500" text-anchor="middle" fill="black">${staffText}</text>`;
      modifiedSvg = modifiedSvg.replace(/<\/svg>/, staffElement + '</svg>');
      yPos += 45; // 매니저/리더와 주차장 사이 행간 넓힘 (30->45)
    }

    // 7. 주차 정보가 있다면 작은 글씨로 추가 - L열 (최대 3줄 지원)
    if (regionInfo.주차장관련) {
      const [parkingLine1, parkingLine2, parkingLine3] = this.wrapText(regionInfo.주차장관련, 15, 3);
      
      if (parkingLine1) {
        const parkingText1 = `<text x="215" y="${yPos}" font-family="Freesentation, Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle" fill="#333">🚗 ${parkingLine1}</text>`;
        modifiedSvg = modifiedSvg.replace(/<\/svg>/, parkingText1 + '</svg>');
        yPos += 40; // 주차장명 행간 넓힘 (35->40)
      }
      if (parkingLine2) {
        const parkingText2 = `<text x="215" y="${yPos}" font-family="Freesentation, Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle" fill="#333">${parkingLine2}</text>`;
        modifiedSvg = modifiedSvg.replace(/<\/svg>/, parkingText2 + '</svg>');
        yPos += 40; // 주차장명 행간 넓힘 (35->40)
      }
      if (parkingLine3) {
        const parkingText3 = `<text x="215" y="${yPos}" font-family="Freesentation, Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle" fill="#333">${parkingLine3}</text>`;
        modifiedSvg = modifiedSvg.replace(/<\/svg>/, parkingText3 + '</svg>');
      }
    }

    // 8. 새로운 VEGAVERY 로고 추가 (하단 중앙)
    const vegaveryLogo = `
      <g transform="translate(120, 920)">
        <svg width="190" height="48" viewBox="0 0 228 58" fill="none">
          <path d="M224.527 1.67424C225.456 2.21684 226.181 2.96291 226.703 3.91245C227.225 4.86199 227.486 5.92109 227.486 7.09498C227.486 8.26886 227.225 9.33318 226.703 10.2932C226.181 11.2531 225.456 12.0044 224.527 12.5522C223.599 13.0948 222.55 13.3661 221.376 13.3661C220.202 13.3661 219.154 13.0948 218.225 12.5522C217.296 12.0096 216.571 11.2584 216.049 10.2932C215.528 9.33318 215.267 8.26886 215.267 7.09498C215.267 5.92109 215.528 4.86199 216.049 3.91245C216.571 2.96291 217.296 2.21684 218.225 1.67424C219.154 1.13165 220.202 0.860352 221.376 0.860352C222.55 0.860352 223.599 1.13165 224.527 1.67424ZM224.11 11.8375C224.908 11.3679 225.529 10.7158 225.967 9.88621C226.406 9.05667 226.625 8.128 226.625 7.10019C226.625 6.07239 226.406 5.15416 225.967 4.32983C225.529 3.51072 224.914 2.86378 224.11 2.39423C223.312 1.92467 222.399 1.6899 221.371 1.6899C219.811 1.6899 218.554 2.19597 217.594 3.20812C216.634 4.22027 216.154 5.51936 216.154 7.09498C216.154 8.11756 216.373 9.04623 216.811 9.88099C217.249 10.7105 217.86 11.3627 218.653 11.8322C219.441 12.3018 220.348 12.5366 221.371 12.5366C222.394 12.5366 223.307 12.3018 224.11 11.8322V11.8375ZM223.583 7.02194C223.244 7.37149 222.785 7.58018 222.206 7.64801L224.256 10.4966L223.072 10.5279L221.089 7.64801H220.098V10.5279H219.075V3.67767H221.893C222.576 3.67767 223.114 3.84984 223.51 4.18896C223.907 4.5333 224.105 5.01851 224.105 5.66023C224.105 6.21326 223.933 6.66716 223.594 7.02194H223.583ZM220.093 6.78194H221.788C222.665 6.78194 223.098 6.41152 223.098 5.66023C223.098 5.30024 222.978 5.02373 222.748 4.84634C222.514 4.66373 222.195 4.57504 221.788 4.57504H220.093V6.78194Z" fill="black"/>
          <path d="M27.2372 1.55957H36.957V2.25868C34.7605 2.72302 33.4875 6.16119 30.9989 13.1575L19.7765 44.6907H18.5035L5.77862 9.02025C4.09866 4.24124 2.94565 2.49346 0.514404 2.25868V1.55957H15.321V2.25868C12.0811 2.49346 10.9802 4.06385 12.1385 7.44464L21.4513 34.3709L29.0267 12.808C31.458 5.93163 30.9362 2.72302 27.232 2.25868V1.55957H27.2372Z" fill="black"/>
          <path d="M56.2178 37.0578C54.0787 40.6108 50.4892 44.6907 44.2442 44.6907C36.147 44.6907 31.5193 37.7569 31.5193 29.185C31.5193 19.7417 37.6496 12.7506 45.5746 12.7506C52.2266 12.7506 56.6247 17.5296 56.1604 25.2251H37.8217C37.7643 25.632 37.7643 26.039 37.7643 26.4511C37.7643 35.0179 40.7121 40.9029 47.1345 40.9029C50.8388 40.9029 53.4422 38.6282 55.1743 36.4161L56.2178 37.0578ZM37.9365 23.4773H50.3171C50.724 17.4722 49.3362 14.2688 45.2824 14.2688C41.2286 14.2688 38.6304 18.3487 37.9365 23.4773Z" fill="black"/>
          <path d="M76.2322 37.4074C82.5973 37.4074 85.8946 39.9117 85.8946 45.0403C85.8946 52.9653 76.9887 57.9791 69.0063 57.9791C61.9474 57.9791 58.1335 54.4261 58.1335 50.0541C58.1335 47.1376 59.9857 45.5098 62.4117 43.8768L63.163 43.4125H64.5508C63.3352 44.7533 62.9908 46.2663 62.9908 48.0767C62.9908 52.6835 66.5751 55.3026 72.4758 55.3026C77.7974 55.3026 81.9608 52.7357 81.9608 48.0767C81.9608 44.8107 79.8217 42.7708 75.5383 42.7708H64.029C60.6743 42.7708 59.1718 40.9082 59.1718 38.6335C59.1718 36.1292 61.0239 34.3188 64.4934 32.3415C60.9665 30.7085 58.8222 27.5051 58.8222 23.1904C58.8222 16.8984 63.5073 12.7559 70.1593 12.7559C72.241 12.7559 74.1505 13.1628 75.7105 13.8619L85.8894 12.9854L84.8459 16.4236L78.6582 15.8967C80.3382 17.6444 81.319 20.0339 81.319 23.0078C81.319 29.2998 76.7487 33.4423 70.0393 33.4423C68.5368 33.4423 67.149 33.2701 65.9333 32.858C64.1386 34.1414 63.7369 34.8405 63.7369 35.7744C63.7369 36.7083 64.3734 37.4074 65.9907 37.4074H76.227H76.2322ZM64.4882 23.0704C64.4882 28.4911 66.1055 31.9293 70.0967 31.9293C74.0879 31.9293 75.6479 28.4911 75.6479 23.0704C75.6479 17.6496 74.0305 14.2689 70.0967 14.2689C66.1629 14.2689 64.4882 17.6496 64.4882 23.0704Z" fill="black"/>
          <path d="M112.499 40.9917C111.575 42.39 109.488 44.7221 106.368 44.7221C103.248 44.7221 102.492 42.3326 102.32 40.2352C100.003 42.9743 96.4764 44.7221 93.1791 44.7221C89.2453 44.7221 86.4697 42.2752 86.4697 38.3101C86.4697 34.058 89.6523 30.6772 96.5912 28.6947L101.97 27.1817V23.2791C101.97 21.6461 101.97 16.0532 96.4764 16.0532C92.7148 16.0532 90.054 18.5001 88.4366 21.6461L87.2784 21.1818C88.4366 17.4515 92.4278 12.7872 99.0798 12.7872C104.923 12.7872 107.928 16.6897 107.928 22.5226V37.3866C107.928 39.3118 107.928 41.2317 109.666 41.2317C110.532 41.2317 111.226 40.7048 111.69 40.2405L112.499 40.997V40.9917ZM101.97 39.0092V28.6947L98.5581 29.8581C96.1269 30.672 92.3131 31.8981 92.3131 36.5623C92.3131 39.8283 94.1652 41.3987 96.5338 41.3987C98.5581 41.3987 100.582 40.2352 101.97 39.0092Z" fill="black"/>
          <path d="M130.082 13.4497H138.294V14.1488C136.556 14.4984 135.283 16.5957 133.029 22.8929L125.104 44.6907H123.946L114.691 20.3887C113.073 16.1366 112.145 14.5036 110.178 14.154V13.4549H122.094V14.154C119.491 14.3888 119.433 15.9592 120.477 18.8183L126.607 35.4874L131.292 22.4338C133.374 16.6061 132.622 14.5088 130.076 14.1593V13.4601L130.082 13.4497Z" fill="black"/>
          <path d="M161.896 37.0578C159.757 40.6108 156.167 44.6907 149.922 44.6907C141.825 44.6907 137.197 37.7569 137.197 29.185C137.197 19.7417 143.328 12.7506 151.253 12.7506C157.905 12.7506 162.303 17.5296 161.838 25.2251H143.5C143.442 25.632 143.442 26.039 143.442 26.4511C143.442 35.0179 146.39 40.9029 152.813 40.9029C156.517 40.9029 159.12 38.6282 160.852 36.4161L161.896 37.0578ZM143.62 23.4773H156C156.407 17.4722 155.019 14.2688 150.966 14.2688C146.912 14.2688 144.314 18.3487 143.62 23.4773Z" fill="black"/>
          <path d="M182.78 13.2202L181.392 19.2826H180.813C179.425 18.1192 177.745 17.6496 176.592 17.6496C175.205 17.6496 173.932 18.2913 172.486 20.1539V37.5795C172.486 41.3099 172.659 43.2925 175.032 43.2925V43.9916H163.925V43.2925C166.299 43.2925 166.471 41.3099 166.471 37.5795V21.3747C166.471 17.6444 165.49 16.5957 163.523 15.8966V15.1975L172.027 12.8654H172.492V18.2287C174.923 14.9053 177.584 12.7506 180.474 12.7506C181.168 12.7506 181.977 12.8654 182.791 13.2149L182.78 13.2202Z" fill="black"/>
          <path d="M204.846 13.4497H213.058V14.1488C211.321 14.4984 210.168 16.7157 207.851 22.8929L198.074 49.0053C195.758 55.1252 192.58 57.6295 188.647 57.6295C187.603 57.6295 186.68 57.5147 185.636 57.1651L186.215 52.1513H186.795C190.728 54.9478 194.255 54.0139 196.337 48.5358L198.246 43.4646L189.455 20.3834C187.838 16.1314 186.909 14.4984 184.942 14.1488V13.4497H196.859V14.1488C194.255 14.3836 194.198 15.954 195.241 18.8131L201.314 35.2474L206.114 22.4234C208.31 16.5957 207.387 14.4984 204.841 14.1488V13.4497H204.846Z" fill="black"/>
        </svg>
      </g>
    `;

    // 9. 오른쪽 지도 영역 업데이트 - I열 좌표 사용, P열 특이사항 포함
    const mapImage = await this.generateMapImage(regionInfo.좌표, regionInfo.특이사항, teamName);
    
    // 먼저 기존 배경 이미지 제거
    modifiedSvg = modifiedSvg.replace(/<image[^>]*id="image0_50_49"[^>]*>/g, '');
    
    // 10. 전체 SVG에 2px 검정 테두리 추가 (로고와 지도 추가 전에)
    const borderRect = `
      <rect x="1" y="1" width="998" height="998" fill="none" stroke="black" stroke-width="2"/>
    `;
    
    // 로고, 지도, 테두리를 함께 추가 (올바른 구조로)
    const additionalElements = vegaveryLogo + (mapImage || '') + borderRect;
    modifiedSvg = modifiedSvg.replace(/<\/svg>/, additionalElements + '</svg>');
    
    if (mapImage) {
      console.log('🗺️ 기존 배경 이미지 제거 및 Google Maps 추가 완료');
    }
    console.log('🖼️ 전체 SVG에 2px 검정 테두리 추가 완료');

    // SVG 구조 검증 (디버그)
    const svgStartCount = (modifiedSvg.match(/<svg[^>]*>/g) || []).length;
    const svgEndCount = (modifiedSvg.match(/<\/svg>/g) || []).length;
    const gStartCount = (modifiedSvg.match(/<g[^>]*>/g) || []).length;
    const gEndCount = (modifiedSvg.match(/<\/g>/g) || []).length;
    
    console.log(`🔍 SVG 구조 검증: svg 시작(${svgStartCount}) vs 끝(${svgEndCount}), g 시작(${gStartCount}) vs 끝(${gEndCount})`);
    
    if (svgStartCount !== svgEndCount || gStartCount !== gEndCount) {
      console.error(`❌ SVG 구조 불일치 발견! 팀명: ${regionInfo.팀명}`);
      // 첫 500자만 출력해서 구조 확인
      console.log('SVG 시작 부분:', modifiedSvg.substring(0, 500));
      console.log('SVG 끝 부분:', modifiedSvg.substring(modifiedSvg.length - 500));
    }

    // 6. 오른쪽 지도 영역은 그대로 유지 (좌표 기반)
    // 필요시 지도 이미지를 다른 이미지로 교체할 수 있음
    if (regionInfo.mapImageBase64) {
      // 기존 base64 이미지를 새로운 이미지로 교체
      const currentImageMatch = modifiedSvg.match(/data:image\/png;base64,[^"]+/);
      if (currentImageMatch) {
        modifiedSvg = modifiedSvg.replace(currentImageMatch[0], regionInfo.mapImageBase64);
      }
    }

    return modifiedSvg;
  }

  // 모든 지역의 SVG 생성
  async generateAllRegionalSvgs() {
    const generatedSvgs = [];
    
    console.log(`🚀 SVG 생성 시작: ${this.regionData.length}개 지역`);
    
    for (let index = 0; index < this.regionData.length; index++) {
      const region = this.regionData[index];
      
      try {
        console.log(`📝 SVG 생성 중: ${region.팀명 || region.지역 || `지역${index}`} (${index + 1}/${this.regionData.length})`);
        
        const svgContent = await this.generateRegionalSvg(region);
        const fileName = this.generateFileName(region, index);
        
        generatedSvgs.push({
          fileName: fileName,
          content: svgContent,
          regionInfo: region
        });
        
        console.log(`✅ SVG 생성 완료: ${region.팀명 || region.지역 || `지역${index}`}`);
        
      } catch (error) {
        console.error(`❌ SVG 생성 실패: ${region.팀명 || region.지역 || `지역${index}`}`, error);
        // 실패한 것도 빈 SVG로라도 추가해서 전체 프로세스가 중단되지 않도록
        generatedSvgs.push({
          fileName: this.generateFileName(region, index),
          content: '<svg>오류 발생</svg>',
          regionInfo: region
        });
      }
    }
    
    console.log(`🎉 전체 SVG 생성 완료: ${generatedSvgs.length}개`);
    return generatedSvgs;
  }

  // 파일명 생성 (고유값)
  generateFileName(regionInfo, index) {
    // 팀명과 요일을 조합해서 고유한 파일명 생성
    const teamName = regionInfo.팀명 || `team_${index}`;
    const day = regionInfo.요일 || '';
    const baseName = day ? `${teamName}_${day}` : teamName;
    
    // 파일명에 사용할 수 없는 문자 제거
    const safeName = (baseName || 'unknown').replace(/[^a-zA-Z0-9가-힣]/g, '_');
    return `${safeName}_${Date.now()}_${index}.svg`;
  }

  // 생성된 SVG들을 메모리에서 처리하고 PNG로 변환
  async saveSvgsToFiles(outputDir = 'generated-maps') {
    // Vercel 환경에서는 SVG 파일 저장 없이 바로 PNG 변환
    console.log('🚀 Vercel 환경: 메모리에서 직접 PNG 변환 시작');

    const svgs = await this.generateAllRegionalSvgs();
    const savedFiles = [];

    for (const svg of svgs) {
      try {
        // Vercel 환경에서는 PNG 변환 건너뛰기 (Puppeteer 이슈)
        console.log(`📄 SVG 생성 완료: ${svg.regionInfo.팀명}`);
        // PNG 변환은 로컬 환경에서만 수행
        if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
          await this.convertSvgToPng(svg.content, svg.regionInfo, svg.fileName);
        }
        
        savedFiles.push({
          fileName: svg.fileName,
          regionInfo: svg.regionInfo,
          status: 'png_converted'
        });
        
      } catch (error) {
        console.error(`PNG 변환 실패 ${svg.fileName}:`, error);
      }
    }

    return savedFiles;
  }

  // 간단한 SVG를 PNG로 변환 (2개 매개변수)
  async convertSvgToPngSimple(svgContent, pngPath) {
    try {
      console.log(`🚀 PNG 변환 시작 (Sharp): ${path.basename(pngPath)}`);
      
      // SVG 내용을 정리하여 Sharp가 파싱할 수 있도록 수정
      let cleanedSvg = svgContent;
      
      // XML 헤더가 없으면 추가
      if (!cleanedSvg.includes('<?xml')) {
        cleanedSvg = '<?xml version="1.0" encoding="UTF-8"?>\n' + cleanedSvg;
      }
      
      // 문제가 되는 HTML 엔티티와 속성을 정리
      cleanedSvg = cleanedSvg.replace(/&#\d+;/g, '');
      
      // 문제가 되는 rect 요소 완전 제거 (HTML 엔티티가 포함된)
      cleanedSvg = cleanedSvg.replace(/<rect id="[^"]*&#[^"]*"[^>]*>/g, '');
      
      // 빈 줄들 정리
      cleanedSvg = cleanedSvg.replace(/^\s*\n/gm, '');
      
      await sharp(Buffer.from(cleanedSvg, 'utf8'))
        .png({
          quality: 95,
          compressionLevel: 6
        })
        .resize(1000, 1000, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .toFile(pngPath);
      
      console.log(`✅ PNG 변환 성공: ${path.basename(pngPath)}`);
    } catch (error) {
      console.error(`Sharp PNG 변환 실패: ${error}`);
      throw error;
    }
  }

  // SVG를 PNG로 변환하는 메소드 (Sharp 사용)
  async convertSvgToPng(svgContent, regionInfo, svgFileName) {
    try {
      console.log(`🚀 PNG 변환 시작 (Sharp): ${regionInfo.팀명 || regionInfo.지역 || 'unknown'}`);
      
      // 팀명 추출 및 안전한 파일명 생성
      const teamName = regionInfo.팀명 || regionInfo.지역 || 'unknown';
      const safeTeamName = (teamName || 'unknown').toString();
      const pngFileName = `${safeTeamName.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.png`;
      
      // 디렉토리 설정
      const pngDir = path.join(__dirname, 'generated-png');
      if (!fs.existsSync(pngDir)) {
        fs.mkdirSync(pngDir, { recursive: true });
      }
      
      const pngPath = path.join(pngDir, pngFileName);
      
      // Sharp를 사용한 SVG → PNG 변환
      await sharp(Buffer.from(svgContent))
        .png({
          quality: 100,
          compressionLevel: 0,
          density: 300 // 고해상도
        })
        .resize(800, 1200, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .toFile(pngPath);
      
      console.log(`🖼️ PNG 저장됨 (Sharp): ${pngFileName} (${teamName})`);
      return pngPath;
      
    } catch (error) {
      console.error(`Sharp PNG 변환 실패:`, error);
      throw error;
    }
  }

  // 모든 이미지 생성 (SVG + PNG)
  async generateAllImages() {
    try {
      console.log('🎨 모든 이미지 생성을 시작합니다...');
      
      if (!this.regionData || this.regionData.length === 0) {
        throw new Error('생성할 데이터가 없습니다. loadGoogleSheetsData()를 먼저 호출하세요.');
      }

      // SVG 템플릿 로드
      if (!this.loadSvgTemplate()) {
        throw new Error('SVG 템플릿 로드에 실패했습니다.');
      }

      const generatedFiles = [];
      // 서버리스 환경에서는 /tmp 디렉토리 사용
      const outputDir = process.env.VERCEL ? '/tmp/generated-png' : path.join(__dirname, 'generated-png');

      // 출력 디렉토리 생성
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`📁 출력 디렉토리 생성: ${outputDir}`);
      }

      // 각 팀별로 이미지 생성
      for (let i = 0; i < this.regionData.length; i++) {
        const regionData = this.regionData[i];
        console.log(`🎨 ${i + 1}/${this.regionData.length}: ${regionData.팀명} 이미지 생성 중...`);

        try {
          // SVG 생성
          const svgContent = await this.generateRegionalSvg(regionData);
          
          // PNG 변환 (안전한 파일명 생성)
          const safeTeamName = (regionData.팀명 || 'unknown').toString().replace(/[^a-zA-Z0-9가-힣]/g, '_');
          const pngFileName = `${safeTeamName}.png`;
          const pngPath = path.join(outputDir, pngFileName);
          
          try {
            await this.convertSvgToPngSimple(svgContent, pngPath);
            
            // 파일이 실제로 생성되었는지 확인
            if (fs.existsSync(pngPath)) {
              const stats = fs.statSync(pngPath);
              if (stats.size > 0) {
                generatedFiles.push({
                  teamName: regionData.팀명,
                  fileName: pngFileName,
                  path: pngPath
                });
                console.log(`✅ ${regionData.팀명} 이미지 생성 완료: ${pngFileName} (${(stats.size / 1024).toFixed(1)}KB)`);
              } else {
                console.error(`❌ ${regionData.팀명} 파일이 비어있음: ${pngFileName}`);
              }
            } else {
              console.error(`❌ ${regionData.팀명} 파일 생성 실패: ${pngFileName}`);
            }
          } catch (sharpError) {
            console.error(`⚠️ ${regionData.팀명} Sharp 오류:`, sharpError.message);
            
            // Sharp 오류 발생 시 SVG 내용을 파일로 저장해서 디버깅
            const debugSvgPath = path.join(outputDir, `debug_${regionData.팀명}.svg`);
            try {
              fs.writeFileSync(debugSvgPath, svgContent, 'utf8');
              console.log(`🔍 디버그용 SVG 저장: ${debugSvgPath}`);
            } catch (writeError) {
              console.error(`SVG 디버그 파일 저장 실패:`, writeError.message);
            }
            
            // Sharp 오류가 발생해도 파일이 생성되었는지 확인
            if (fs.existsSync(pngPath)) {
              const stats = fs.statSync(pngPath);
              if (stats.size > 0) {
                generatedFiles.push({
                  teamName: regionData.팀명,
                  fileName: pngFileName,
                  path: pngPath
                });
                console.log(`✅ ${regionData.팀명} 이미지 생성 완료 (Sharp 경고 무시): ${pngFileName} (${(stats.size / 1024).toFixed(1)}KB)`);
              }
            }
          }
          
        } catch (error) {
          console.error(`❌ ${regionData.팀명} 이미지 생성 실패:`, error.message);
        }
      }

      console.log(`🎉 이미지 생성 완료! 총 ${generatedFiles.length}개 파일 생성`);
      
      return {
        success: true,
        generatedFiles: generatedFiles.length,
        files: generatedFiles,
        message: `${generatedFiles.length}개의 PNG 이미지가 생성되었습니다.`
      };

    } catch (error) {
      console.error('❌ 전체 이미지 생성 실패:', error);
      return {
        success: false,
        error: error.message,
        generatedFiles: 0
      };
    }
  }

  // 데이터 해시 생성 (변경 감지용)
  generateDataHash() {
    try {
      const dataString = JSON.stringify(this.regionData);
      const crypto = require('crypto');
      return crypto.createHash('md5').update(dataString).digest('hex');
    } catch (error) {
      console.error('❌ 데이터 해시 생성 실패:', error);
      return Date.now().toString();
    }
  }
}

module.exports = DataProcessor;
