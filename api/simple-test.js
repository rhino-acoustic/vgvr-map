export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🧪 Simple Test API 호출됨 - 새로운 함수!');
    console.log('📊 환경:', process.env.VERCEL ? 'Vercel' : 'Local');
    console.log('🔧 Node 버전:', process.version);
    
    return res.status(200).json({
      success: true,
      message: '새로운 API 함수가 정상 작동합니다!',
      timestamp: new Date().toISOString(),
      environment: {
        VERCEL: !!process.env.VERCEL,
        NODE_VERSION: process.version
      }
    });
    
  } catch (error) {
    console.error('❌ Simple Test 실패:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
