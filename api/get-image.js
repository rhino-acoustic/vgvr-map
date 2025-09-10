const fs = require('fs');
const path = require('path');

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET 요청만 허용
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use GET.' 
    });
  }

  try {
    const { filename } = req.query;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'filename 파라미터가 필요합니다.'
      });
    }

    // Vercel 환경에서는 /tmp 디렉토리 사용
    const pngDir = process.env.VERCEL 
      ? '/tmp/generated-png'
      : path.join(process.cwd(), 'generated-png');
    
    const filePath = path.join(pngDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '파일을 찾을 수 없습니다.'
      });
    }

    // PNG 파일을 base64로 인코딩
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    
    return res.status(200).json({
      success: true,
      filename,
      data: `data:image/png;base64,${base64Image}`,
      size: imageBuffer.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('이미지 로드 오류:', error);
    return res.status(500).json({ 
      success: false,
      error: '이미지를 로드할 수 없습니다.',
      timestamp: new Date().toISOString()
    });
  }
}
