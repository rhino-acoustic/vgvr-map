const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleSheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.serviceAccountPath = 'rhino-4483e-da5526cdd49f.json';
  }

  // Google Sheets API 인증 설정
  async authenticate() {
    try {
      // 환경변수에서 서비스 계정 정보 읽기 (Vercel 배포용)
      let credentials;
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        console.log('🔑 환경변수에서 Google 서비스 계정 정보를 로드했습니다.');
      } else {
        // 로컬 개발용 파일 읽기
        if (!fs.existsSync(this.serviceAccountPath)) {
          throw new Error('Google 서비스 계정 키 파일이 없고 환경변수도 설정되지 않았습니다.');
        }
        credentials = JSON.parse(fs.readFileSync(this.serviceAccountPath, 'utf8'));
        console.log('📁 로컬 파일에서 Google 서비스 계정 정보를 로드했습니다.');
      }
      
      // JWT 클라이언트 생성
      this.auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/spreadsheets.readonly']
      );

      // 인증
      await this.auth.authorize();
      
      // Google Sheets API 클라이언트 생성
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      
      console.log('✅ Google Sheets API 인증이 완료되었습니다.');
      return true;
    } catch (error) {
      console.error('❌ Google Sheets API 인증 실패:', error.message);
      return false;
    }
  }

  // 스프레드시트에서 데이터 가져오기 (배경색 포함)
  async getSheetData(spreadsheetId, range = 'A:Z') {
    try {
      if (!this.sheets) {
        const authResult = await this.authenticate();
        if (!authResult) {
          throw new Error('Google Sheets API 인증에 실패했습니다.');
        }
      }

      console.log(`📊 스프레드시트에서 데이터를 가져오는 중... (ID: ${spreadsheetId})`);
      
      // 값과 포맷 정보를 모두 가져오기
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
        ranges: [range],
        includeGridData: true,
      });

      const sheet = response.data.sheets[0];
      if (!sheet || !sheet.data || !sheet.data[0] || !sheet.data[0].rowData) {
        console.log('⚠️  스프레드시트에 데이터가 없습니다.');
        return [];
      }

      const rowData = sheet.data[0].rowData;
      if (rowData.length === 0) {
        console.log('⚠️  스프레드시트에 데이터가 없습니다.');
        return [];
      }

      // 첫 번째 행을 헤더로 사용
      const headerRow = rowData[0];
      const headers = headerRow.values ? headerRow.values.map(cell => 
        cell.formattedValue || ''
      ) : [];

      // 데이터 행들 처리
      const data = rowData.slice(1).map(row => {
        const obj = {};
        if (row.values) {
          headers.forEach((header, index) => {
            const cell = row.values[index];
            if (cell) {
              // 셀 값
              obj[header] = cell.formattedValue || '';
              
              // O열(색상)의 경우 배경색 추출
              if (header === '색상' || index === 14) { // O열은 14번째 인덱스 (0부터 시작)
                if (cell.effectiveFormat && cell.effectiveFormat.backgroundColor) {
                  const bgColor = cell.effectiveFormat.backgroundColor;
                  // RGB 값을 16진수로 변환
                  const r = Math.round((bgColor.red || 0) * 255);
                  const g = Math.round((bgColor.green || 0) * 255);
                  const b = Math.round((bgColor.blue || 0) * 255);
                  const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                  obj['지역컬러'] = hexColor;
                  console.log(`🎨 ${header} 셀 배경색 발견: ${hexColor}`);
                }
              }
            } else {
              obj[header] = '';
            }
          });
        }
        return obj;
      });

      console.log(`✅ ${data.length}개의 데이터를 성공적으로 가져왔습니다.`);
      return data;

    } catch (error) {
      console.error('❌ 스프레드시트 데이터 가져오기 실패:', error.message);
      throw error;
    }
  }

  // 스프레드시트 ID를 URL에서 추출
  extractSpreadsheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url; // URL이 아니면 그대로 반환 (이미 ID일 수 있음)
  }

  // CSV 형식으로 데이터 저장 (백업용)
  async saveAsCSV(data, filename = 'google-sheets-data.csv') {
    try {
      if (!data || data.length === 0) {
        console.log('⚠️  저장할 데이터가 없습니다.');
        return false;
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header] || '';
            // CSV에서 쉼표나 따옴표가 포함된 값은 따옴표로 감싸기
            return value.includes(',') || value.includes('"') || value.includes('\n') 
              ? `"${value.replace(/"/g, '""')}"` 
              : value;
          }).join(',')
        )
      ].join('\n');

      fs.writeFileSync(filename, csvContent, 'utf8');
      console.log(`📁 데이터가 ${filename}에 저장되었습니다.`);
      return true;
    } catch (error) {
      console.error('❌ CSV 저장 실패:', error.message);
      return false;
    }
  }
}

module.exports = GoogleSheetsService;
