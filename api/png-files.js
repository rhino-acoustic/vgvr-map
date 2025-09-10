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
    // Vercel 환경에서는 /tmp 디렉토리 사용
    const pngDir = process.env.VERCEL 
      ? '/tmp/generated-png'
      : path.join(process.cwd(), 'generated-png');
    
    if (!fs.existsSync(pngDir)) {
      return res.status(200).json({ files: [] });
    }

    const files = fs.readdirSync(pngDir)
      .filter(file => file.endsWith('.png'))
      .map(file => {
        const filePath = path.join(pngDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file.replace('.png', ''),
          filename: file,
          size: stats.size,
          lastModified: stats.mtime.toISOString()
        };
      });

    return res.status(200).json({ 
      files: files.map(f => f.filename),
      details: files,
      count: files.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('PNG 파일 목록 불러오기 오류:', error);
    return res.status(500).json({ 
      success: false,
      error: 'PNG 파일 목록을 불러올 수 없습니다.',
      timestamp: new Date().toISOString()
    });
  }
}
