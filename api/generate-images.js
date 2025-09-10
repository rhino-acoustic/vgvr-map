export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    console.log('🚀 Vercel에서 PNG 이미지 생성 요청을 받았습니다...');
    console.log('📊 환경: Vercel =', !!process.env.VERCEL, ', Node =', process.version);
    
    // CommonJS require 방식으로 모듈 로드
    let DataProcessor;
    try {
      DataProcessor = require('../data-processor');
      console.log('✅ DataProcessor 모듈 로드 성공');
    } catch (moduleError) {
      console.error('❌ DataProcessor 모듈 로드 실패:', moduleError.message);
      throw new Error(`모듈 로드 실패: ${moduleError.message}`);
    }
    
    const processor = new DataProcessor();
    
    // 메서드 존재 여부 확인
    console.log('🔍 DataProcessor 메서드 체크:');
    console.log('- generateAllImages:', typeof processor.generateAllImages);
    console.log('- loadGoogleSheetsData:', typeof processor.loadGoogleSheetsData);
    console.log('- 전체 메서드 목록:', Object.getOwnPropertyNames(DataProcessor.prototype));
    
    if (typeof processor.generateAllImages !== 'function') {
      throw new Error('generateAllImages 메서드가 존재하지 않습니다.');
    }
    
    console.log('📊 Google Sheets 데이터 로드 시작...');
    const success = await processor.loadGoogleSheetsData();
    console.log('📊 Google Sheets 데이터 로드 결과:', success);
    
    if (success) {
      console.log('🎨 이미지 생성 시작...');
      const result = await processor.generateAllImages();
      console.log('🎨 이미지 생성 결과:', result);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          message: '이미지 생성이 완료되었습니다.',
          files: result.generatedFiles || 0,
          details: result.details || 'No details',
          timestamp: new Date().toISOString()
        });
      } else {
        console.error('❌ 이미지 생성 실패:', result.error);
        throw new Error(result.error || '이미지 생성 실패');
      }
    } else {
      throw new Error('Google Sheets 데이터 로드 실패');
    }
    
  } catch (error) {
    console.error('❌ Vercel 이미지 생성 실패:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
