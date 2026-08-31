// Helper to generate quick sample portrait and sample document for instant testing

export function createSamplePortraitDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 750;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background gradient (Studio style light blue)
  const bg = ctx.createLinearGradient(0, 0, 0, 750);
  bg.addColorStop(0, '#e0f2fe');
  bg.addColorStop(1, '#bae6fd');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 600, 750);

  // Draw simplified portrait silhouette for sample demo
  // Shoulders / Shirt
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.ellipse(300, 720, 240, 180, 0, 0, Math.PI * 2);
  ctx.fill();

  // Collar
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(260, 560);
  ctx.lineTo(300, 640);
  ctx.lineTo(340, 560);
  ctx.closePath();
  ctx.fill();

  // Neck
  ctx.fillStyle = '#fcd34d';
  ctx.fillRect(265, 480, 70, 90);

  // Head
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.ellipse(300, 360, 120, 150, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(300, 260, 130, 90, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(260, 360, 9, 0, Math.PI * 2);
  ctx.arc(340, 360, 9, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(300, 420, 35, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Badge watermark
  ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SAMPLE PASSPORT PHOTO', 300, 70);

  return canvas.toDataURL('image/jpeg', 0.95);
}

export function createSampleDocumentImage(title: string, pageNum: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1100;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 800, 1100);

  // Border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 12;
  ctx.strokeRect(30, 30, 740, 1040);

  // Header band
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(60, 60, 680, 100);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(title, 90, 125);

  // Lines of text
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`Official Document Page ${pageNum}`, 90, 220);

  ctx.fillStyle = '#64748b';
  ctx.font = '16px sans-serif';
  for (let i = 0; i < 14; i++) {
    const y = 270 + i * 40;
    ctx.fillRect(90, y, 620 - (i % 3) * 80, 14);
  }

  // Footer stamp
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Page ${pageNum} • Created with PDF Studio`, 90, 1000);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export function createSampleAadhaarFront(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 856;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 856, 540);

  // Top header tri-color bar
  ctx.fillStyle = '#ff9933';
  ctx.fillRect(20, 20, 816, 12);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(20, 32, 816, 12);
  ctx.fillStyle = '#138808';
  ctx.fillRect(20, 44, 816, 12);

  // Header Title
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('भारत सरकार / GOVERNMENT OF INDIA', 428, 88);

  // Left side photo frame
  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.fillRect(45, 120, 190, 240);
  ctx.strokeRect(45, 120, 190, 240);

  // Photo portrait silhouette
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(140, 210, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.ellipse(140, 310, 80, 50, 0, 0, Math.PI * 2);
  ctx.fill();

  // Personal details
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('अमन चौहान / AMAN CHAUHAN', 260, 160);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('जन्म तिथि / DOB: 15/08/1998', 260, 210);
  ctx.fillText('पुरुष / MALE', 260, 255);

  // Big Aadhaar Number in red/black
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('XXXX  XXXX  9131', 428, 430);

  // Slogan at bottom
  ctx.fillStyle = '#16a34a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('मेरा आधार, मेरी पहचान', 428, 480);

  // Subtle card border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 836, 520);

  return canvas.toDataURL('image/jpeg', 0.95);
}

export function createSampleAadhaarBack(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 856;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 856, 540);

  // Top header bar
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('भारतीय विशिष्ट पहचान प्राधिकरण / UIDAI', 428, 65);

  // Address Section
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('पता / Address:', 45, 125);

  ctx.fillStyle = '#334155';
  ctx.font = '18px sans-serif';
  ctx.fillText('आत्मज/S/O: रमेश चौहान (Ramesh Chauhan)', 45, 165);
  ctx.fillText('मकान नं. 142, गांधी मार्ग, विकास नगर', 45, 205);
  ctx.fillText('H.No. 142, Gandhi Marg, Vikas Nagar', 45, 245);
  ctx.fillText('जिला/Dist: नई दिल्ली, दिल्ली - 110001', 45, 285);
  ctx.fillText('New Delhi, Delhi - 110001', 45, 325);

  // QR Code placeholder box on right side
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.fillRect(590, 115, 220, 220);
  ctx.strokeRect(590, 115, 220, 220);

  // Mock QR pattern
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(610, 135, 45, 45);
  ctx.fillRect(745, 135, 45, 45);
  ctx.fillRect(610, 270, 45, 45);
  ctx.fillRect(685, 205, 30, 30);
  ctx.fillRect(720, 250, 35, 35);
  ctx.fillRect(670, 260, 25, 25);

  // Aadhaar Number repeated
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('XXXX  XXXX  9131', 428, 430);

  // Help line
  ctx.fillStyle = '#475569';
  ctx.font = '16px sans-serif';
  ctx.fillText('हेल्पलाइन / Helpline: 1947 • help@uidai.gov.in • www.uidai.gov.in', 428, 480);

  // Card Border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 836, 520);

  return canvas.toDataURL('image/jpeg', 0.95);
}

export function createSampleCustomer2Front(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 856;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 856, 540);

  // Top header tri-color bar
  ctx.fillStyle = '#ff9933';
  ctx.fillRect(20, 20, 816, 12);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(20, 32, 816, 12);
  ctx.fillStyle = '#138808';
  ctx.fillRect(20, 44, 816, 12);

  // Header Title
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('आयकर विभाग / INCOME TAX DEPARTMENT', 428, 88);

  // Left side photo frame
  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.fillRect(45, 120, 190, 240);
  ctx.strokeRect(45, 120, 190, 240);

  // Photo portrait silhouette
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.arc(140, 210, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7e22ce';
  ctx.beginPath();
  ctx.ellipse(140, 310, 80, 50, 0, 0, Math.PI * 2);
  ctx.fill();

  // Personal details
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('रोहित कुमार / ROHIT KUMAR', 260, 160);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('पिता / Father: सुरेश कुमार (Suresh Kumar)', 260, 210);
  ctx.fillText('जन्म तिथि / DOB: 22/11/1995', 260, 255);

  // Permanent Account Number
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ABCDE 1234 F', 428, 430);

  // Bottom subtitle
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('स्थायी खाता संख्या कार्ड / PAN CARD (CUSTOMER 2)', 428, 480);

  // Card border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 836, 520);

  return canvas.toDataURL('image/jpeg', 0.95);
}

export function createSampleCustomer2Back(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 856;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 856, 540);

  // Top header bar
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('भारत सरकार / GOVT. OF INDIA', 428, 65);

  // Text
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('निर्देश / Instructions:', 45, 125);

  ctx.fillStyle = '#334155';
  ctx.font = '16px sans-serif';
  ctx.fillText('1. यह कार्ड पहचान और कर उद्देश्यों के लिए मान्य है।', 45, 165);
  ctx.fillText('2. यदि यह कार्ड मिले तो कृपया आयकर विभाग को सूचित करें।', 45, 205);
  ctx.fillText('3. Address: NSDL, Trade World, Mumbai - 400013', 45, 245);

  // QR Code placeholder box
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.fillRect(590, 115, 220, 220);
  ctx.strokeRect(590, 115, 220, 220);

  // Mock QR pattern
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(610, 135, 45, 45);
  ctx.fillRect(745, 135, 45, 45);
  ctx.fillRect(610, 270, 45, 45);
  ctx.fillRect(685, 205, 30, 30);
  ctx.fillRect(720, 250, 35, 35);

  // PAN repeated
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ABCDE 1234 F', 428, 430);

  // Help line
  ctx.fillStyle = '#475569';
  ctx.font = '16px sans-serif';
  ctx.fillText('Helpline: 1800-180-1961 • incometaxindia.gov.in', 428, 480);

  // Card Border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 836, 520);

  return canvas.toDataURL('image/jpeg', 0.95);
}
