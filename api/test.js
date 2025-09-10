export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🧪 Vercel 테스트 API 호출됨');
    
    // 환경변수 확인
    const envCheck = {
      GOOGLE_MAPS_API_KEY: !!process.env.GOOGLE_MAPS_API_KEY,
      GOOGLE_SHEETS_SPREADSHEET_ID: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      GOOGLE_APPLICATION_CREDENTIALS_JSON: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      VERCEL: process.env.VERCEL || 'undefined',
      NODE_ENV: process.env.NODE_ENV || 'undefined'
    };
    
    console.log('🔑 환경변수 체크:', envCheck);
    
    return res.status(200).json({
      success: true,
      message: 'Vercel 환경 테스트 성공',
      environment: envCheck,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    });
    
  } catch (error) {
    console.error('❌ Vercel 테스트 실패:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
